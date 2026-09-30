'use strict';

/*
 * Datos y sincronización con el programa de escritorio.
 *
 * El intercambio es por archivo, igual que los respaldos del escritorio:
 *   - Importar: vetclinic-data.json (o un respaldo .json / .vetenc cifrado).
 *   - Exportar: el mismo vetclinic-data.json, en claro o cifrado (.vetenc)
 *     con una contraseña, por el menú Compartir de Android.
 */
(function () {
  const { e } = U;

  function sello() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
  }

  function elegirArchivo() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      // Android no reconoce la extensión .vetenc: se aceptan todos los archivos
      // y el contenido se valida al leerlo.
      input.accept = '*/*';
      input.addEventListener('change', () => resolve(input.files[0] || null));
      input.click();
    });
  }

  function resumen(data) {
    const n = (c) => (Array.isArray(data[c]) ? data[c].length : 0);
    return `${n('clinicas')} sede(s), ${n('clientes')} tutores, ${n('pacientes')} mascotas, ${n('citas')} citas, ${n('vacunas')} vacunas, ${n('historias')} historias clínicas, ${n('inventario')} insumos, ${n('facturas')} facturas`;
  }

  Views.datos = {
    titulo: 'Datos',
    atras: true,

    async importar() {
      const file = await elegirArchivo();
      if (!file) return;
      let texto;
      try {
        texto = await U.leerArchivoTexto(file);
      } catch (err) {
        U.toast(err.message, true);
        return;
      }
      if (Cifrado.esCifrado(texto)) {
        const pw = await U.dialogo({ titulo: 'Respaldo cifrado', mensaje: 'Escribe la contraseña de acceso con la que el programa de escritorio cifró este respaldo.', campo: { type: 'password', placeholder: 'Contraseña' }, aceptar: 'Abrir' });
        if (pw === null) return;
        const listo = U.cargando('Descifrando respaldo...');
        try {
          texto = await Cifrado.descifrar(texto, pw);
        } catch (err) {
          listo();
          U.toast(err.message, true);
          return;
        }
        listo();
      }
      let data;
      try {
        data = JSON.parse(texto);
      } catch (_) {
        U.toast('El archivo no es un JSON válido del programa.', true);
        return;
      }
      if (App.db.isLoaded()) {
        const ok = await U.dialogo({
          titulo: '¿Reemplazar los datos del móvil?',
          mensaje: `El archivo trae: ${resumen(data)}.\n\nLos datos que hay ahora en el móvil se reemplazarán por los del archivo (se guarda una copia por si necesitas deshacerlo).`,
          aceptar: 'Reemplazar', peligro: true
        });
        if (!ok) return;
      }
      try {
        await App.db.replaceWithJson(texto);
        localStorage.setItem('ultimaImportacion', JSON.stringify({ fecha: new Date().toISOString(), archivo: file.name }));
      } catch (err) {
        U.toast(err.message, true);
        return;
      }
      U.toast('Datos importados correctamente');
      App.ir('#/inicio', { reemplazar: true });
    },

    /** Vincula el vetclinic-data.json de Google Drive (el mismo que usa el programa). */
    async vincularDrive() {
      if (!Vinculo.disponible()) {
        U.toast('Esta opción solo está disponible en la app de Android.', true);
        return;
      }
      const seguir = await U.dialogo({
        titulo: 'Abrir desde Google Drive',
        mensaje: 'En la siguiente pantalla abre el menú ☰, elige Drive y busca la carpeta de datos del programa de escritorio. Toca el archivo vetclinic-data.json.\n\nMientras trabajes en el móvil, deja cerrado el programa del computador: si está abierto, al guardar reemplaza lo que hiciste en el móvil.',
        aceptar: 'Elegir archivo'
      });
      if (!seguir) return;
      let elegido;
      try {
        elegido = await Vinculo.elegir();
      } catch (err) {
        if (err && (err.code === 'CANCELADO' || /no se eligi/i.test(err.message || ''))) return;
        U.toast(err.message || String(err), true);
        return;
      }
      if (!elegido.info.escribible) {
        const imp = await U.dialogo({
          titulo: 'Solo lectura',
          mensaje: `El archivo "${elegido.info.nombre}" se puede leer pero Android no deja modificarlo desde aquí, así que no se puede vincular. ¿Quieres importar una copia de sus datos?`,
          aceptar: 'Importar copia'
        });
        if (imp) {
          await App.db.replaceWithJson(elegido.texto);
          U.toast('Datos importados (copia sin vincular)');
          App.ir('#/inicio', { reemplazar: true });
        }
        return;
      }
      let usar = 'archivo';
      if (App.db.isLoaded()) {
        usar = await U.elegir({
          titulo: `Vincular "${elegido.info.nombre}"`,
          mensaje: `El archivo de Drive trae: ${resumen(elegido.data)}.\n\n¿Con qué datos quieres quedarte?`,
          opciones: [
            { id: 'archivo', texto: 'Usar los datos de Drive (recomendado)' },
            { id: 'movil', texto: 'Reemplazar Drive con los del móvil', estilo: 'danger' }
          ]
        });
        if (!usar) return;
        if (usar === 'movil' && !(await U.confirmar('El archivo de Drive quedará con los datos de este móvil y el programa de escritorio verá esos datos al abrirse. ¿Continuar?', { peligro: true, aceptar: 'Reemplazar' }))) return;
      }
      const listo = U.cargando('Vinculando...');
      try {
        await Vinculo.vincular(elegido, usar);
      } catch (err) {
        listo();
        U.toast('No se pudo vincular: ' + (err.message || err), true);
        return;
      }
      listo();
      U.toast(Vinculo.estado === 'error' ? 'Vinculado, pero no se pudo guardar en Drive: ' + Vinculo.ultimoError : 'Archivo de Drive vinculado');
      App.ir('#/inicio', { reemplazar: true });
    },

    async exportar(cifrado) {
      let texto = App.db.toJson();
      let nombre = 'vetclinic-data.json';
      if (cifrado) {
        const pw = await U.dialogo({ titulo: 'Exportar cifrado', mensaje: 'Elige una contraseña para cifrar el archivo (AES-256). Sin ella no se podrá abrir, ni en el móvil ni en el computador.', campo: { type: 'password', placeholder: 'Contraseña (mín. 6 caracteres)' }, aceptar: 'Continuar' });
        if (pw === null) return;
        if (pw.length < 6) { U.toast('La contraseña debe tener al menos 6 caracteres', true); return; }
        const pw2 = await U.dialogo({ titulo: 'Confirma la contraseña', campo: { type: 'password', placeholder: 'Repite la contraseña' }, aceptar: 'Cifrar' });
        if (pw2 === null) return;
        if (pw2 !== pw) { U.toast('Las contraseñas no coinciden', true); return; }
        const listo = U.cargando('Cifrando...');
        try {
          texto = await Cifrado.cifrar(texto, pw);
        } finally {
          listo();
        }
        nombre = `vetclinic-data-movil-${sello()}.json.vetenc`;
      }
      try {
        await window.Storage.compartirArchivo(nombre, texto, 'Datos de la Clínica Veterinaria');
        try { localStorage.setItem('ultimaExportacion', new Date().toISOString()); } catch (_) { /* ignore */ }
      } catch (err) {
        // Cerrar el menú Compartir sin elegir nada también llega como error.
        if (!/cancel/i.test(String(err && err.message))) U.toast('No se pudo compartir: ' + (err.message || err), true);
      }
    },

    async render(root) {
      let imp = null;
      try { imp = JSON.parse(localStorage.getItem('ultimaImportacion') || 'null'); } catch (_) { imp = null; }
      let exp = null;
      try { exp = localStorage.getItem('ultimaExportacion'); } catch (_) { exp = null; }
      const respaldo = await window.Storage.readBackup();
      const tam = new Blob([App.db.toJson()]).size;

      root.innerHTML = `
        <section class="card">
          <h3>En este móvil</h3>
          <p>${e(resumen(App.db.data))}.</p>
          <p class="muted small">Tamaño del archivo: ${(tam / 1024).toFixed(0)} KB${imp ? ` · última importación: ${e(new Date(imp.fecha).toLocaleString('es-CO'))} (${e(imp.archivo)})` : ''}${exp ? ` · última exportación: ${e(new Date(exp).toLocaleString('es-CO'))}` : ''}</p>
        </section>

        ${Vinculo.disponible() ? (Vinculo.activo() ? `
        <section class="card">
          <h3>☁️ Google Drive</h3>
          <p>Vinculado a <strong>${e(Vinculo.config.nombre || 'vetclinic-data.json')}</strong>. Cada cambio del móvil se guarda en ese archivo y al abrir la app se trae lo último, igual que el programa de escritorio con su carpeta en Drive.</p>
          <div class="sync-status ${e(Vinculo.estado)}">${e(Vinculo.textoEstado())}</div>
          ${Vinculo.ultimoError ? `<p class="muted small">${e(Vinculo.ultimoError)}</p>` : ''}
          <p class="muted small">Última sincronización: ${Vinculo.config.ultimaSync ? e(new Date(Vinculo.config.ultimaSync).toLocaleString('es-CO')) : '-'}</p>
          <button class="btn block" id="sync-ahora">🔄 Sincronizar ahora</button>
          <button class="btn secondary block" id="desvincular">Desvincular</button>
          <p class="muted small">Deja cerrado el programa del computador mientras trabajas en el móvil (y viceversa): el que tenga el programa abierto pisa los cambios del otro al guardar.</p>
        </section>` : `
        <section class="card">
          <h3>☁️ Abrir desde Google Drive</h3>
          <p class="muted">Si el programa de escritorio guarda sus datos en una carpeta de Google Drive, vincula ese mismo <code>vetclinic-data.json</code>: la app lo leerá al abrir y guardará ahí cada cambio. Necesitas la app de Google Drive en el teléfono con la misma cuenta.</p>
          <button class="btn block" id="vincular">Vincular archivo de Drive</button>
        </section>`) : ''}

        <section class="card">
          <h3>📥 Traer datos del computador</h3>
          <p class="muted">Importa el <code>vetclinic-data.json</code> del programa de escritorio o uno de sus respaldos (<code>.json</code> o cifrado <code>.vetenc</code>). Reemplaza los datos del móvil.</p>
          <button class="btn block" id="importar">Importar archivo</button>
        </section>

        <section class="card">
          <h3>📤 Llevar datos al computador</h3>
          <p class="muted">Genera el archivo de datos para enviarlo por Google Drive, WhatsApp, correo o guardarlo en el teléfono.</p>
          <button class="btn block" id="exportar">Exportar vetclinic-data.json</button>
          <button class="btn secondary block" id="exportar-cif">Exportar cifrado (.vetenc)</button>
          <details class="help"><summary>¿Cómo lo cargo en el computador?</summary>
            <ol>
              <li>Cierra el programa de escritorio.</li>
              <li>Ábrelo de nuevo y ve a <em>Configuración → Respaldo de datos → Abrir carpeta de datos</em> para ver dónde está <code>vetclinic-data.json</code>; ciérralo otra vez.</li>
              <li>Reemplaza ese archivo por el exportado desde el móvil (debe llamarse exactamente <code>vetclinic-data.json</code>).</li>
              <li>Abre el programa: verás los cambios hechos en el móvil.</li>
            </ol>
            <p>Si exportaste cifrado, primero ábrelo en el escritorio con <em>Abrir un respaldo cifrado</em>, que genera el archivo descifrado.</p>
          </details>
        </section>

        <section class="card">
          <h3>⚠️ Trabaja en un solo lugar a la vez</h3>
          <p class="muted">El archivo que importas reemplaza por completo al otro. Antes de registrar datos en el móvil, importa la versión más reciente del computador, y al terminar vuelve a pasarla.</p>
        </section>

        <section class="card">
          <h3>Otras opciones</h3>
          ${respaldo ? '<button class="btn secondary block" id="deshacer">↩ Deshacer la última importación</button>' : ''}
          <button class="btn danger block" id="borrar">Borrar todos los datos del móvil</button>
        </section>`;

      root.querySelector('#importar').addEventListener('click', () => this.importar());
      const vincular = root.querySelector('#vincular');
      if (vincular) vincular.addEventListener('click', () => this.vincularDrive());
      const syncAhora = root.querySelector('#sync-ahora');
      if (syncAhora) syncAhora.addEventListener('click', async () => {
        const listo = U.cargando('Sincronizando con Drive...');
        let cambio = false;
        try { cambio = await Vinculo.revisar(); } finally { listo(); }
        if (!cambio && Vinculo.estado === 'ok') U.toast('Todo al día con Drive');
        App.render();
      });
      const desv = root.querySelector('#desvincular');
      if (desv) desv.addEventListener('click', async () => {
        if (Vinculo.config.pendiente && !(await U.confirmar('Hay cambios del móvil que aún no se han guardado en Drive. Si desvinculas, quedarán solo en el teléfono. ¿Desvincular?'))) return;
        if (!Vinculo.config.pendiente && !(await U.confirmar('Los datos quedan en el móvil, pero dejarán de sincronizarse con el archivo de Drive. ¿Desvincular?'))) return;
        await Vinculo.desvincular();
        U.toast('Archivo desvinculado');
        App.render();
      });
      root.querySelector('#exportar').addEventListener('click', () => this.exportar(false));
      root.querySelector('#exportar-cif').addEventListener('click', () => this.exportar(true));
      const deshacer = root.querySelector('#deshacer');
      if (deshacer) deshacer.addEventListener('click', async () => {
        if (!(await U.confirmar('Se volverá a los datos que había en el móvil antes de la última importación. ¿Continuar?'))) return;
        await App.db.replaceWithJson(respaldo);
        U.toast('Se restauraron los datos anteriores');
        App.ir('#/inicio', { reemplazar: true });
      });
      root.querySelector('#borrar').addEventListener('click', async () => {
        const txt = await U.dialogo({ titulo: 'Borrar todo', mensaje: 'Se borrarán todos los datos guardados en este móvil y se desvinculará el archivo de Drive (el archivo de Drive y el computador no se tocan). Escribe BORRAR para confirmar.', campo: { placeholder: 'BORRAR' }, aceptar: 'Borrar', peligro: true });
        if (txt === null || txt.trim().toUpperCase() !== 'BORRAR') return;
        await Vinculo.desvincular();
        await window.Storage.writeBackup(App.db.toJson());
        await window.Storage.write('');
        App.db.data = null;
        U.toast('Datos borrados del móvil');
        App.ir('#/inicio', { reemplazar: true });
      });
    }
  };
})();
