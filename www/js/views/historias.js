'use strict';

/* Historias clínicas (consultas) con sus tratamientos y evoluciones. */
(function () {
  const { e } = U;
  const TURGENCIA = [['', 'Sin evaluar'], ['Normal', 'Normal'], ['Disminuida', 'Disminuida'], ['Ausente', 'Ausente']];
  const DESHIDRATACION = [['', 'Sin evaluar'], ['Sin deshidratación', 'Sin deshidratación'], ['Leve (< 5%)', 'Leve (< 5%)'], ['Moderada (5-8%)', 'Moderada (5-8%)'], ['Severa (> 8%)', 'Severa (> 8%)']];
  const ESTADOS_TRAT = [['activo', 'Activo'], ['finalizado', 'Finalizado'], ['suspendido', 'Suspendido']];

  function fila(h) {
    const p = App.paciente(h.pacienteId);
    return `<a class="row card-row" href="#/historia/${h.id}">
      <div class="time">${e(U.formatDate(h.fecha).split(' ').slice(0, 2).join(' '))}<small>${e(String(h.fecha || '').slice(0, 4))}</small></div>
      <div class="grow"><strong>${e(h.motivoConsulta || 'Consulta')}</strong><small>${e(p ? p.nombre : '')}${h.diagnostico ? ' · ' + e(h.diagnostico) : ''}</small></div>
      <span class="chev">›</span></a>`;
  }

  Views.historias = {
    titulo: 'Historias clínicas',
    atras: true,
    fila,
    render(root) {
      root.innerHTML = `
        <div class="search-bar"><input type="search" id="q" placeholder="Buscar mascota, motivo o diagnóstico..." /></div>
        <div class="list" id="lista"></div>
        <a class="fab" href="#/historia/nueva" aria-label="Nueva consulta">＋</a>`;
      const todas = App.todos('historias').sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || b.id - a.id);
      const pintar = () => {
        const q = U.normalizar(root.querySelector('#q').value);
        const lista = todas.filter((h) => {
          if (!q) return true;
          const p = App.paciente(h.pacienteId);
          return U.normalizar([h.motivoConsulta, h.diagnostico, h.sintomas, h.veterinario, p && p.nombre].join(' ')).includes(q);
        }).slice(0, 200);
        root.querySelector('#lista').innerHTML = lista.length ? lista.map(fila).join('') : U.vacio('📋', 'No hay historias clínicas.');
      };
      root.querySelector('#q').addEventListener('input', pintar);
      pintar();
    }
  };

  Views.historia = {
    titulo: 'Consulta',
    atras: true,
    render(root, params) {
      const h = App.db.getById('historias', params.id);
      if (!h) { root.innerHTML = U.vacio('❓', 'La historia clínica ya no existe.'); return; }
      const p = App.paciente(h.pacienteId);
      const trats = App.db.by('tratamientos', 'historiaId', h.id);
      const evols = App.db.by('evoluciones', 'historiaId', h.id).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
      const dato = (t, v) => (v !== undefined && v !== null && v !== '' ? `<dt>${t}</dt><dd>${e(v)}</dd>` : '');
      root.innerHTML = `
        <section class="card">
          <h3>${e(h.motivoConsulta || 'Consulta')}</h3>
          <p class="muted">${e(U.formatDate(h.fecha))} · ${p ? `<a href="#/paciente/${p.id}">${e(p.nombre)}</a>` : ''}${h.veterinario ? ' · ' + e(h.veterinario) : ''}</p>
          <dl class="kv">
            ${dato('Peso', h.peso != null && h.peso !== '' ? `${h.peso} kg` : '')}
            ${dato('Temperatura', h.temperatura != null && h.temperatura !== '' ? `${h.temperatura} °C` : '')}
            ${dato('Anamnesis', h.anamnesis)}
            ${dato('Llenado capilar', h.tiempoLlenadoCapilar)}
            ${dato('Turgencia de piel', h.turgenciaPiel)}
            ${dato('Deshidratación', h.deshidratacion)}
            ${dato('Síntomas', h.sintomas)}
            ${dato('Diagnóstico', h.diagnostico)}
            ${dato('Notas', h.notas)}
          </dl>
          <a class="btn secondary small" href="#/historia/${h.id}/editar">✏️ Editar consulta</a>
        </section>
        <section class="card">
          <h3>Tratamientos / receta</h3>
          ${trats.length ? trats.map((t) => `<a class="row" href="#/tratamiento/${t.id}">
            <div class="grow"><strong>${e(t.medicamento && t.medicamento !== 'Ninguno' ? t.medicamento : t.descripcion)}</strong>
            <small>${e([t.descripcion !== t.medicamento ? t.descripcion : '', t.dosis, t.frecuencia].filter((x) => x && x !== '-').join(' · '))}</small>
            <small>${e(U.formatDate(t.fechaInicio))}${t.fechaFin ? ' → ' + e(U.formatDate(t.fechaFin)) : ''}</small></div>${U.badge(t.estado)}</a>`).join('') : '<p class="muted">Sin tratamientos.</p>'}
          <a class="btn secondary block" href="#/tratamiento/nuevo?historia=${h.id}">＋ Agregar medicamento</a>
        </section>
        <section class="card">
          <h3>Evolución</h3>
          ${evols.length ? evols.map((ev) => `<div class="note"><small>${e(U.formatDate(ev.fecha))}${ev.veterinario ? ' · ' + e(ev.veterinario) : ''}</small>${ev.peso != null || ev.temperatura != null ? `<small>${ev.peso != null ? e(ev.peso) + ' kg' : ''}${ev.peso != null && ev.temperatura != null ? ' · ' : ''}${ev.temperatura != null ? e(ev.temperatura) + ' °C' : ''}</small>` : ''}<p>${e(ev.observaciones || '')}</p><button class="link danger" data-del-ev="${ev.id}">Eliminar</button></div>`).join('') : '<p class="muted">Sin notas de evolución.</p>'}
          <form id="fev" class="form inline-form">
            <div class="two">
              ${U.campo({ label: 'Fecha', name: 'fecha', type: 'date', value: U.todayIso(), required: true })}
              ${U.campo({ label: 'Veterinario', name: 'veterinario', value: h.veterinario || '' })}
            </div>
            <div class="two">
              ${U.campo({ label: 'Peso (kg)', name: 'peso', type: 'number', step: '0.01', min: '0' })}
              ${U.campo({ label: 'Temperatura (°C)', name: 'temperatura', type: 'number', step: '0.1', min: '0' })}
            </div>
            ${U.campo({ label: 'Observaciones / evolución', name: 'observaciones', type: 'textarea', required: true, placeholder: 'Respuesta al tratamiento, ajustes, próximos pasos...' })}
            <button class="btn small" type="submit">Agregar control</button>
          </form>
        </section>`;
      root.querySelector('#fev').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = U.formData(ev.target);
        const pac = App.paciente(h.pacienteId);
        await App.db.create('evoluciones', {
          historiaId: h.id,
          pacienteId: h.pacienteId,
          fecha: fd.fecha,
          veterinario: fd.veterinario,
          peso: U.numOrNull(fd.peso),
          temperatura: U.numOrNull(fd.temperatura),
          observaciones: fd.observaciones,
          clinicaId: (pac && pac.clinicaId) || h.clinicaId
        });
        U.toast('Control de evolución agregado');
        App.render();
      });
      root.querySelectorAll('[data-del-ev]').forEach((b) => b.addEventListener('click', async () => {
        if (!(await U.confirmar('¿Eliminar este control de evolución?', { peligro: true, aceptar: 'Eliminar' }))) return;
        await App.db.remove('evoluciones', Number(b.dataset.delEv));
        App.render();
      }));
    }
  };

  Views.historiaForm = {
    titulo: (p) => (p.id ? 'Editar consulta' : 'Nueva consulta'),
    atras: true,
    render(root, params) {
      const h = params.id ? App.db.getById('historias', params.id) : null;
      const pacienteId = h ? h.pacienteId : (params.paciente ? Number(params.paciente) : '');
      const p = pacienteId ? App.paciente(pacienteId) : null;
      const v = (k, def = '') => (h ? (h[k] ?? '') : def);
      root.innerHTML = `
        <form id="f" class="form">
          <label class="field full"><span>Paciente</span><div id="pick"></div></label>
          <div class="two">
            ${U.campo({ label: 'Fecha', name: 'fecha', type: 'date', value: v('fecha', U.todayIso()), required: true })}
            ${U.campo({ label: 'Veterinario', name: 'veterinario', value: v('veterinario') })}
          </div>
          <div class="two">
            ${U.campo({ label: 'Peso (kg)', name: 'peso', type: 'number', step: '0.01', min: '0', value: v('peso', p && p.peso != null ? p.peso : '') })}
            ${U.campo({ label: 'Temperatura (°C)', name: 'temperatura', type: 'number', step: '0.1', min: '0', value: v('temperatura') })}
          </div>
          ${U.campo({ label: 'Motivo de consulta', name: 'motivoConsulta', value: v('motivoConsulta'), required: true })}
          <h4 class="form-sub">Anamnesis y examen físico</h4>
          ${U.campo({ label: 'Anamnesis', name: 'anamnesis', type: 'textarea', value: v('anamnesis'), placeholder: 'Inicio y evolución del problema, antecedentes, alimentación...' })}
          ${U.campo({ label: 'Tiempo de llenado capilar', name: 'tiempoLlenadoCapilar', value: v('tiempoLlenadoCapilar'), placeholder: 'Ej. < 2 segundos' })}
          <div class="two">
            ${U.campo({ label: 'Turgencia de piel', name: 'turgenciaPiel', type: 'select', value: v('turgenciaPiel'), options: TURGENCIA })}
            ${U.campo({ label: 'Deshidratación', name: 'deshidratacion', type: 'select', value: v('deshidratacion'), options: DESHIDRATACION })}
          </div>
          <h4 class="form-sub">Diagnóstico</h4>
          ${U.campo({ label: 'Síntomas', name: 'sintomas', type: 'textarea', value: v('sintomas') })}
          ${U.campo({ label: 'Diagnóstico', name: 'diagnostico', type: 'textarea', value: v('diagnostico') })}
          ${U.campo({ label: 'Notas', name: 'notas', type: 'textarea', value: v('notas') })}
          ${!h ? '<label class="check"><input type="checkbox" name="actualizarPeso" checked /> Actualizar el peso en la ficha de la mascota</label>' : ''}
          <div class="form-actions">
            ${h ? '<button type="button" class="btn danger" id="del">Eliminar</button>' : ''}
            <button type="submit" class="btn">${h ? 'Guardar' : 'Crear consulta'}</button>
          </div>
        </form>`;
      U.selectorBuscable(root.querySelector('#pick'), { name: 'pacienteId', items: App.pacientesParaSelector(), valor: pacienteId, placeholder: 'Buscar mascota...' });

      root.querySelector('#f').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = U.formData(ev.target);
        const pid = Number(fd.pacienteId);
        if (!pid) { U.toast('Selecciona un paciente', true); return; }
        const payload = {
          pacienteId: pid,
          fecha: fd.fecha,
          veterinario: fd.veterinario,
          peso: U.numOrNull(fd.peso),
          temperatura: U.numOrNull(fd.temperatura),
          anamnesis: fd.anamnesis,
          tiempoLlenadoCapilar: fd.tiempoLlenadoCapilar,
          turgenciaPiel: fd.turgenciaPiel,
          deshidratacion: fd.deshidratacion,
          motivoConsulta: fd.motivoConsulta,
          sintomas: fd.sintomas,
          diagnostico: fd.diagnostico,
          notas: fd.notas
        };
        if (h) {
          await App.db.update('historias', h.id, payload);
          U.toast('Historia clínica actualizada');
          App.despuesDeGuardar();
          return;
        }
        payload.clinicaId = (App.paciente(pid) || {}).clinicaId || App.sedeParaCrear();
        const nueva = await App.db.create('historias', payload);
        if (fd.actualizarPeso && payload.peso !== null) await App.db.update('pacientes', pid, { peso: payload.peso });
        U.toast('Historia clínica creada');
        App.despuesDeGuardar(`#/historia/${nueva.id}`);
      });

      const del = root.querySelector('#del');
      if (del) del.addEventListener('click', async () => {
        if (!(await U.confirmar('¿Eliminar esta historia clínica?', { peligro: true, aceptar: 'Eliminar' }))) return;
        await App.db.remove('historias', h.id);
        U.toast('Historia clínica eliminada');
        App.ir(p ? `#/paciente/${p.id}?tab=historias` : '#/historias', { reemplazar: true });
      });
    }
  };

  Views.tratamientoForm = {
    titulo: (p) => (p.id ? 'Tratamiento' : 'Agregar medicamento'),
    atras: true,
    render(root, params) {
      const t = params.id ? App.db.getById('tratamientos', params.id) : null;
      const historiaId = t ? t.historiaId : Number(params.historia);
      const h = App.db.getById('historias', historiaId);
      if (!h && !t) { root.innerHTML = U.vacio('❓', 'La consulta ya no existe.'); return; }
      const v = (k, def = '') => (t ? (t[k] ?? '') : def);
      root.innerHTML = `
        <form id="f" class="form">
          ${U.campo({ label: 'Descripción', name: 'descripcion', value: v('descripcion'), required: true, placeholder: 'Ej. Antibiótico, desparasitación...' })}
          ${U.campo({ label: 'Medicamento', name: 'medicamento', value: v('medicamento') })}
          <div class="two">
            ${U.campo({ label: 'Dosis', name: 'dosis', value: v('dosis'), placeholder: 'Ej. 1 tableta' })}
            ${U.campo({ label: 'Frecuencia', name: 'frecuencia', value: v('frecuencia'), placeholder: 'Ej. Cada 12 horas' })}
          </div>
          <div class="two">
            ${U.campo({ label: 'Inicio', name: 'fechaInicio', type: 'date', value: v('fechaInicio', U.todayIso()), required: true })}
            ${U.campo({ label: 'Fin', name: 'fechaFin', type: 'date', value: v('fechaFin') })}
          </div>
          ${U.campo({ label: 'Estado', name: 'estado', type: 'select', value: v('estado', 'activo'), options: ESTADOS_TRAT })}
          ${U.campo({ label: 'Recomendaciones', name: 'recomendaciones', type: 'textarea', value: v('recomendaciones') })}
          ${U.campo({ label: 'Notas', name: 'notas', type: 'textarea', value: v('notas') })}
          <div class="form-actions">
            ${t ? '<button type="button" class="btn danger" id="del">Eliminar</button>' : ''}
            <button type="submit" class="btn">${t ? 'Guardar' : 'Agregar'}</button>
          </div>
        </form>`;
      root.querySelector('#f').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = U.formData(ev.target);
        const payload = {
          descripcion: fd.descripcion, medicamento: fd.medicamento, dosis: fd.dosis, frecuencia: fd.frecuencia,
          fechaInicio: fd.fechaInicio, fechaFin: fd.fechaFin || '', estado: fd.estado,
          recomendaciones: fd.recomendaciones, notas: fd.notas
        };
        if (t) {
          await App.db.update('tratamientos', t.id, payload);
          U.toast('Tratamiento actualizado');
        } else {
          const pac = App.paciente(h.pacienteId);
          await App.db.create('tratamientos', { historiaId: h.id, pacienteId: h.pacienteId, clinicaId: (pac && pac.clinicaId) || h.clinicaId, ...payload });
          U.toast('Medicamento agregado');
        }
        App.despuesDeGuardar();
      });
      const del = root.querySelector('#del');
      if (del) del.addEventListener('click', async () => {
        if (!(await U.confirmar('¿Eliminar este tratamiento?', { peligro: true, aceptar: 'Eliminar' }))) return;
        await App.db.remove('tratamientos', t.id);
        App.volver();
      });
    }
  };
})();
