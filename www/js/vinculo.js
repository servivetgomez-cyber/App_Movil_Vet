'use strict';

/*
 * Archivo de datos vinculado (Google Drive).
 *
 * Igual que el programa de escritorio puede tener su carpeta de datos en
 * Google Drive, la app puede quedar vinculada a ese mismo vetclinic-data.json:
 *
 *   - Al abrir la app (y al volver a ella) lee el archivo de Drive y, si
 *     cambió desde la última vez, carga esa versión.
 *   - Cada cambio hecho en el móvil se guarda primero en el teléfono y,
 *     unos segundos después, en el archivo de Drive.
 *   - Sin internet se sigue trabajando: el cambio queda "pendiente" y se sube
 *     en el siguiente intento.
 *
 * Para saber si el archivo de Drive cambió se compara su contenido (huella
 * SHA-256) con el de la última sincronización, no la fecha: así no importa
 * cómo informe la fecha cada proveedor. Si cambió en los dos lados a la vez
 * (el computador y el móvil), se pregunta cuál conservar en vez de mezclar.
 */
(function () {
  const ARCHIVO_CONFIG = 'vinculo.json';
  const ESPERA_SUBIDA_MS = 2500;

  const Vinculo = {
    config: null, // { uri, nombre, proveedor, huella, pendiente, ultimaSync }
    estado: 'inactivo', // inactivo | ok | subiendo | pendiente | error
    ultimoError: '',
    aplicando: false,
    timer: null,
    enCurso: null,
    oyentes: new Set(),

    disponible() {
      return Boolean(window.Storage.ArchivoVinculado);
    },

    activo() {
      return Boolean(this.config && this.config.uri);
    },

    esDrive() {
      return Boolean(this.config && /google|drive/i.test(this.config.proveedor || ''));
    },

    alCambiarEstado(fn) {
      this.oyentes.add(fn);
    },

    _estado(e, error) {
      this.estado = e;
      this.ultimoError = error || '';
      this.oyentes.forEach((fn) => { try { fn(); } catch (_) { /* ignore */ } });
    },

    async _guardarConfig() {
      await window.Storage.escribirAux(ARCHIVO_CONFIG, JSON.stringify(this.config || {}));
    },

    async cargarConfig() {
      try {
        const txt = await window.Storage.leerAux(ARCHIVO_CONFIG);
        const c = txt ? JSON.parse(txt) : null;
        this.config = c && c.uri ? c : null;
      } catch (_) {
        this.config = null;
      }
      if (this.config) this._estado(this.config.pendiente ? 'pendiente' : 'ok');
    },

    async huella(texto) {
      const bytes = new TextEncoder().encode(texto);
      const h = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('');
    },

    _validar(texto) {
      if (Cifrado.esCifrado(texto)) {
        throw new Error('Ese archivo es un respaldo cifrado (.vetenc). Para vincular elige el vetclinic-data.json normal de la carpeta de datos; los respaldos cifrados se pueden importar como copia.');
      }
      let data;
      try { data = JSON.parse(texto); } catch (_) { throw new Error('El archivo no es un vetclinic-data.json válido.'); }
      if (!data || typeof data !== 'object' || !Array.isArray(data.pacientes)) {
        throw new Error('El archivo no parece ser el vetclinic-data.json del programa.');
      }
      return data;
    },

    /** Paso 1 de vincular: elegir y leer el archivo (no cambia nada todavía). */
    async elegir() {
      const plugin = window.Storage.ArchivoVinculado;
      const info = await plugin.elegir();
      const leido = await plugin.leer({ uri: info.uri });
      const data = this._validar(leido.texto);
      return { info: leido, texto: leido.texto, data };
    },

    /** Paso 2: dejarlo vinculado, usando los datos de Drive o los del móvil. */
    async vincular(elegido, usar) {
      this.config = {
        uri: elegido.info.uri,
        nombre: elegido.info.nombre,
        proveedor: elegido.info.proveedor,
        huella: await this.huella(elegido.texto),
        pendiente: false,
        ultimaSync: new Date().toISOString()
      };
      await this._guardarConfig();
      if (usar === 'archivo') {
        await this._aplicarRemoto(elegido.texto);
        this._estado('ok');
      } else {
        this.config.pendiente = true;
        await this.subirAhora();
      }
    },

    async desvincular() {
      if (!this.config) return;
      const uri = this.config.uri;
      clearTimeout(this.timer);
      this.config = null;
      await this._guardarConfig();
      try { await window.Storage.ArchivoVinculado.liberar({ uri }); } catch (_) { /* ignore */ }
      this._estado('inactivo');
    },

    async _aplicarRemoto(texto) {
      this.aplicando = true;
      try {
        await App.db.replaceWithJson(texto);
      } finally {
        this.aplicando = false;
      }
    },

    /** Lo llama la base de datos después de cada cambio hecho en el móvil. */
    marcarCambio() {
      if (!this.activo() || this.aplicando) return;
      if (!this.config.pendiente) {
        this.config.pendiente = true;
        this._guardarConfig();
      }
      this._estado('pendiente');
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.subirAhora(), ESPERA_SUBIDA_MS);
    },

    /** Guarda los datos del móvil en el archivo de Drive. */
    async subirAhora() {
      if (!this.activo() || !App.db.isLoaded()) return false;
      if (this.enCurso) await this.enCurso.catch(() => {});
      clearTimeout(this.timer);
      const tarea = (async () => {
        this._estado('subiendo');
        const texto = App.db.toJson();
        try {
          await window.Storage.ArchivoVinculado.escribir({ uri: this.config.uri, texto });
          this.config.huella = await this.huella(texto);
          this.config.pendiente = false;
          this.config.ultimaSync = new Date().toISOString();
          await this._guardarConfig();
          this._estado('ok');
          return true;
        } catch (err) {
          this._estado('error', err.message || String(err));
          return false;
        }
      })();
      this.enCurso = tarea;
      try { return await tarea; } finally { this.enCurso = null; }
    },

    /**
     * Revisa el archivo de Drive: si cambió desde la última sincronización lo
     * carga (preguntando si también hay cambios sin subir en el móvil); si no
     * cambió y hay cambios pendientes, los sube. Devuelve true si cargó datos nuevos.
     */
    async revisar({ silencioso = false } = {}) {
      if (!this.activo()) return false;
      if (this.enCurso) await this.enCurso.catch(() => {});
      let leido;
      try {
        leido = await window.Storage.ArchivoVinculado.leer({ uri: this.config.uri });
      } catch (err) {
        this._estado(this.config.pendiente ? 'pendiente' : 'error', err.message || String(err));
        if (!silencioso) U.toast('No se pudo leer el archivo de Drive: ' + (err.message || err), true);
        return false;
      }
      const h = await this.huella(leido.texto);
      if (h === this.config.huella) {
        if (this.config.pendiente) await this.subirAhora();
        else this._estado('ok');
        return false;
      }
      try {
        this._validar(leido.texto);
      } catch (err) {
        this._estado('error', err.message);
        U.toast(err.message, true);
        return false;
      }
      if (this.config.pendiente || !App.db.isLoaded()) {
        const usarDrive = !App.db.isLoaded() || await U.dialogo({
          titulo: 'Cambios en los dos lados',
          mensaje: 'El archivo de Drive cambió (probablemente desde el computador) y en este móvil también hay cambios que todavía no se habían subido.\n\n¿Qué versión quieres conservar? La otra se reemplaza (la del móvil queda en "Deshacer la última importación").',
          aceptar: 'Usar la de Drive',
          cancelar: 'Conservar la del móvil'
        });
        if (!usarDrive) {
          this.config.huella = h; // se sobreescribe Drive a propósito
          await this.subirAhora();
          return false;
        }
      }
      await this._aplicarRemoto(leido.texto);
      this.config.huella = h;
      this.config.pendiente = false;
      this.config.ultimaSync = new Date().toISOString();
      await this._guardarConfig();
      this._estado('ok');
      if (!silencioso) U.toast('Datos actualizados desde Drive');
      return true;
    },

    textoEstado() {
      if (!this.activo()) return '';
      return {
        ok: 'Sincronizado',
        subiendo: 'Guardando en Drive…',
        pendiente: 'Cambios sin subir',
        error: 'Sin conexión con el archivo'
      }[this.estado] || '';
    }
  };

  window.Vinculo = Vinculo;
})();
