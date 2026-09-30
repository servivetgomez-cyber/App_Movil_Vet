'use strict';

/*
 * Vacunas: control de próximas dosis, registro y aplicación.
 *
 * Sigue el mismo esquema del escritorio (renderer/js/vacunas.js): cada
 * registro documenta una vacuna aplicada y lleva agendada la siguiente. Al
 * aplicar la dosis agendada se cierra ese registro y, si se encadena, nace el
 * registro de la vacuna recién puesta con su propia próxima dosis. El
 * descuento de inventario se anota en el registro que lo hizo para poder
 * revertirlo.
 */
(function () {
  const { e } = U;
  const INTERVALO_DIAS = 15;
  const INTERVALOS = [['15 días', 15, 'd'], ['21 días', 21, 'd'], ['1 mes', 1, 'm'], ['6 meses', 6, 'm'], ['1 año', 12, 'm']];

  function proximaAuto(fecha) {
    return U.addDaysSkipSunday(fecha || U.todayIso(), INTERVALO_DIAS);
  }

  function fechaMasIntervalo(fecha, [, n, tipo]) {
    return tipo === 'm' ? U.addMonthsIso(fecha, n) : U.addDaysSkipSunday(fecha, n);
  }

  function estadoDe(v) {
    if (v.estadoProximaDosis === 'aplicada') return 'aplicada';
    if (!v.fechaProximaDosis) return null;
    return v.fechaProximaDosis < U.todayIso() ? 'vencida' : 'proxima';
  }

  function fila(v) {
    const p = App.paciente(v.pacienteId);
    const est = estadoDe(v);
    return `<a class="row card-row" href="#/vacuna/${v.id}">
      <div class="avatar">💉</div>
      <div class="grow"><strong>${e(v.nombre || 'Vacuna')}</strong>
        <small>${e(p ? p.nombre : '(paciente eliminado)')} · aplicada ${e(U.formatDate(v.fechaAplicacion))}</small>
        ${v.fechaProximaDosis ? `<small>Próxima: ${e(v.nombreProximaVacuna || v.nombre)} · ${e(U.formatDate(v.fechaProximaDosis))}${est !== 'aplicada' ? ' (' + e(U.relativo(v.fechaProximaDosis)) + ')' : ''}</small>` : ''}
      </div>
      ${est ? U.badge(est) : ''}
    </a>`;
  }

  /** Descuenta (o repone) 1 unidad del artículo y deja el movimiento, como el escritorio. */
  async function ajustarInventario(itemId, aplicada, fecha) {
    if (!itemId) return null;
    const item = App.db.getById('inventario', itemId);
    if (!item) return null;
    const stock = Number(item.stock) || 0;
    if (aplicada) {
      await App.db.moverInventario(item, 'salida', 1, fecha || U.todayIso(), 'Aplicación de vacuna a paciente');
      return `se descontó 1 unidad de "${item.nombre}" (quedan ${Math.max(0, stock - 1)})`;
    }
    await App.db.moverInventario(item, 'entrada', 1, fecha || U.todayIso(), 'Reversión: aplicación de vacuna deshecha');
    return `se repuso 1 unidad de "${item.nombre}" (quedan ${stock + 1})`;
  }

  function opcionesInventario(clinicaId, seleccionado) {
    const items = App.db.getAll('inventario', clinicaId)
      .sort((a, b) => {
        const va = /vacuna/i.test(a.categoria || '') ? 0 : 1;
        const vb = /vacuna/i.test(b.categoria || '') ? 0 : 1;
        return va - vb || a.nombre.localeCompare(b.nombre, 'es');
      });
    return [['', '— Sin descontar del inventario —'], ...items.map((i) => [String(i.id), `${i.nombre} (stock ${i.stock})`])]
      .map(([v, t]) => `<option value="${e(v)}" ${String(v) === String(seleccionado || '') ? 'selected' : ''}>${e(t)}</option>`).join('');
  }

  Views.vacunas = {
    titulo: 'Vacunas',
    tab: 'vacunas',
    fila,
    render(root, params) {
      const f = params.f || 'pendientes';
      const sede = App.sedeId();
      let lista;
      if (f === 'vencidas') lista = App.db.getVacunasVencidas(sede);
      else if (f === 'proximas') lista = App.db.getVacunasProximas(30, sede);
      else if (f === 'pendientes') lista = App.todos('vacunas').filter((v) => v.estadoProximaDosis !== 'aplicada' && v.fechaProximaDosis).sort((a, b) => a.fechaProximaDosis.localeCompare(b.fechaProximaDosis));
      else lista = App.todos('vacunas').sort((a, b) => String(b.fechaAplicacion).localeCompare(String(a.fechaAplicacion)));
      const chip = (id, t) => `<button class="chip ${f === id ? 'on' : ''}" data-f="${id}">${t}</button>`;
      root.innerHTML = `
        <div class="chips">${chip('pendientes', 'Pendientes')}${chip('vencidas', 'Vencidas')}${chip('proximas', 'Próx. 30 días')}${chip('todas', 'Historial')}</div>
        <div class="search-bar"><input type="search" id="q" placeholder="Buscar mascota o vacuna..." /></div>
        <div class="list" id="lista"></div>
        <a class="fab" href="#/vacuna/nueva" aria-label="Registrar vacuna">＋</a>`;
      const pintar = () => {
        const q = U.normalizar(root.querySelector('#q').value);
        const filtrada = lista.filter((v) => {
          if (!q) return true;
          const p = App.paciente(v.pacienteId);
          return U.normalizar([v.nombre, v.nombreProximaVacuna, p && p.nombre].join(' ')).includes(q);
        });
        root.querySelector('#lista').innerHTML = filtrada.length ? filtrada.map(fila).join('') : U.vacio('💉', 'No hay vacunas en esta lista.');
      };
      root.querySelector('#q').addEventListener('input', pintar);
      root.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => App.ir(`#/vacunas?f=${b.dataset.f}`, { reemplazar: true })));
      pintar();
    }
  };

  // --- Registrar / editar ------------------------------------------------------------
  Views.vacunaForm = {
    titulo: (p) => (p.id ? 'Vacuna' : 'Registrar vacuna'),
    atras: true,
    render(root, params) {
      const v = params.id ? App.db.getById('vacunas', params.id) : null;
      if (params.id && !v) { root.innerHTML = U.vacio('❓', 'El registro ya no existe.'); return; }
      const pacienteId = v ? v.pacienteId : (params.paciente ? Number(params.paciente) : '');
      const p = pacienteId ? App.paciente(pacienteId) : null;
      const clinicaInv = (v && v.clinicaId) || (p && p.clinicaId) || App.sedeId();
      const fechaAp = v ? v.fechaAplicacion : U.todayIso();
      const est = v ? estadoDe(v) : null;
      const cli = p && App.cliente(p.clienteId);

      root.innerHTML = `
        ${v ? `<section class="card">
          <h3>${e(p ? p.nombre : '')} · ${e(v.nombre)}</h3>
          <p>${v.fechaProximaDosis ? `Próxima dosis: <strong>${e(v.nombreProximaVacuna || v.nombre)}</strong> el ${e(U.formatDate(v.fechaProximaDosis))} ${est ? U.badge(est) : ''}` : 'Sin próxima dosis agendada.'}</p>
          <div class="actions-row">
            ${est === 'vencida' || est === 'proxima' ? `<a class="btn small" href="#/vacuna/${v.id}/aplicar">✓ Aplicar próxima dosis</a>` : ''}
            ${est === 'aplicada' ? '<button type="button" class="btn secondary small" id="revertir">↩ Volver a pendiente</button>' : ''}
            ${cli && cli.telefono && v.fechaProximaDosis && est !== 'aplicada' ? `<a class="btn secondary small" href="${e(U.whatsappUrl(cli.telefono, `Hola ${cli.nombre}, le recordamos que ${p.nombre} tiene pendiente la vacuna ${v.nombreProximaVacuna || v.nombre} para el ${U.formatDateLong(v.fechaProximaDosis)}.`))}">💬 Recordar por WhatsApp</a>` : ''}
          </div>
        </section>` : ''}
        <form id="f" class="form">
          <label class="field full"><span>Paciente</span><div id="pick"></div></label>
          ${U.campo({ label: 'Vacuna aplicada', name: 'nombre', value: v ? v.nombre : '', required: true, placeholder: 'Ej. Rabia, Parvovirus, Triple felina' })}
          ${U.campo({ label: 'Fecha de aplicación', name: 'fechaAplicacion', type: 'date', value: fechaAp, required: true })}
          <label class="field full"><span>Artículo del inventario</span><select name="itemInventarioId">${opcionesInventario(clinicaInv, v && v.itemInventarioId)}</select></label>
          <label class="check"><input type="checkbox" name="descontarInventario" ${!v || v.descontadoInventario ? 'checked' : ''} /> Descontar 1 unidad del inventario</label>
          ${U.campo({ label: 'Lote', name: 'lote', value: v ? v.lote : '' })}
          ${U.campo({ label: 'Veterinario', name: 'veterinario', value: v ? v.veterinario : '' })}
          <h4 class="form-sub">Próxima dosis</h4>
          ${U.campo({ label: 'Próxima vacuna', name: 'nombreProximaVacuna', value: v ? v.nombreProximaVacuna || '' : '', placeholder: 'Si se deja vacío, se repite la misma' })}
          ${U.campo({ label: 'Fecha próxima dosis', name: 'fechaProximaDosis', type: 'date', value: v ? v.fechaProximaDosis : proximaAuto(fechaAp), hint: `Sugerida: ${INTERVALO_DIAS} días después de la aplicación, sin caer en domingo.` })}
          <div class="chips small" id="intervalos">${INTERVALOS.map((it, i) => `<button type="button" class="chip" data-i="${i}">${it[0]}</button>`).join('')}<button type="button" class="chip" data-i="-1">Sin próxima</button></div>
          ${U.campo({ label: 'Estado de la próxima dosis', name: 'estadoProximaDosis', type: 'select', value: v ? v.estadoProximaDosis || 'pendiente' : 'pendiente', options: [['pendiente', 'Pendiente'], ['aplicada', 'Aplicada']] })}
          ${U.campo({ label: 'Notas', name: 'notas', type: 'textarea', value: v ? v.notas : '' })}
          <div class="form-actions">
            ${v ? '<button type="button" class="btn danger" id="del">Eliminar</button>' : ''}
            <button type="submit" class="btn">${v ? 'Guardar' : 'Registrar'}</button>
          </div>
        </form>`;

      U.selectorBuscable(root.querySelector('#pick'), { name: 'pacienteId', items: App.pacientesParaSelector(), valor: pacienteId, placeholder: 'Buscar mascota...' });

      const form = root.querySelector('#f');
      const fAp = form.elements.fechaAplicacion;
      const fProx = form.elements.fechaProximaDosis;
      let proxManual = Boolean(v && v.fechaProximaDosis);
      fProx.addEventListener('input', () => { proxManual = true; });
      fAp.addEventListener('change', () => { if (!proxManual) fProx.value = proximaAuto(fAp.value); });
      root.querySelectorAll('#intervalos [data-i]').forEach((b) => b.addEventListener('click', () => {
        const i = Number(b.dataset.i);
        fProx.value = i < 0 ? '' : fechaMasIntervalo(fAp.value || U.todayIso(), INTERVALOS[i]);
        proxManual = true;
      }));

      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = U.formData(form);
        const pid = Number(fd.pacienteId);
        if (!pid) { U.toast('Selecciona un paciente', true); return; }
        const itemId = fd.itemInventarioId ? Number(fd.itemInventarioId) : null;
        const debeDescontar = Boolean(itemId && fd.descontarInventario);
        const payload = {
          pacienteId: pid,
          nombre: fd.nombre,
          itemInventarioId: itemId,
          descontadoInventario: debeDescontar,
          fechaAplicacion: fd.fechaAplicacion,
          fechaProximaDosis: fd.fechaProximaDosis || '',
          nombreProximaVacuna: fd.nombreProximaVacuna,
          estadoProximaDosis: fd.estadoProximaDosis,
          lote: fd.lote,
          veterinario: fd.veterinario,
          notas: fd.notas
        };
        let inv = null;
        if (v) {
          const yaDesconto = Boolean(v.descontadoInventario);
          await App.db.update('vacunas', v.id, payload);
          // Solo se toca el stock si cambió lo descontado, para no descontar dos veces.
          if (yaDesconto && Number(v.itemInventarioId) !== itemId) {
            await ajustarInventario(v.itemInventarioId, false, payload.fechaAplicacion);
            if (debeDescontar) inv = await ajustarInventario(itemId, true, payload.fechaAplicacion);
          } else if (debeDescontar && !yaDesconto) {
            inv = await ajustarInventario(itemId, true, payload.fechaAplicacion);
          } else if (!debeDescontar && yaDesconto) {
            inv = await ajustarInventario(v.itemInventarioId, false, payload.fechaAplicacion);
          }
        } else {
          payload.clinicaId = (App.paciente(pid) || {}).clinicaId || App.sedeParaCrear();
          await App.db.create('vacunas', payload);
          if (debeDescontar) inv = await ajustarInventario(itemId, true, payload.fechaAplicacion);
        }
        const base = v ? 'Vacuna actualizada' : 'Vacuna registrada';
        U.toast(inv ? `${base}: ${inv}` : base);
        App.despuesDeGuardar();
      });

      const del = root.querySelector('#del');
      if (del) del.addEventListener('click', async () => {
        if (!(await U.confirmar('¿Eliminar este registro de vacuna?', { peligro: true, aceptar: 'Eliminar' }))) return;
        await App.db.remove('vacunas', v.id);
        U.toast('Registro eliminado');
        App.volver('#/vacunas');
      });

      const rev = root.querySelector('#revertir');
      if (rev) rev.addEventListener('click', () => revertir(v));
    }
  };

  // --- Aplicar la dosis agendada ---------------------------------------------------
  Views.vacunaAplicar = {
    titulo: 'Aplicar dosis',
    atras: true,
    render(root, params) {
      const v = App.db.getById('vacunas', params.id);
      if (!v) { root.innerHTML = U.vacio('❓', 'El registro ya no existe.'); return; }
      const p = App.paciente(v.pacienteId);
      const nombreAplicada = v.nombreProximaVacuna || v.nombre;
      const hoy = U.todayIso();
      root.innerHTML = `
        <section class="card"><h3>${e(p ? p.nombre : '')}</h3><p>Se aplica <strong>${e(nombreAplicada)}</strong> (agendada para el ${e(U.formatDate(v.fechaProximaDosis))}).</p></section>
        <form id="f" class="form">
          ${U.campo({ label: 'Fecha de aplicación', name: 'fechaAplicacion', type: 'date', value: hoy, required: true })}
          <label class="field full"><span>Descontar del inventario</span><select name="itemInventarioId">${opcionesInventario(v.clinicaId, v.itemInventarioId)}</select></label>
          <label class="check"><input type="checkbox" name="encadenar" checked /> Agendar la siguiente dosis del esquema</label>
          <div id="sig">
            ${U.campo({ label: 'Siguiente vacuna', name: 'sigNombre', value: nombreAplicada })}
            ${U.campo({ label: 'Fecha de la siguiente', name: 'sigFecha', type: 'date', value: proximaAuto(hoy), hint: `Sugerida: ${INTERVALO_DIAS} días, sin caer en domingo.` })}
            <div class="chips small" id="intervalos">${INTERVALOS.map((it, i) => `<button type="button" class="chip" data-i="${i}">${it[0]}</button>`).join('')}</div>
          </div>
          <div class="form-actions"><button type="submit" class="btn">✓ Registrar aplicación</button></div>
        </form>`;
      const form = root.querySelector('#f');
      const fAp = form.elements.fechaAplicacion;
      let manual = false;
      form.elements.sigFecha.addEventListener('input', () => { manual = true; });
      fAp.addEventListener('change', () => { if (!manual) form.elements.sigFecha.value = proximaAuto(fAp.value); });
      form.elements.encadenar.addEventListener('change', (ev) => root.querySelector('#sig').classList.toggle('hidden', !ev.target.checked));
      root.querySelectorAll('#intervalos [data-i]').forEach((b) => b.addEventListener('click', () => {
        form.elements.sigFecha.value = fechaMasIntervalo(fAp.value || hoy, INTERVALOS[Number(b.dataset.i)]);
        manual = true;
      }));

      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = U.formData(form);
        const itemId = fd.itemInventarioId ? Number(fd.itemInventarioId) : null;
        const encadena = Boolean(fd.encadenar && fd.sigFecha);
        const inv = await ajustarInventario(itemId, true, fd.fechaAplicacion);
        await App.db.update('vacunas', v.id, {
          estadoProximaDosis: 'aplicada',
          fechaProximaDosis: fd.fechaAplicacion,
          fechaProximaProgramada: v.fechaProximaProgramada || v.fechaProximaDosis || '',
          itemDosisSiguienteId: encadena ? null : itemId,
          descontoDosisSiguiente: encadena ? false : Boolean(itemId)
        });
        if (encadena) {
          await App.db.create('vacunas', {
            clinicaId: v.clinicaId || App.sedeParaCrear(),
            pacienteId: v.pacienteId,
            nombre: nombreAplicada,
            fechaAplicacion: fd.fechaAplicacion,
            itemInventarioId: itemId,
            descontadoInventario: Boolean(itemId),
            fechaProximaDosis: fd.sigFecha,
            nombreProximaVacuna: fd.sigNombre,
            estadoProximaDosis: 'pendiente',
            veterinario: v.veterinario || '',
            lote: '',
            notas: '',
            origenDosisId: v.id,
            encadenada: true
          });
        }
        U.toast(`${nombreAplicada} aplicada${inv ? ': ' + inv : ''}`);
        App.despuesDeGuardar(p ? `#/paciente/${p.id}?tab=vacunas` : '#/vacunas');
      });
    }
  };

  /** Deshace una aplicación, con las mismas reglas del escritorio. */
  async function revertir(record) {
    const hermanas = App.db.by('vacunas', 'pacienteId', record.pacienteId);
    const pendiente = (x) => x.estadoProximaDosis !== 'aplicada';
    const encadenada = hermanas.find((x) => Number(x.origenDosisId) === record.id && x.encadenada && pendiente(x))
      || hermanas.find((x) => Number(x.origenVacunaId) === record.id && x.generadaAuto && pendiente(x))
      || null;
    const yaContinuada = !encadenada && hermanas.some((x) => (Number(x.origenDosisId) === record.id && x.encadenada) || (Number(x.origenVacunaId) === record.id && x.generadaAuto));
    if (encadenada) {
      if (!(await U.confirmar(`Se eliminará el registro de "${encadenada.nombre}" aplicada el ${U.formatDate(encadenada.fechaAplicacion)} y se repondrá al inventario la dosis descontada. ¿Continuar?`))) return;
      await App.db.remove('vacunas', encadenada.id);
    } else if (yaContinuada) {
      if (!(await U.confirmar('De esta dosis ya salió otra vacuna que a su vez se aplicó; ese registro se conserva. ¿Volver de todas formas esta dosis a pendiente?'))) return;
    } else if (!(await U.confirmar('¿Volver esta dosis a pendiente?'))) {
      return;
    }
    const itemARepone = encadenada
      ? (encadenada.descontadoInventario ? encadenada.itemInventarioId : null)
      : (record.descontoDosisSiguiente ? record.itemDosisSiguienteId : null);
    await App.db.update('vacunas', record.id, {
      estadoProximaDosis: 'pendiente',
      fechaProximaDosis: record.fechaProximaProgramada || record.fechaProximaDosis || '',
      fechaProximaProgramada: '',
      itemDosisSiguienteId: null,
      descontoDosisSiguiente: false
    });
    const inv = await ajustarInventario(itemARepone, false, U.todayIso());
    U.toast(inv ? `Dosis marcada como pendiente: ${inv}` : 'Dosis marcada como pendiente');
    App.render();
  }
})();
