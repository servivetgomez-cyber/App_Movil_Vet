'use strict';

/* Pacientes (mascotas) y tutores: listas, fichas y formularios. */
(function () {
  const { e } = U;
  const ESPECIES = ['Perro', 'Gato', 'Ave', 'Conejo', 'Otro'];
  const TIPOS_DOC = [['CC', 'Cédula de ciudadanía'], ['CE', 'Cédula de extranjería'], ['TI', 'Tarjeta de identidad'], ['Pasaporte', 'Pasaporte'], ['NIT', 'NIT'], ['Otro', 'Otro']];

  function avatar(p, clase = '') {
    return p.foto
      ? `<img class="avatar ${clase}" src="${e(p.foto)}" alt="" />`
      : `<div class="avatar ${clase}">${U.especieIcono(p.especie)}</div>`;
  }

  // --- Lista de pacientes ------------------------------------------------------
  Views.pacientes = {
    titulo: 'Pacientes',
    tab: 'pacientes',
    render(root, params) {
      const verInactivos = params.inactivos === '1';
      root.innerHTML = `
        <div class="search-bar"><input type="search" id="q" placeholder="Buscar por nombre, tutor, raza o historia..." value="${e(params.q || '')}" /></div>
        <div class="chips">
          <button class="chip ${verInactivos ? '' : 'on'}" data-in="0">Activos</button>
          <button class="chip ${verInactivos ? 'on' : ''}" data-in="1">Todos</button>
          <a class="chip" href="#/tutores">Tutores ›</a>
        </div>
        <div class="list" id="lista"></div>
        <a class="fab" href="#/paciente/nuevo" aria-label="Nueva mascota">＋</a>`;
      const pintar = () => {
        const q = U.normalizar(root.querySelector('#q').value);
        const lista = App.todos('pacientes')
          .filter((p) => verInactivos || p.activo !== false)
          .filter((p) => {
            if (!q) return true;
            const c = App.cliente(p.clienteId);
            return U.normalizar([p.nombre, p.raza, p.especie, p.historiaClinica, c && c.nombre, c && c.numeroDocumento, c && c.telefono].join(' ')).includes(q);
          })
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        root.querySelector('#lista').innerHTML = lista.length ? lista.map((p) => {
          const c = App.cliente(p.clienteId);
          return `<a class="row card-row" href="#/paciente/${p.id}">
            ${avatar(p)}
            <div class="grow"><strong>${e(p.nombre)}${p.activo === false ? ' <span class="pill">Inactivo</span>' : ''}</strong>
            <small>${e([p.especie, p.raza, U.ageFromBirthdate(p.fechaNacimiento)].filter(Boolean).join(' · '))}</small>
            <small>${e(c ? c.nombre : '')}</small></div><span class="chev">›</span></a>`;
        }).join('') : U.vacio('🐾', 'No se encontraron mascotas.');
      };
      root.querySelector('#q').addEventListener('input', pintar);
      root.querySelectorAll('[data-in]').forEach((b) => b.addEventListener('click', () => {
        App.ir(`#/pacientes?inactivos=${b.dataset.in}&q=${encodeURIComponent(root.querySelector('#q').value)}`, { reemplazar: true });
      }));
      pintar();
    }
  };

  // --- Ficha del paciente ---------------------------------------------------------
  Views.paciente = {
    titulo: 'Ficha del paciente',
    atras: true,
    render(root, params) {
      const p = App.paciente(params.id);
      if (!p) { root.innerHTML = U.vacio('❓', 'La mascota ya no existe.'); return; }
      const c = App.cliente(p.clienteId);
      const tab = params.tab || 'resumen';
      const vacunas = App.db.by('vacunas', 'pacienteId', p.id).sort((a, b) => String(b.fechaAplicacion).localeCompare(String(a.fechaAplicacion)));
      const historias = App.db.by('historias', 'pacienteId', p.id).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      const citas = App.db.by('citas', 'pacienteId', p.id).sort((a, b) => (b.fecha + b.horaInicio).localeCompare(a.fecha + a.horaInicio));
      const tratamientos = App.db.by('tratamientos', 'pacienteId', p.id).filter((t) => t.estado === 'activo');

      const t = (id, texto, n) => `<button class="tab ${tab === id ? 'on' : ''}" data-tab="${id}">${texto}${n !== undefined ? ` <i>${n}</i>` : ''}</button>`;
      root.innerHTML = `
        <div class="profile">
          ${avatar(p, 'big')}
          <div>
            <h2>${e(p.nombre)}</h2>
            <p>${e([p.especie, p.raza, p.sexo].filter(Boolean).join(' · '))}</p>
            <p class="muted">HC ${e(p.historiaClinica || '-')}${p.activo === false ? ' · Inactivo' : ''}</p>
          </div>
        </div>
        <div class="tabs">${t('resumen', 'Resumen')}${t('vacunas', 'Vacunas', vacunas.length)}${t('historias', 'Consultas', historias.length)}${t('citas', 'Citas', citas.length)}</div>
        <div id="tab-body"></div>`;

      const cuerpo = root.querySelector('#tab-body');
      if (tab === 'resumen') {
        cuerpo.innerHTML = `
          <section class="card">
            <dl class="kv">
              <dt>Edad</dt><dd>${e(U.ageFromBirthdate(p.fechaNacimiento) || '-')}${p.fechaNacimiento ? ` <small>(${e(U.formatDate(p.fechaNacimiento))})</small>` : ''}</dd>
              <dt>Peso</dt><dd>${p.peso != null && p.peso !== '' ? e(p.peso) + ' kg' : '-'}</dd>
              <dt>Color</dt><dd>${e(p.color || '-')}</dd>
              <dt>Esterilizado</dt><dd>${p.esterilizado ? 'Sí' : 'No'}</dd>
              ${p.notas ? `<dt>Notas</dt><dd>${e(p.notas)}</dd>` : ''}
            </dl>
          </section>
          ${c ? `<section class="card">
            <h3>Tutor</h3>
            <a class="row" href="#/tutor/${c.id}"><div class="grow"><strong>${e(c.nombre)}</strong><small>${e([c.telefono, c.email].filter(Boolean).join(' · '))}</small></div><span class="chev">›</span></a>
            ${c.telefono ? `<div class="actions-row">
              <a class="btn secondary small" href="tel:${e(c.telefono)}">📞 Llamar</a>
              <a class="btn secondary small" href="${e(U.whatsappUrl(c.telefono, `Hola ${c.nombre}, le escribimos de la clínica veterinaria sobre ${p.nombre}.`))}">💬 WhatsApp</a>
            </div>` : ''}
          </section>` : ''}
          ${tratamientos.length ? `<section class="card"><h3>Tratamientos activos</h3>
            ${tratamientos.map((tr) => `<a class="row" href="#/historia/${tr.historiaId}"><div class="grow"><strong>${e(tr.medicamento || tr.descripcion)}</strong><small>${e([tr.dosis, tr.frecuencia].filter((x) => x && x !== '-').join(' · '))}${tr.fechaFin ? ' · hasta ' + e(U.formatDate(tr.fechaFin)) : ''}</small></div></a>`).join('')}
          </section>` : ''}
          <div class="actions-grid">
            <a class="btn" href="#/historia/nueva?paciente=${p.id}">📋 Nueva consulta</a>
            <a class="btn" href="#/vacuna/nueva?paciente=${p.id}">💉 Registrar vacuna</a>
            <a class="btn secondary" href="#/cita/nueva?paciente=${p.id}">📅 Agendar cita</a>
            <a class="btn secondary" href="#/paciente/${p.id}/editar">✏️ Editar ficha</a>
          </div>`;
      } else if (tab === 'vacunas') {
        cuerpo.innerHTML = `<a class="btn block" href="#/vacuna/nueva?paciente=${p.id}">＋ Registrar vacuna</a>
          <div class="list">${vacunas.length ? vacunas.map(Views.vacunas.fila).join('') : U.vacio('💉', 'Sin vacunas registradas.')}</div>`;
      } else if (tab === 'historias') {
        cuerpo.innerHTML = `<a class="btn block" href="#/historia/nueva?paciente=${p.id}">＋ Nueva consulta</a>
          <div class="list">${historias.length ? historias.map(Views.historias.fila).join('') : U.vacio('📋', 'Sin consultas registradas.')}</div>`;
      } else {
        cuerpo.innerHTML = `<a class="btn block" href="#/cita/nueva?paciente=${p.id}">＋ Agendar cita</a>
          <div class="list">${citas.length ? citas.map((ci) => `<a class="row card-row" href="#/cita/${ci.id}"><div class="time">${e(ci.horaInicio || '')}<small>${e(U.formatDate(ci.fecha))}</small></div><div class="grow"><strong>${e(ci.motivo || 'Cita')}</strong></div>${U.badge(ci.estado)}</a>`).join('') : U.vacio('📅', 'Sin citas.')}</div>`;
      }
      root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => App.ir(`#/paciente/${p.id}?tab=${b.dataset.tab}`, { reemplazar: true })));
    }
  };

  // --- Formulario de paciente -------------------------------------------------------
  Views.pacienteForm = {
    titulo: (p) => (p.id ? 'Editar mascota' : 'Nueva mascota'),
    atras: true,
    render(root, params) {
      const p = params.id ? App.paciente(params.id) : null;
      const clientes = App.todos('clientes').sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      if (!p && !clientes.length) {
        root.innerHTML = U.vacio('🧑', 'Primero registra al tutor de la mascota.', '<a class="btn" href="#/tutor/nuevo?luego=mascota">Registrar tutor</a>');
        return;
      }
      let foto = p ? p.foto || '' : '';
      root.innerHTML = `
        <form id="f" class="form">
          <div class="photo-row">
            <div id="foto-prev"></div>
            <div class="stack">
              <label class="btn secondary small">📷 Tomar / elegir foto<input type="file" accept="image/*" id="foto-in" hidden /></label>
              <button type="button" class="btn secondary small" id="foto-del">Quitar foto</button>
            </div>
          </div>
          ${U.campo({ label: 'Nombre', name: 'nombre', value: p ? p.nombre : '', required: true })}
          <label class="field full"><span>Tutor</span><div id="pick"></div></label>
          <p class="muted small"><a href="#/tutor/nuevo?luego=mascota">＋ Registrar un tutor nuevo</a></p>
          ${p ? U.campo({ label: 'N.º de historia clínica', name: 'historiaClinica', value: p.historiaClinica || '' }) : '<p class="muted small">El número de historia clínica se genera al guardar (documento del tutor + consecutivo), igual que en el programa de escritorio.</p>'}
          <div class="two">
            ${U.campo({ label: 'Especie', name: 'especie', type: 'select', value: p ? p.especie : 'Perro', options: ESPECIES })}
            ${U.campo({ label: 'Sexo', name: 'sexo', type: 'select', value: p ? p.sexo : 'Macho', options: ['Macho', 'Hembra'] })}
          </div>
          ${U.campo({ label: 'Raza', name: 'raza', value: p ? p.raza : '' })}
          <div class="two">
            ${U.campo({ label: 'Fecha de nacimiento', name: 'fechaNacimiento', type: 'date', value: p ? p.fechaNacimiento : '' })}
            ${U.campo({ label: 'Peso (kg)', name: 'peso', type: 'number', step: '0.01', min: '0', value: p ? p.peso : '' })}
          </div>
          ${U.campo({ label: 'Color', name: 'color', value: p ? p.color : '' })}
          <div class="two">
            ${U.campo({ label: 'Esterilizado', name: 'esterilizado', type: 'select', value: p && p.esterilizado ? 'true' : 'false', options: [['true', 'Sí'], ['false', 'No']] })}
            ${U.campo({ label: 'Estado', name: 'activo', type: 'select', value: !p || p.activo !== false ? 'true' : 'false', options: [['true', 'Activo'], ['false', 'Inactivo']] })}
          </div>
          ${U.campo({ label: 'Notas', name: 'notas', type: 'textarea', value: p ? p.notas : '', placeholder: 'Alergias, comportamiento, etc.' })}
          <div class="form-actions">
            ${p ? '<button type="button" class="btn danger" id="del">Eliminar</button>' : ''}
            <button type="submit" class="btn">${p ? 'Guardar' : 'Crear mascota'}</button>
          </div>
        </form>`;

      const pintarFoto = () => {
        root.querySelector('#foto-prev').innerHTML = foto ? `<img class="avatar big" src="${e(foto)}" alt="" />` : `<div class="avatar big">${U.especieIcono(p ? p.especie : 'Perro')}</div>`;
        root.querySelector('#foto-del').classList.toggle('hidden', !foto);
      };
      pintarFoto();
      root.querySelector('#foto-in').addEventListener('change', async (ev) => {
        const file = ev.target.files[0];
        if (!file) return;
        try { foto = await U.leerImagen(file); pintarFoto(); } catch (err) { U.toast(err.message, true); }
        ev.target.value = '';
      });
      root.querySelector('#foto-del').addEventListener('click', () => { foto = ''; pintarFoto(); });

      const clientePre = p ? p.clienteId : (params.cliente ? Number(params.cliente) : '');
      U.selectorBuscable(root.querySelector('#pick'), {
        name: 'clienteId', valor: clientePre, placeholder: 'Buscar tutor...',
        items: clientes.map((c) => ({ id: c.id, label: c.nombre, sub: [c.numeroDocumento, c.telefono].filter(Boolean).join(' · ') }))
      });

      root.querySelector('#f').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = U.formData(ev.target);
        const clienteId = Number(fd.clienteId);
        if (!clienteId) { U.toast('Selecciona un tutor de la lista', true); return; }
        const payload = {
          nombre: fd.nombre,
          clienteId,
          especie: fd.especie,
          raza: fd.raza,
          sexo: fd.sexo,
          fechaNacimiento: fd.fechaNacimiento || '',
          peso: U.numOrNull(fd.peso),
          color: fd.color,
          esterilizado: fd.esterilizado === 'true',
          activo: fd.activo === 'true',
          notas: fd.notas,
          foto
        };
        if (p) {
          payload.historiaClinica = fd.historiaClinica;
          await App.db.update('pacientes', p.id, payload);
          U.toast('Mascota actualizada');
          App.despuesDeGuardar();
        } else {
          // Mismo número de historia clínica que genera el escritorio:
          // documento del tutor + consecutivo guardado en el propio tutor.
          const cli = App.cliente(clienteId);
          const siguiente = ((cli && cli.hcConsecutivo) || 0) + 1;
          await App.db.update('clientes', clienteId, { hcConsecutivo: siguiente });
          payload.historiaClinica = `${(cli && cli.numeroDocumento) || `CLI${clienteId}`}-${String(siguiente).padStart(3, '0')}`;
          payload.clinicaId = (cli && cli.clinicaId) || App.sedeParaCrear();
          const nuevo = await App.db.create('pacientes', payload);
          U.toast(`Mascota creada · HC ${payload.historiaClinica}`);
          App.despuesDeGuardar(`#/paciente/${nuevo.id}`);
        }
      });

      const del = root.querySelector('#del');
      if (del) del.addEventListener('click', async () => {
        if (!(await U.confirmar('¿Eliminar esta mascota? Se conservarán sus registros históricos asociados.', { peligro: true, aceptar: 'Eliminar' }))) return;
        await App.db.remove('pacientes', p.id);
        U.toast('Mascota eliminada');
        App.ir('#/pacientes', { reemplazar: true });
      });
    }
  };

  // --- Tutores -------------------------------------------------------------------------
  Views.tutores = {
    titulo: 'Tutores',
    atras: true,
    render(root) {
      root.innerHTML = `
        <div class="search-bar"><input type="search" id="q" placeholder="Buscar por nombre, documento o teléfono..." /></div>
        <div class="list" id="lista"></div>
        <a class="fab" href="#/tutor/nuevo" aria-label="Nuevo tutor">＋</a>`;
      const pintar = () => {
        const q = U.normalizar(root.querySelector('#q').value);
        const lista = App.todos('clientes')
          .filter((c) => !q || U.normalizar([c.nombre, c.numeroDocumento, c.telefono, c.email].join(' ')).includes(q))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        root.querySelector('#lista').innerHTML = lista.length ? lista.map((c) => {
          const n = App.db.by('pacientes', 'clienteId', c.id).length;
          return `<a class="row card-row" href="#/tutor/${c.id}"><div class="avatar">🧑</div>
            <div class="grow"><strong>${e(c.nombre)}</strong><small>${e([c.telefono, c.numeroDocumento].filter(Boolean).join(' · '))}</small></div>
            <span class="pill">${n} 🐾</span></a>`;
        }).join('') : U.vacio('🧑', 'No se encontraron tutores.');
      };
      root.querySelector('#q').addEventListener('input', pintar);
      pintar();
    }
  };

  Views.tutor = {
    titulo: 'Tutor',
    atras: true,
    render(root, params) {
      const c = App.cliente(params.id);
      if (!c) { root.innerHTML = U.vacio('❓', 'El tutor ya no existe.'); return; }
      const mascotas = App.db.by('pacientes', 'clienteId', c.id);
      const facturas = App.db.by('facturas', 'clienteId', c.id).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      root.innerHTML = `
        <div class="profile"><div class="avatar big">🧑</div><div><h2>${e(c.nombre)}</h2><p class="muted">${e(c.tipoDocumento || '')} ${e(c.numeroDocumento || '')}</p></div></div>
        ${c.telefono ? `<div class="actions-row">
          <a class="btn secondary small" href="tel:${e(c.telefono)}">📞 Llamar</a>
          <a class="btn secondary small" href="${e(U.whatsappUrl(c.telefono, `Hola ${c.nombre}, le escribimos de la clínica veterinaria.`))}">💬 WhatsApp</a>
          ${c.email ? `<a class="btn secondary small" href="mailto:${e(c.email)}">✉️ Correo</a>` : ''}
        </div>` : ''}
        <section class="card"><dl class="kv">
          <dt>Teléfono</dt><dd>${e(c.telefono || '-')}</dd>
          <dt>Email</dt><dd>${e(c.email || '-')}</dd>
          <dt>Dirección</dt><dd>${e(c.direccion || '-')}</dd>
          ${c.notas ? `<dt>Notas</dt><dd>${e(c.notas)}</dd>` : ''}
        </dl></section>
        <section class="card"><h3>Mascotas</h3>
          ${mascotas.length ? mascotas.map((p) => `<a class="row" href="#/paciente/${p.id}">${avatar(p)}<div class="grow"><strong>${e(p.nombre)}</strong><small>${e([p.especie, p.raza].filter(Boolean).join(' · '))}</small></div><span class="chev">›</span></a>`).join('') : '<p class="muted">Sin mascotas registradas.</p>'}
          <a class="btn secondary block" href="#/paciente/nuevo?cliente=${c.id}">＋ Agregar mascota</a>
        </section>
        ${facturas.length ? `<section class="card"><h3>Facturas</h3>${facturas.slice(0, 10).map(Views.facturas.fila).join('')}</section>` : ''}
        <a class="btn secondary block" href="#/tutor/${c.id}/editar">✏️ Editar tutor</a>`;
    }
  };

  Views.tutorForm = {
    titulo: (p) => (p.id ? 'Editar tutor' : 'Nuevo tutor'),
    atras: true,
    render(root, params) {
      const c = params.id ? App.cliente(params.id) : null;
      root.innerHTML = `
        <form id="f" class="form">
          ${U.campo({ label: 'Nombre completo', name: 'nombre', value: c ? c.nombre : '', required: true })}
          <div class="two">
            ${U.campo({ label: 'Tipo de documento', name: 'tipoDocumento', type: 'select', value: c ? c.tipoDocumento || 'CC' : 'CC', options: TIPOS_DOC })}
            ${U.campo({ label: 'Número de documento', name: 'numeroDocumento', value: c ? c.numeroDocumento : '', attrs: 'inputmode="numeric"' })}
          </div>
          ${U.campo({ label: 'Teléfono (WhatsApp)', name: 'telefono', type: 'tel', value: c ? c.telefono : '', placeholder: 'Ej. 300 123 4567', hint: 'Sin indicativo se asume +57 (Colombia). Para otro país escríbelo con +.' })}
          ${U.campo({ label: 'Email', name: 'email', type: 'email', value: c ? c.email : '' })}
          ${U.campo({ label: 'Dirección', name: 'direccion', value: c ? c.direccion : '' })}
          ${U.campo({ label: 'Notas', name: 'notas', type: 'textarea', value: c ? c.notas : '' })}
          <div class="form-actions">
            ${c ? '<button type="button" class="btn danger" id="del">Eliminar</button>' : ''}
            <button type="submit" class="btn">${c ? 'Guardar' : 'Crear tutor'}</button>
          </div>
        </form>`;
      root.querySelector('#f').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = U.formData(ev.target);
        const payload = {
          nombre: fd.nombre, tipoDocumento: fd.tipoDocumento, numeroDocumento: fd.numeroDocumento,
          telefono: fd.telefono, email: fd.email, direccion: fd.direccion, notas: fd.notas
        };
        if (c) {
          await App.db.update('clientes', c.id, payload);
          U.toast('Tutor actualizado');
          App.despuesDeGuardar();
          return;
        }
        const clinicaId = App.sedeParaCrear();
        if (!clinicaId) { U.toast('Elige una sede específica (Más → Sede) antes de crear un tutor', true); return; }
        const nuevo = await App.db.create('clientes', { ...payload, clinicaId, hcConsecutivo: 0 });
        U.toast('Tutor creado');
        App.despuesDeGuardar(params.luego === 'mascota' ? `#/paciente/nuevo?cliente=${nuevo.id}` : `#/tutor/${nuevo.id}`);
      });
      const del = root.querySelector('#del');
      if (del) del.addEventListener('click', async () => {
        const n = App.db.by('pacientes', 'clienteId', c.id).length;
        if (!(await U.confirmar(n ? `Este tutor tiene ${n} mascota(s) registradas. ¿Eliminarlo de todas formas?` : '¿Eliminar este tutor?', { peligro: true, aceptar: 'Eliminar' }))) return;
        await App.db.remove('clientes', c.id);
        U.toast('Tutor eliminado');
        App.ir('#/tutores', { reemplazar: true });
      });
    }
  };
})();
