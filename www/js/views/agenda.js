'use strict';

/* Agenda de citas: vista por día con tira semanal, y formulario de cita. */
(function () {
  const { e } = U;

  Views.agenda = {
    titulo: 'Agenda',
    tab: 'agenda',
    render(root, params) {
      const fecha = params.fecha || U.todayIso();
      const citas = App.todos('citas');
      // Semana (lunes a domingo) que contiene la fecha elegida.
      const d = U.parseIso(fecha);
      const lunes = U.addDaysIso(fecha, -((d.getDay() + 6) % 7));
      const dias = Array.from({ length: 7 }, (_, i) => U.addDaysIso(lunes, i));
      const conteo = (iso) => citas.filter((c) => c.fecha === iso && c.estado === 'pendiente').length;
      const delDia = citas
        .filter((c) => c.fecha === fecha)
        .sort((a, b) => String(a.horaInicio).localeCompare(String(b.horaInicio)));

      root.innerHTML = `
        <div class="week-nav">
          <button class="icon-btn" data-go="${U.addDaysIso(lunes, -7)}" aria-label="Semana anterior">‹</button>
          <strong>${e(U.MESES[U.parseIso(fecha).getMonth()])} ${U.parseIso(fecha).getFullYear()}</strong>
          <button class="icon-btn" data-go="${U.addDaysIso(lunes, 7)}" aria-label="Semana siguiente">›</button>
        </div>
        <div class="week">
          ${dias.map((iso) => {
            const dd = U.parseIso(iso);
            const n = conteo(iso);
            return `<button class="day ${iso === fecha ? 'sel' : ''} ${iso === U.todayIso() ? 'today' : ''}" data-go="${iso}">
              <small>${U.DIAS[dd.getDay()].slice(0, 3)}</small><strong>${dd.getDate()}</strong>${n ? `<i>${n}</i>` : '<i></i>'}
            </button>`;
          }).join('')}
        </div>
        <div class="toolbar">
          <input type="date" id="ag-fecha" value="${fecha}" />
          ${fecha !== U.todayIso() ? '<button class="btn secondary small" id="ag-hoy">Hoy</button>' : ''}
        </div>
        <h3 class="section-title">${e(U.formatDateLong(fecha))}</h3>
        <div class="list">
          ${delDia.length ? delDia.map((c) => {
            const p = App.paciente(c.pacienteId);
            const cli = p && App.cliente(p.clienteId);
            return `<a class="row card-row" href="#/cita/${c.id}">
              <div class="time">${e(c.horaInicio || '--:--')}<small>${e(c.horaFin || '')}</small></div>
              <div class="grow"><strong>${e(p ? p.nombre : '(paciente eliminado)')}</strong><small>${e(c.motivo || '')}${cli ? ' · ' + e(cli.nombre) : ''}</small></div>
              ${U.badge(c.estado)}
            </a>`;
          }).join('') : U.vacio('📅', 'No hay citas este día.')}
        </div>
        <a class="fab" href="#/cita/nueva?fecha=${fecha}" aria-label="Nueva cita">＋</a>
      `;
      root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => App.ir(`#/agenda?fecha=${b.dataset.go}`, { reemplazar: true })));
      root.querySelector('#ag-fecha').addEventListener('change', (ev) => { if (ev.target.value) App.ir(`#/agenda?fecha=${ev.target.value}`, { reemplazar: true }); });
      const hoy = root.querySelector('#ag-hoy');
      if (hoy) hoy.addEventListener('click', () => App.ir('#/agenda', { reemplazar: true }));
    }
  };

  Views.citaForm = {
    titulo: (p) => (p.id ? 'Cita' : 'Nueva cita'),
    atras: true,
    render(root, params) {
      const cita = params.id ? App.db.getById('citas', params.id) : null;
      if (params.id && !cita) { root.innerHTML = U.vacio('❓', 'La cita ya no existe.'); return; }
      const pacienteId = cita ? cita.pacienteId : (params.paciente ? Number(params.paciente) : '');
      const p = pacienteId ? App.paciente(pacienteId) : null;
      const cli = p && App.cliente(p.clienteId);

      root.innerHTML = `
        ${cita && cli && cli.telefono ? `<div class="actions-row">
          <a class="btn secondary small" href="${e(U.whatsappUrl(cli.telefono, recordatorio(cita, p, cli)))}" data-externo>WhatsApp al tutor</a>
          <a class="btn secondary small" href="tel:${e(cli.telefono)}" data-externo>Llamar</a>
        </div>` : ''}
        ${cita && cita.estado === 'pendiente' ? `<div class="actions-row">
          <button class="btn small" data-estado="atendida">✓ Marcar atendida</button>
          <button class="btn secondary small" data-estado="cancelada">Cancelar cita</button>
        </div>` : ''}
        <form id="f" class="form">
          <label class="field full"><span>Paciente</span><div id="pick"></div></label>
          ${U.campo({ label: 'Fecha', name: 'fecha', type: 'date', value: cita ? cita.fecha : (params.fecha || U.todayIso()), required: true })}
          <div class="two">
            ${U.campo({ label: 'Hora inicio', name: 'horaInicio', type: 'time', value: cita ? cita.horaInicio : '09:00', required: true })}
            ${U.campo({ label: 'Hora fin', name: 'horaFin', type: 'time', value: cita ? cita.horaFin : '09:30' })}
          </div>
          ${U.campo({ label: 'Motivo', name: 'motivo', value: cita ? cita.motivo : '', placeholder: 'Ej. Consulta general, vacunación...' })}
          ${U.campo({ label: 'Estado', name: 'estado', type: 'select', value: cita ? cita.estado : 'pendiente', options: [['pendiente', 'Pendiente'], ['atendida', 'Atendida'], ['cancelada', 'Cancelada']] })}
          ${U.campo({ label: 'Notas', name: 'notas', type: 'textarea', value: cita ? cita.notas : '' })}
          <div class="form-actions">
            ${cita ? '<button type="button" class="btn danger" id="del">Eliminar</button>' : ''}
            <button type="submit" class="btn">${cita ? 'Guardar' : 'Crear cita'}</button>
          </div>
        </form>`;

      U.selectorBuscable(root.querySelector('#pick'), {
        name: 'pacienteId', items: App.pacientesParaSelector(), valor: pacienteId, placeholder: 'Buscar mascota o tutor...'
      });

      root.querySelector('#f').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = U.formData(ev.target);
        const payload = {
          pacienteId: Number(fd.pacienteId),
          fecha: fd.fecha,
          horaInicio: fd.horaInicio,
          horaFin: fd.horaFin,
          estado: fd.estado,
          motivo: fd.motivo,
          notas: fd.notas
        };
        if (!payload.pacienteId) { U.toast('Selecciona un paciente de la lista', true); return; }
        if (cita) {
          await App.db.update('citas', cita.id, payload);
          U.toast('Cita actualizada');
        } else {
          const clinicaId = (App.paciente(payload.pacienteId) || {}).clinicaId || App.sedeParaCrear();
          await App.db.create('citas', { ...payload, clinicaId });
          U.toast('Cita creada');
        }
        App.despuesDeGuardar();
      });

      root.querySelectorAll('[data-estado]').forEach((b) => b.addEventListener('click', async () => {
        await App.db.update('citas', cita.id, { estado: b.dataset.estado });
        U.toast(b.dataset.estado === 'atendida' ? 'Cita atendida' : 'Cita cancelada');
        App.render();
      }));

      const del = root.querySelector('#del');
      if (del) del.addEventListener('click', async () => {
        if (!(await U.confirmar('¿Eliminar esta cita?', { peligro: true, aceptar: 'Eliminar' }))) return;
        await App.db.remove('citas', cita.id);
        U.toast('Cita eliminada');
        App.volver('#/agenda');
      });
    }
  };

  function recordatorio(cita, p, cli) {
    const sede = App.db.getById('clinicas', cita.clinicaId);
    return `Hola ${cli.nombre}, le recordamos la cita de ${p.nombre} el ${U.formatDateLong(cita.fecha)} a las ${cita.horaInicio}`
      + `${cita.motivo ? ` (${cita.motivo})` : ''}${sede ? ` en ${sede.nombre}` : ''}.`;
  }
})();
