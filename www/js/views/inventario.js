'use strict';

/* Inventario (con entradas/salidas), facturas, certificados y calculadora de dosis. */
(function () {
  const { e } = U;

  function margen(compra, venta) {
    const c = Number(compra) || 0;
    const v = Number(venta) || 0;
    if (c <= 0) return null;
    return Math.round(((v - c) / c) * 100 * 100) / 100;
  }

  Views.inventario = {
    titulo: 'Inventario',
    atras: true,
    render(root, params) {
      const soloBajo = params.f === 'bajo';
      root.innerHTML = `
        <div class="chips">
          <button class="chip ${soloBajo ? '' : 'on'}" data-f="">Todo</button>
          <button class="chip ${soloBajo ? 'on' : ''}" data-f="bajo">Stock bajo</button>
        </div>
        <div class="search-bar"><input type="search" id="q" placeholder="Buscar insumo, categoría o proveedor..." /></div>
        <div class="list" id="lista"></div>
        <a class="fab" href="#/insumo/nuevo" aria-label="Nuevo insumo">＋</a>`;
      const base = App.todos('inventario').filter((i) => !soloBajo || Number(i.stock) <= Number(i.stockMinimo));
      const pintar = () => {
        const q = U.normalizar(root.querySelector('#q').value);
        const lista = base.filter((i) => !q || U.normalizar([i.nombre, i.categoria, i.proveedor].join(' ')).includes(q))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        root.querySelector('#lista').innerHTML = lista.length ? lista.map((i) => {
          const bajo = Number(i.stock) <= Number(i.stockMinimo);
          return `<a class="row card-row" href="#/insumo/${i.id}"><div class="avatar">📦</div>
            <div class="grow"><strong>${e(i.nombre)}</strong><small>${e([i.categoria, U.formatCurrency(i.precioVenta)].filter(Boolean).join(' · '))}</small></div>
            <span class="pill ${bajo ? 'warn' : ''}">${e(i.stock)} ${e(i.unidad || '')}</span></a>`;
        }).join('') : U.vacio('📦', 'No hay insumos en esta lista.');
      };
      root.querySelector('#q').addEventListener('input', pintar);
      root.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => App.ir(`#/inventario${b.dataset.f ? '?f=' + b.dataset.f : ''}`, { reemplazar: true })));
      pintar();
    }
  };

  Views.insumo = {
    titulo: 'Insumo',
    atras: true,
    render(root, params) {
      const i = App.db.getById('inventario', params.id);
      if (!i) { root.innerHTML = U.vacio('❓', 'El insumo ya no existe.'); return; }
      const movs = App.db.by('movimientosInventario', 'itemId', i.id).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || b.id - a.id);
      const bajo = Number(i.stock) <= Number(i.stockMinimo);
      const m = margen(i.precioCompra, i.precioVenta);
      root.innerHTML = `
        <section class="card center">
          <h3>${e(i.nombre)}</h3>
          <div class="big-number ${bajo ? 'warn' : ''}">${e(i.stock)} <small>${e(i.unidad || '')}</small></div>
          <p class="muted">Mínimo: ${e(i.stockMinimo)} ${e(i.unidad || '')}${bajo ? ' · <strong>stock bajo</strong>' : ''}</p>
          <div class="actions-row center">
            <a class="btn" href="#/insumo/${i.id}/movimiento?tipo=entrada">＋ Entrada</a>
            <a class="btn secondary" href="#/insumo/${i.id}/movimiento?tipo=salida">－ Salida</a>
          </div>
        </section>
        <section class="card"><dl class="kv">
          <dt>Categoría</dt><dd>${e(i.categoria || '-')}</dd>
          <dt>Precio compra</dt><dd>${e(U.formatCurrency(i.precioCompra))}</dd>
          <dt>Precio venta</dt><dd>${e(U.formatCurrency(i.precioVenta))}</dd>
          <dt>Margen</dt><dd>${m === null ? '-' : e(m) + ' %'}</dd>
          <dt>Proveedor</dt><dd>${e(i.proveedor || '-')}</dd>
          ${i.notas ? `<dt>Notas</dt><dd>${e(i.notas)}</dd>` : ''}
        </dl><a class="btn secondary small" href="#/insumo/${i.id}/editar">✏️ Editar insumo</a></section>
        <section class="card"><h3>Movimientos</h3>
          ${movs.length ? movs.slice(0, 50).map((mv) => `<div class="row"><div class="grow"><strong>${mv.tipo === 'entrada' ? '＋' : '－'} ${e(mv.cantidad)} ${e(i.unidad || '')}</strong><small>${e(mv.motivo || '')}</small></div><small class="muted">${e(U.formatDate(mv.fecha))}</small></div>`).join('') : '<p class="muted">Sin movimientos.</p>'}
        </section>`;
    }
  };

  Views.insumoForm = {
    titulo: (p) => (p.id ? 'Editar insumo' : 'Nuevo insumo'),
    atras: true,
    render(root, params) {
      const i = params.id ? App.db.getById('inventario', params.id) : null;
      const v = (k, def = '') => (i ? (i[k] ?? '') : def);
      root.innerHTML = `
        <form id="f" class="form">
          ${U.campo({ label: 'Nombre', name: 'nombre', value: v('nombre'), required: true })}
          <div class="two">
            ${U.campo({ label: 'Categoría', name: 'categoria', value: v('categoria'), placeholder: 'Ej. Vacuna, Antibiótico' })}
            ${U.campo({ label: 'Unidad', name: 'unidad', value: v('unidad'), placeholder: 'Ej. dosis, tabletas' })}
          </div>
          <div class="two">
            ${U.campo({ label: 'Stock actual', name: 'stock', type: 'number', step: 'any', min: '0', value: v('stock', 0), required: true })}
            ${U.campo({ label: 'Stock mínimo', name: 'stockMinimo', type: 'number', step: 'any', min: '0', value: v('stockMinimo', 0) })}
          </div>
          <div class="two">
            ${U.campo({ label: 'Precio compra', name: 'precioCompra', type: 'number', step: 'any', min: '0', value: v('precioCompra', 0) })}
            ${U.campo({ label: 'Precio venta', name: 'precioVenta', type: 'number', step: 'any', min: '0', value: v('precioVenta', 0) })}
          </div>
          ${U.campo({ label: 'Proveedor', name: 'proveedor', value: v('proveedor') })}
          ${U.campo({ label: 'Notas', name: 'notas', type: 'textarea', value: v('notas') })}
          <div class="form-actions">
            ${i ? '<button type="button" class="btn danger" id="del">Eliminar</button>' : ''}
            <button type="submit" class="btn">${i ? 'Guardar' : 'Crear insumo'}</button>
          </div>
        </form>`;
      root.querySelector('#f').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = U.formData(ev.target);
        const precioCompra = U.numOrNull(fd.precioCompra) || 0;
        const precioVenta = U.numOrNull(fd.precioVenta) || 0;
        const payload = {
          nombre: fd.nombre, categoria: fd.categoria, unidad: fd.unidad,
          stock: U.numOrNull(fd.stock) || 0, stockMinimo: U.numOrNull(fd.stockMinimo) || 0,
          precioCompra, precioVenta, margenUtilidad: margen(precioCompra, precioVenta),
          proveedor: fd.proveedor, notas: fd.notas
        };
        if (i) {
          await App.db.update('inventario', i.id, payload);
          // Igual que el escritorio: cada cambio de precio queda fechado.
          const cA = Number(i.precioCompra) || 0;
          const vA = Number(i.precioVenta) || 0;
          if (cA !== precioCompra || vA !== precioVenta) {
            await App.db.create('historialPrecios', {
              itemId: i.id, clinicaId: i.clinicaId, fecha: U.todayIso(), inicial: false,
              precioCompraAnterior: cA, precioVentaAnterior: vA, margenAnterior: margen(cA, vA),
              precioCompra, precioVenta, margenUtilidad: payload.margenUtilidad
            });
          }
          U.toast('Insumo actualizado');
          App.despuesDeGuardar();
          return;
        }
        const clinicaId = App.sedeParaCrear();
        if (!clinicaId) { U.toast('Elige una sede específica (Más → Sede) antes de crear un insumo', true); return; }
        const creado = await App.db.create('inventario', { ...payload, clinicaId });
        await App.db.create('historialPrecios', {
          itemId: creado.id, clinicaId, fecha: U.todayIso(), inicial: true,
          precioCompraAnterior: null, precioVentaAnterior: null, margenAnterior: null,
          precioCompra, precioVenta, margenUtilidad: payload.margenUtilidad
        });
        U.toast('Insumo creado');
        App.despuesDeGuardar(`#/insumo/${creado.id}`);
      });
      const del = root.querySelector('#del');
      if (del) del.addEventListener('click', async () => {
        if (!(await U.confirmar('¿Eliminar este insumo del inventario?', { peligro: true, aceptar: 'Eliminar' }))) return;
        await App.db.remove('inventario', i.id);
        U.toast('Insumo eliminado');
        App.ir('#/inventario', { reemplazar: true });
      });
    }
  };

  Views.movimiento = {
    titulo: (p) => (p.tipo === 'salida' ? 'Salida de inventario' : 'Entrada a inventario'),
    atras: true,
    render(root, params) {
      const i = App.db.getById('inventario', params.id);
      if (!i) { root.innerHTML = U.vacio('❓', 'El insumo ya no existe.'); return; }
      const entrada = params.tipo !== 'salida';
      root.innerHTML = `
        <section class="card"><h3>${e(i.nombre)}</h3><p>Stock actual: <strong>${e(i.stock)} ${e(i.unidad || '')}</strong></p></section>
        <form id="f" class="form">
          ${U.campo({ label: 'Cantidad', name: 'cantidad', type: 'number', step: 'any', min: '0', required: true })}
          ${U.campo({ label: 'Fecha', name: 'fecha', type: 'date', value: U.todayIso(), required: true })}
          ${U.campo({ label: 'Motivo', name: 'motivo', placeholder: entrada ? 'Ej. Compra a proveedor' : 'Ej. Aplicación a paciente, vencimiento' })}
          <div class="form-actions"><button class="btn" type="submit">${entrada ? 'Ingresar' : 'Dar de baja'}</button></div>
        </form>`;
      root.querySelector('#f').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = U.formData(ev.target);
        const cantidad = U.numOrNull(fd.cantidad) || 0;
        if (cantidad <= 0) { U.toast('La cantidad debe ser mayor a cero', true); return; }
        if (!entrada && cantidad > Number(i.stock)) { U.toast('No hay suficiente stock para dar de baja esa cantidad', true); return; }
        await App.db.moverInventario(i, entrada ? 'entrada' : 'salida', cantidad, fd.fecha, fd.motivo);
        U.toast(entrada ? 'Artículos ingresados' : 'Artículos dados de baja');
        App.despuesDeGuardar();
      });
    }
  };

  // --- Facturas (consulta) --------------------------------------------------------
  function totalFactura(f) {
    if (typeof f.total === 'number') return f.total;
    return (f.items || []).reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.precioUnitario) || 0), 0);
  }

  function filaFactura(f) {
    const c = App.cliente(f.clienteId);
    return `<a class="row card-row" href="#/factura/${f.id}">
      <div class="grow"><strong>${e(f.numero || '#' + f.id)} · ${e(U.formatCurrency(totalFactura(f)))}</strong><small>${e(c ? c.nombre : '')} · ${e(U.formatDate(f.fecha))}</small></div>
      ${U.badge(f.estado)}</a>`;
  }

  Views.facturas = {
    titulo: 'Facturas',
    atras: true,
    fila: filaFactura,
    render(root, params) {
      const f = params.f || 'todas';
      const todas = App.todos('facturas').sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || b.id - a.id);
      const lista = f === 'todas' ? todas : todas.filter((x) => x.estado === f);
      const pendiente = todas.filter((x) => x.estado === 'pendiente').reduce((s, x) => s + (Number(x.saldoConInteres) || totalFactura(x)), 0);
      const chip = (id, t) => `<button class="chip ${f === id ? 'on' : ''}" data-f="${id}">${t}</button>`;
      root.innerHTML = `
        <div class="stats two-col"><div class="stat"><strong>${todas.filter((x) => x.estado === 'pendiente').length}</strong><span>Pendientes</span></div><div class="stat"><strong class="small-num">${e(U.formatCurrency(pendiente))}</strong><span>Por cobrar</span></div></div>
        <div class="chips">${chip('todas', 'Todas')}${chip('pendiente', 'Pendientes')}${chip('pagada', 'Pagadas')}${chip('anulada', 'Anuladas')}</div>
        <div class="search-bar"><input type="search" id="q" placeholder="Buscar número o cliente..." /></div>
        <div class="list" id="lista"></div>
        <p class="muted small center">Las facturas se crean y cobran en el programa de escritorio, que lleva la caja y la contabilidad.</p>`;
      const pintar = () => {
        const q = U.normalizar(root.querySelector('#q').value);
        const filtrada = lista.filter((x) => {
          if (!q) return true;
          const c = App.cliente(x.clienteId);
          return U.normalizar([x.numero, c && c.nombre].join(' ')).includes(q);
        }).slice(0, 200);
        root.querySelector('#lista').innerHTML = filtrada.length ? filtrada.map(filaFactura).join('') : U.vacio('🧾', 'No hay facturas.');
      };
      root.querySelector('#q').addEventListener('input', pintar);
      root.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => App.ir(`#/facturas?f=${b.dataset.f}`, { reemplazar: true })));
      pintar();
    }
  };

  Views.factura = {
    titulo: 'Factura',
    atras: true,
    render(root, params) {
      const f = App.db.getById('facturas', params.id);
      if (!f) { root.innerHTML = U.vacio('❓', 'La factura ya no existe.'); return; }
      const c = App.cliente(f.clienteId);
      const p = f.pacienteId ? App.paciente(f.pacienteId) : null;
      const abonos = App.db.getAll('abonos').filter((a) => a.facturaId === f.id);
      const abonado = abonos.reduce((s, a) => s + (Number(a.monto) || 0), 0);
      root.innerHTML = `
        <section class="card">
          <h3>${e(f.numero || 'Factura')} ${U.badge(f.estado)}</h3>
          <p class="muted">${e(U.formatDate(f.fecha))} · ${c ? `<a href="#/tutor/${c.id}">${e(c.nombre)}</a>` : ''}${p ? ' · ' + e(p.nombre) : ''}</p>
          <table class="table">
            <thead><tr><th>Concepto</th><th>Cant.</th><th>Valor</th></tr></thead>
            <tbody>${(f.items || []).map((it) => `<tr><td>${e(it.concepto)}</td><td>${e(it.cantidad)}</td><td>${e(U.formatCurrency((Number(it.cantidad) || 0) * (Number(it.precioUnitario) || 0)))}</td></tr>`).join('')}</tbody>
            <tfoot><tr><th colspan="2">Total</th><th>${e(U.formatCurrency(totalFactura(f)))}</th></tr></tfoot>
          </table>
          <dl class="kv">
            <dt>Modalidad</dt><dd>${e(f.modalidadPago === 'credito' ? 'Crédito' : 'Contado')}</dd>
            ${f.metodoPago ? `<dt>Método de pago</dt><dd>${e(f.metodoPago)}</dd>` : ''}
            ${f.fechaVencimiento ? `<dt>Vence</dt><dd>${e(U.formatDate(f.fechaVencimiento))}</dd>` : ''}
            ${Number(f.interesAcumulado) ? `<dt>Interés acumulado</dt><dd>${e(U.formatCurrency(f.interesAcumulado))}</dd>` : ''}
            ${abonos.length ? `<dt>Abonado</dt><dd>${e(U.formatCurrency(abonado))}</dd>` : ''}
            ${f.notas ? `<dt>Notas</dt><dd>${e(f.notas)}</dd>` : ''}
          </dl>
        </section>
        ${c && c.telefono && f.estado === 'pendiente' ? `<a class="btn secondary block" href="${e(U.whatsappUrl(c.telefono, `Hola ${c.nombre}, le recordamos que la factura ${f.numero || ''} por ${U.formatCurrency(totalFactura(f))} está pendiente de pago.`))}">💬 Recordar pago por WhatsApp</a>` : ''}`;
    }
  };

  // --- Certificados (consulta) ---------------------------------------------------------
  Views.certificados = {
    titulo: 'Certificados',
    atras: true,
    render(root) {
      const lista = App.todos('certificados').sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      root.innerHTML = `<div class="list">${lista.length ? lista.map((c) => {
        const p = App.paciente(c.pacienteId);
        return `<details class="card"><summary><strong>${e(c.tipoCertificado || 'Certificado')}</strong> · ${e(p ? p.nombre : '')}<small class="muted"> ${e(U.formatDate(c.fecha))}</small></summary>
          <p>${e(c.declaracion || '')}</p>
          <p class="muted small">${e(c.medicoNombre || '')}${c.medicoLicencia ? ' · ' + e(c.medicoLicencia) : ''}${c.fechaVigencia ? ' · vigente hasta ' + e(U.formatDate(c.fechaVigencia)) : ''}</p></details>`;
      }).join('') : U.vacio('📜', 'No hay certificados.')}</div>
      <p class="muted small center">Los certificados se emiten e imprimen desde el programa de escritorio.</p>`;
    }
  };

  // --- Calculadora de dosis ------------------------------------------------------------
  // Evalúa sin eval() las expresiones importadas del Excel (números, "peso", + - * / y paréntesis).
  function evalExpr(expr, peso) {
    const tokens = [];
    const re = /\s*(peso|\d+(?:\.\d+)?|[()+\-*/])\s*/g;
    let idx = 0;
    while (idx < expr.length) {
      re.lastIndex = idx;
      const m = re.exec(expr);
      if (!m || m.index !== idx) throw new Error('Expresión inválida');
      tokens.push(m[1]);
      idx = re.lastIndex;
    }
    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];
    function expr_() {
      let v = term();
      while (peek() === '+' || peek() === '-') { const op = next(); const r = term(); v = op === '+' ? v + r : v - r; }
      return v;
    }
    function term() {
      let v = factor();
      while (peek() === '*' || peek() === '/') { const op = next(); const r = factor(); v = op === '*' ? v * r : v / r; }
      return v;
    }
    function factor() {
      const t = next();
      if (t === '(') { const v = expr_(); if (next() !== ')') throw new Error('Expresión inválida'); return v; }
      if (t === '-') return -factor();
      if (t === 'peso') return peso;
      const n = Number(t);
      if (Number.isNaN(n)) throw new Error('Expresión inválida');
      return n;
    }
    const r = expr_();
    if (pos !== tokens.length) throw new Error('Expresión inválida');
    return r;
  }

  function formatoDosis(n) {
    if (!Number.isFinite(n)) return '-';
    let s = n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    if (s === '' || s === '-0') s = '0';
    return s.replace('.', ',');
  }

  function textoDosis(tokens, peso) {
    return tokens.map((t) => {
      if (t.t === 'lit') return t.v;
      try { return formatoDosis(evalExpr(t.v, peso)); } catch (_) { return '?'; }
    }).join('');
  }

  const ESPECIE_A_DOSIS = { Perro: 'Canino', Gato: 'Felino' };

  Views.dosis = {
    titulo: 'Calculadora de dosis',
    atras: true,
    render(root) {
      const lista = App.db.getAll('medicamentosDosis');
      if (!lista.length) {
        root.innerHTML = U.vacio('💊', 'Aún no hay medicamentos cargados.', '<p class="muted">Importa tu Excel de dosis en el programa de escritorio (Calculadora de dosis → Importar desde Excel) y luego pasa el archivo de datos al móvil. La lista viaja dentro del mismo archivo.</p>');
        return;
      }
      root.innerHTML = `
        <form class="form" id="f">
          <label class="field full"><span>Medicamento / presentación</span><div id="pick-med"></div></label>
          <label class="field full"><span>Paciente (opcional, completa peso y especie)</span><div id="pick-pac"></div></label>
          <div class="two">
            <label class="field"><span>Especie</span><select id="especie"><option value="">Elige un medicamento</option></select></label>
            ${U.campo({ label: 'Peso (kg)', name: 'peso', type: 'number', step: '0.01', min: '0', attrs: 'id="peso"' })}
          </div>
        </form>
        <div id="resultado"></div>`;
      root.querySelector('#f').addEventListener('submit', (ev) => ev.preventDefault());
      let med = null;
      const especieSel = root.querySelector('#especie');
      const pesoIn = root.querySelector('#peso');
      const calcular = () => {
        const out = root.querySelector('#resultado');
        if (!med) { out.innerHTML = ''; return; }
        const peso = U.numOrNull(pesoIn.value);
        const esp = especieSel.value;
        out.innerHTML = `<section class="card">
          <h3>${e(med.presentacion)}</h3>
          ${med.uso ? `<p class="muted">${e(med.uso)}</p>` : ''}
          ${med.dosisTexto && med.dosisTexto[esp] ? `<p><strong>Referencia:</strong> ${e(med.dosisTexto[esp])}</p>` : ''}
          ${esp && peso ? `<div class="dose">${e(textoDosis(med.formulas[esp] || [], peso))}</div>` : '<p class="muted">Escribe el peso y elige la especie para calcular.</p>'}
        </section>`;
      };
      const pintarEspecies = (preferida) => {
        const especies = Object.keys(med.formulas || {});
        especieSel.innerHTML = especies.map((s) => `<option ${s === preferida ? 'selected' : ''}>${e(s)}</option>`).join('');
      };
      U.selectorBuscable(root.querySelector('#pick-med'), {
        name: 'med', placeholder: 'Buscar medicamento...',
        items: lista.map((m) => ({ id: m.id, label: `${m.medicamento} — ${m.presentacion}`, sub: m.uso || '' })),
        onChange: (it) => { med = lista.find((m) => m.id === it.id); pintarEspecies(especieSel.value); calcular(); }
      });
      U.selectorBuscable(root.querySelector('#pick-pac'), {
        name: 'pac', placeholder: 'Buscar mascota...', items: App.pacientesParaSelector(),
        onChange: (it) => {
          const p = App.paciente(it.id);
          if (p && p.peso) pesoIn.value = p.peso;
          if (med && p && ESPECIE_A_DOSIS[p.especie]) pintarEspecies(ESPECIE_A_DOSIS[p.especie]);
          calcular();
        }
      });
      especieSel.addEventListener('change', calcular);
      pesoIn.addEventListener('input', calcular);
    }
  };

  Views.dosis.textoDosis = textoDosis;
})();
