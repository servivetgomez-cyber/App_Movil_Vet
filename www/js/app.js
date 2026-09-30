'use strict';

/*
 * Arranque, navegación y estado compartido de la app.
 *
 * Cada pantalla es una ruta (#/pacientes, #/paciente/5, #/cita/nueva...), así
 * el botón "atrás" de Android funciona como se espera: vuelve a la pantalla
 * anterior en vez de cerrar la app.
 */
(function () {
  const Views = {};
  window.Views = Views;

  const App = {
    db: new VetDB(window.Storage),
    rutas: [],

    // --- Sede activa: null = todas las sedes ------------------------------
    sedeId() {
      const id = this.db.getUltimaSedeId();
      return id && this.db.getById('clinicas', id) ? id : null;
    },

    sede() {
      const id = this.sedeId();
      return id ? this.db.getById('clinicas', id) : null;
    },

    /** Sede para registros nuevos que no heredan la sede de otro registro. */
    sedeParaCrear() {
      const id = this.sedeId();
      if (id) return id;
      const sedes = this.db.getAll('clinicas').filter((c) => c.activa !== false);
      return sedes.length === 1 ? sedes[0].id : null;
    },

    todos(coleccion) {
      return this.db.getAll(coleccion, this.sedeId());
    },

    // --- Búsquedas frecuentes ------------------------------------------------
    paciente(id) { return this.db.getById('pacientes', id); },
    cliente(id) { return this.db.getById('clientes', id); },

    pacienteLabel(p) {
      if (!p) return '(paciente eliminado)';
      const c = this.cliente(p.clienteId);
      return c ? `${p.nombre} (${c.nombre})` : p.nombre;
    },

    pacientesParaSelector({ soloActivos = true } = {}) {
      return this.todos('pacientes')
        .filter((p) => !soloActivos || p.activo !== false)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .map((p) => {
          const c = this.cliente(p.clienteId);
          return { id: p.id, label: p.nombre, sub: [p.especie, c && c.nombre, p.historiaClinica].filter(Boolean).join(' · ') };
        });
    },

    // --- Navegación ----------------------------------------------------------
    ruta(patron, vista, opciones = {}) {
      const nombres = [];
      const re = new RegExp('^' + patron.replace(/:(\w+)/g, (_, n) => { nombres.push(n); return '([^/]+)'; }) + '$');
      this.rutas.push({ re, nombres, vista, opciones });
    },

    ir(hash, { reemplazar = false } = {}) {
      const destino = hash.startsWith('#') ? hash : `#${hash}`;
      if (reemplazar) {
        history.replaceState(null, '', destino);
        this.render();
      } else {
        location.hash = destino;
      }
    },

    volver(respaldo) {
      if (history.length > 1) history.back();
      else this.ir(respaldo || '#/inicio', { reemplazar: true });
    },

    /** Tras guardar un formulario: vuelve a la pantalla de la que se vino. */
    despuesDeGuardar(destino) {
      if (destino) this.ir(destino, { reemplazar: true });
      else this.volver();
    },

    async render() {
      const root = document.getElementById('view-root');
      if (!this.db.isLoaded()) {
        this._pintarShell({ titulo: 'Bienvenida', tab: null, sinNav: true });
        Views.bienvenida.render(root);
        return;
      }
      const [ruta, query] = (location.hash.slice(1) || '/inicio').split('?');
      const params = Object.fromEntries(new URLSearchParams(query || ''));
      let encontrada = null;
      for (const r of this.rutas) {
        const m = ruta.match(r.re);
        if (m) {
          r.nombres.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
          encontrada = r;
          break;
        }
      }
      if (!encontrada) {
        this.ir('#/inicio', { reemplazar: true });
        return;
      }
      const vista = Views[encontrada.vista];
      const titulo = typeof vista.titulo === 'function' ? vista.titulo(params) : vista.titulo;
      this._pintarShell({ titulo, tab: vista.tab, atras: vista.atras });
      root.innerHTML = '';
      root.scrollTop = 0;
      window.scrollTo(0, 0);
      try {
        await vista.render(root, params);
      } catch (err) {
        console.error(err);
        root.innerHTML = U.vacio('⚠️', `Ocurrió un error: ${err.message}`);
      }
    },

    async _alCambiarVisibilidad() {
      if (!Vinculo.activo()) return;
      if (document.visibilityState === 'hidden') {
        // Al salir de la app se sube lo pendiente sin esperar.
        if (Vinculo.config.pendiente) Vinculo.subirAhora();
        return;
      }
      const cambio = await Vinculo.revisar({ silencioso: true });
      if (!cambio) return;
      // No se redibuja un formulario a medio llenar: se avisa y ya.
      if (document.querySelector('#view-root form#f')) {
        U.toast('Llegaron datos nuevos de Drive; los verás al salir de este formulario');
      } else {
        U.toast('Datos actualizados desde Drive');
        this.render();
      }
    },

    _pintarSync() {
      const chip = document.getElementById('sync-chip');
      const visible = Vinculo.activo() && this.db.isLoaded();
      chip.classList.toggle('hidden', !visible);
      if (!visible) return;
      const icono = { ok: '☁️', subiendo: '⏳', pendiente: '⏳', error: '⚠️' }[Vinculo.estado] || '☁️';
      chip.textContent = icono;
      chip.title = Vinculo.textoEstado();
      chip.className = `sync-chip estado-${Vinculo.estado}`;
    },

    _pintarShell({ titulo, tab, atras, sinNav }) {
      document.getElementById('view-title').textContent = titulo || '';
      const btnAtras = document.getElementById('btn-atras');
      btnAtras.classList.toggle('hidden', !atras);
      document.getElementById('bottom-nav').classList.toggle('hidden', Boolean(sinNav));
      document.getElementById('sede-chip').classList.toggle('hidden', Boolean(sinNav));
      this._pintarSync();
      document.querySelectorAll('#bottom-nav a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
      if (!sinNav) {
        const sede = this.sede();
        const sedes = this.db.getAll('clinicas');
        document.getElementById('sede-chip').textContent = sede ? sede.nombre : (sedes.length > 1 ? 'Todas las sedes' : (sedes[0] ? sedes[0].nombre : ''));
      }
    },

    async init() {
      document.getElementById('btn-atras').addEventListener('click', () => this.volver());
      document.getElementById('sede-chip').addEventListener('click', () => this.ir('#/sedes'));
      window.addEventListener('hashchange', () => this.render());
      document.getElementById('sync-chip').addEventListener('click', () => this.ir('#/datos'));
      Vinculo.alCambiarEstado(() => this._pintarSync());
      this.db.onChange(() => Vinculo.marcarCambio());
      document.addEventListener('visibilitychange', () => this._alCambiarVisibilidad());
      try {
        await this.db.load();
      } catch (err) {
        console.error(err);
        U.toast('No se pudo leer el archivo de datos guardado: ' + err.message, true);
      }
      await Vinculo.cargarConfig();
      if (Vinculo.activo()) {
        // Como el programa de escritorio con su carpeta en Drive: al abrir se
        // trae lo último que haya en el archivo.
        const quitar = this.db.isLoaded() ? () => {} : U.cargando('Abriendo el archivo de Google Drive...');
        try { await Vinculo.revisar({ silencioso: true }); } finally { quitar(); }
      }
      this._pintarSync();
      if (this.db.isLoaded()) {
        await this.db.finalizarTratamientosVencidos();
        Notificaciones.revisar(this);
      }
      await this.render();
    }
  };

  window.App = App;
  document.addEventListener('DOMContentLoaded', () => {
    Rutas.registrar(App);
    App.init();
  });
})();
