'use strict';

/* Panel de inicio, bienvenida, menú "Más" y selección de sede. */
(function () {
  const { e } = U;

  Views.inicio = {
    titulo: 'Panel',
    tab: 'inicio',
    render(root) {
      const db = App.db;
      const sede = App.sedeId();
      const citasHoy = db.getCitasHoy(sede);
      const citasProx = db.getCitasProximas(7, sede);
      const vencidas = db.getVacunasVencidas(sede);
      const proximas = db.getVacunasProximas(15, sede);
      const bajo = db.getInventarioBajo(sede);
      const pacientes = App.todos('pacientes').filter((p) => p.activo !== false).length;

      root.innerHTML = `
        <div class="hello">${e(U.formatDateLong(U.todayIso()))}</div>
        <div class="stats">
          <a class="stat" href="#/agenda"><strong>${citasHoy.length}</strong><span>Citas hoy</span></a>
          <a class="stat ${vencidas.length ? 'warn' : ''}" href="#/vacunas?f=vencidas"><strong>${vencidas.length}</strong><span>Vacunas vencidas</span></a>
          <a class="stat" href="#/vacunas?f=proximas"><strong>${proximas.length}</strong><span>Vacunas 15 días</span></a>
          <a class="stat ${bajo.length ? 'warn' : ''}" href="#/inventario?f=bajo"><strong>${bajo.length}</strong><span>Stock bajo</span></a>
        </div>

        <div class="quick">
          <a class="quick-btn" href="#/cita/nueva">📅<span>Nueva cita</span></a>
          <a class="quick-btn" href="#/paciente/nuevo">🐶<span>Nueva mascota</span></a>
          <a class="quick-btn" href="#/vacuna/nueva">💉<span>Vacuna</span></a>
          <a class="quick-btn" href="#/historia/nueva">📋<span>Consulta</span></a>
        </div>

        <section class="card">
          <h3>Citas de hoy</h3>
          ${citasHoy.length ? citasHoy.map(filaCita).join('') : '<p class="muted">No hay citas pendientes para hoy.</p>'}
        </section>

        ${vencidas.length ? `<section class="card danger-card">
          <h3>Vacunas vencidas</h3>
          ${vencidas.slice(0, 8).map(filaVacuna).join('')}
          ${vencidas.length > 8 ? `<a class="more" href="#/vacunas?f=vencidas">Ver las ${vencidas.length}</a>` : ''}
        </section>` : ''}

        <section class="card">
          <h3>Próximas vacunas</h3>
          ${proximas.length ? proximas.slice(0, 8).map(filaVacuna).join('') : '<p class="muted">Sin vacunas en los próximos 15 días.</p>'}
          ${proximas.length > 8 ? `<a class="more" href="#/vacunas?f=proximas">Ver las ${proximas.length}</a>` : ''}
        </section>

        <section class="card">
          <h3>Próximas citas (7 días)</h3>
          ${citasProx.length ? citasProx.slice(0, 10).map(filaCita).join('') : '<p class="muted">Sin citas agendadas esta semana.</p>'}
        </section>

        ${bajo.length ? `<section class="card">
          <h3>Stock bajo</h3>
          ${bajo.map((i) => `<a class="row" href="#/insumo/${i.id}"><div><strong>${e(i.nombre)}</strong><small>${e(i.categoria || '')}</small></div><span class="pill warn">${e(i.stock)} / ${e(i.stockMinimo)} ${e(i.unidad || '')}</span></a>`).join('')}
        </section>` : ''}

        <p class="muted center small">${pacientes} mascotas activas${App.sede() ? ' en ' + e(App.sede().nombre) : ''}</p>
      `;
    }
  };

  function filaCita(c) {
    const p = App.paciente(c.pacienteId);
    return `<a class="row" href="#/cita/${c.id}">
      <div class="time">${e(c.horaInicio || '')}<small>${c.fecha === U.todayIso() ? '' : e(U.formatDate(c.fecha))}</small></div>
      <div class="grow"><strong>${e(p ? p.nombre : '(sin paciente)')}</strong><small>${e(c.motivo || '')}</small></div>
      ${U.badge(c.estado)}
    </a>`;
  }

  function filaVacuna(v) {
    const p = App.paciente(v.pacienteId);
    const dias = U.daysUntil(v.fechaProximaDosis);
    return `<a class="row" href="#/vacuna/${v.id}">
      <div class="grow"><strong>${e(p ? p.nombre : '(sin paciente)')}</strong><small>${e(v.nombreProximaVacuna || v.nombre)} · ${e(U.formatDate(v.fechaProximaDosis))}</small></div>
      <span class="pill ${dias < 0 ? 'danger' : 'info'}">${e(U.relativo(v.fechaProximaDosis))}</span>
    </a>`;
  }

  Views.inicio.filaCita = filaCita;
  Views.inicio.filaVacuna = filaVacuna;

  // --- Primera vez: aún no hay datos en el móvil ------------------------------
  Views.bienvenida = {
    render(root) {
      root.innerHTML = `
        <div class="welcome">
          <div class="welcome-logo">🐾</div>
          <h2>Clínica Veterinaria</h2>
          <p>Maneja desde el móvil los mismos datos del programa de escritorio: pacientes, citas, vacunas, historias clínicas, inventario y más.</p>
          ${Vinculo.disponible() ? `<button class="btn block" id="w-drive">☁️ Abrir desde Google Drive</button>
          <p class="muted small">Elige el <strong>vetclinic-data.json</strong> de la carpeta de Drive que usa el programa de escritorio: quedará vinculado y sincronizado.</p>` : ''}
          <button class="btn ${Vinculo.disponible() ? 'secondary' : ''} block" id="w-importar">📥 Importar una copia del archivo</button>
          <p class="muted small">Elige el archivo <strong>vetclinic-data.json</strong> (o un respaldo <strong>.vetenc</strong>) que copiaste del computador.</p>
          <button class="btn secondary block" id="w-demo">Probar con datos de ejemplo</button>
          <button class="btn secondary block" id="w-vacio">Empezar sin datos</button>
        </div>`;
      root.querySelector('#w-importar').addEventListener('click', () => Views.datos.importar());
      const drive = root.querySelector('#w-drive');
      if (drive) drive.addEventListener('click', () => Views.datos.vincularDrive());
      root.querySelector('#w-demo').addEventListener('click', async () => {
        await App.db.startWithSeed();
        App.ir('#/inicio', { reemplazar: true });
      });
      root.querySelector('#w-vacio').addEventListener('click', async () => {
        const nombre = await U.dialogo({ titulo: 'Nombre de la clínica', campo: { placeholder: 'Ej. Clínica Veterinaria San Roque' }, aceptar: 'Crear' });
        if (nombre === null) return;
        await App.db.startEmpty(nombre || 'Mi Clínica Veterinaria');
        App.ir('#/inicio', { reemplazar: true });
      });
    }
  };

  // --- Menú "Más" -------------------------------------------------------------
  Views.mas = {
    titulo: 'Más',
    tab: 'mas',
    render(root) {
      const item = (href, icono, titulo, sub) => `<a class="menu-item" href="${href}"><span class="menu-icon">${icono}</span><div><strong>${titulo}</strong><small>${sub}</small></div><span class="chev">›</span></a>`;
      root.innerHTML = `
        <div class="menu">
          ${item('#/tutores', '🧑‍🤝‍🧑', 'Clientes / Tutores', 'Contacto, WhatsApp y sus mascotas')}
          ${item('#/historias', '📋', 'Historias clínicas', 'Consultas y tratamientos')}
          ${item('#/inventario', '📦', 'Inventario', 'Stock, entradas y salidas')}
          ${item('#/facturas', '🧾', 'Facturas', 'Consulta de facturación y saldos')}
          ${item('#/certificados', '📜', 'Certificados médicos', 'Consulta de certificados emitidos')}
          ${item('#/dosis', '💊', 'Calculadora de dosis', 'Con los medicamentos importados del Excel')}
        </div>
        <div class="menu">
          ${item('#/sedes', '🏥', 'Sede', App.sede() ? App.sede().nombre : 'Todas las sedes')}
          ${item('#/datos', '🔄', 'Datos y sincronización', Vinculo.activo() ? 'Google Drive · ' + Vinculo.textoEstado() : 'Google Drive, importar / exportar')}
          ${item('#/acerca', 'ℹ️', 'Acerca de', 'Cómo funciona la app')}
        </div>`;
    }
  };

  Views.sedes = {
    titulo: 'Sede',
    atras: true,
    render(root) {
      const sedes = App.db.getAll('clinicas');
      const actual = App.sedeId();
      const op = (id, nombre, sub) => `<button class="menu-item ${String(actual || '') === String(id || '') ? 'selected' : ''}" data-id="${id || ''}"><span class="menu-icon">🏥</span><div><strong>${e(nombre)}</strong><small>${e(sub || '')}</small></div>${String(actual || '') === String(id || '') ? '<span class="chev">✓</span>' : ''}</button>`;
      root.innerHTML = `
        <p class="muted">Las listas y el panel muestran solo los datos de la sede elegida.</p>
        <div class="menu">
          ${sedes.length > 1 ? op('', 'Todas las sedes', 'Ver la información de todas') : ''}
          ${sedes.map((s) => op(s.id, s.nombre, [s.direccion, s.telefono].filter(Boolean).join(' · '))).join('')}
        </div>`;
      root.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', async () => {
        await App.db.setUltimaSedeId(b.dataset.id ? Number(b.dataset.id) : null);
        App.ir('#/inicio', { reemplazar: true });
      }));
    }
  };

  Views.acerca = {
    titulo: 'Acerca de',
    atras: true,
    render(root) {
      root.innerHTML = `
        <section class="card prose">
          <h3>Clínica Veterinaria · móvil</h3>
          <p>Esta app usa <strong>el mismo archivo de datos</strong> que el programa de escritorio (<code>vetclinic-data.json</code>), con los mismos campos y numeración. Los datos se guardan solo en este teléfono, en el almacenamiento privado de la app; no se envían a ningún servidor.</p>
          <h4>Google Drive (como el programa de escritorio)</h4>
          <p>Si el programa guarda sus datos en una carpeta de Google Drive, en <em>Más → Datos → Vincular archivo de Drive</em> eliges ese mismo <code>vetclinic-data.json</code>. La app lo lee cada vez que se abre y guarda ahí cada cambio (el ícono ☁️ de arriba muestra el estado). Deja cerrado el programa del computador mientras trabajas en el móvil, y viceversa.</p>
          <h4>Pasar datos del computador al móvil</h4>
          <ol>
            <li>En el programa de escritorio: <em>Configuración → Respaldo de datos → Abrir carpeta de datos</em>, o usa un respaldo (<code>.json</code> o <code>.vetenc</code>).</li>
            <li>Envía ese archivo al teléfono (Google Drive, WhatsApp, correo o cable USB).</li>
            <li>En la app: <em>Más → Datos y sincronización → Importar</em>.</li>
          </ol>
          <h4>Pasar datos del móvil al computador</h4>
          <ol>
            <li>En la app: <em>Más → Datos y sincronización → Exportar</em> y envía el archivo al computador.</li>
            <li>Cierra el programa de escritorio y reemplaza el archivo <code>vetclinic-data.json</code> de su carpeta de datos por el exportado (renombrándolo si hace falta).</li>
          </ol>
          <p class="muted">Importante: trabaja en un solo lugar a la vez. Si registras datos en el computador y en el móvil al mismo tiempo sin pasar el archivo, al importar uno se reemplazan los cambios del otro.</p>
          <h4>Qué se maneja desde el móvil</h4>
          <p>Panel, agenda de citas, pacientes y tutores, vacunas (con aplicación de dosis y descuento de inventario), historias clínicas y tratamientos, inventario (entradas y salidas) y calculadora de dosis. Facturas y certificados se consultan; la contabilidad, los proveedores y los activos se siguen manejando en el computador.</p>
        </section>`;
    }
  };

  // --- Recordatorios al abrir la app (como las notificaciones del escritorio) --
  window.Notificaciones = {
    async revisar(app) {
      const LN = window.Storage.LocalNotifications;
      if (!LN) return;
      try {
        const sede = app.sedeId();
        const hoy = app.db.getCitasHoy(sede).length;
        const vencidas = app.db.getVacunasVencidas(sede).length;
        const pronto = app.db.getVacunasProximas(3, sede).length;
        const partes = [];
        if (hoy) partes.push(`${hoy} cita${hoy > 1 ? 's' : ''} hoy`);
        if (vencidas) partes.push(`${vencidas} vacuna${vencidas > 1 ? 's' : ''} vencida${vencidas > 1 ? 's' : ''}`);
        if (pronto) partes.push(`${pronto} vacuna${pronto > 1 ? 's' : ''} en los próximos 3 días`);
        if (!partes.length) return;
        const clave = 'notificado-' + U.todayIso();
        try { if (localStorage.getItem(clave)) return; } catch (_) { /* sin localStorage */ }
        const permiso = await LN.requestPermissions();
        if (permiso.display !== 'granted') return;
        await LN.schedule({ notifications: [{ id: 1, title: 'Clínica Veterinaria', body: partes.join(' · ') }] });
        try { localStorage.setItem(clave, '1'); } catch (_) { /* ignore */ }
      } catch (err) {
        console.warn('Notificación no enviada', err);
      }
    }
  };
})();
