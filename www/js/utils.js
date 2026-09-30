'use strict';

/* Utilidades de la interfaz: fechas, formato, avisos y formularios. */
(function () {
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const CODIGO_PAIS_WHATSAPP = '57'; // Colombia, igual que el escritorio

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  const e = escapeHtml;

  function todayIso() {
    return VetSchema.fmtDate(new Date());
  }

  function parseIso(iso) {
    return new Date(String(iso).slice(0, 10) + 'T00:00:00');
  }

  function addDaysIso(iso, dias) {
    const d = parseIso(iso);
    d.setDate(d.getDate() + Number(dias || 0));
    return VetSchema.fmtDate(d);
  }

  // Regla de la casa para la próxima dosis: N días después, sin caer en domingo.
  function addDaysSkipSunday(iso, dias) {
    if (!iso) return '';
    const d = parseIso(iso);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + Number(dias || 0));
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return VetSchema.fmtDate(d);
  }

  function addMonthsIso(iso, meses) {
    const d = parseIso(iso);
    d.setMonth(d.getMonth() + Number(meses || 0));
    return VetSchema.fmtDate(d);
  }

  function formatDate(iso) {
    if (!iso) return '-';
    const d = parseIso(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatDateLong(iso) {
    if (!iso) return '-';
    const d = parseIso(iso);
    return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
  }

  function daysUntil(iso) {
    if (!iso) return null;
    return Math.round((parseIso(iso) - parseIso(todayIso())) / 86400000);
  }

  function relativo(iso) {
    const d = daysUntil(iso);
    if (d === null) return '';
    if (d === 0) return 'hoy';
    if (d === 1) return 'mañana';
    if (d === -1) return 'ayer';
    return d > 0 ? `en ${d} días` : `hace ${-d} días`;
  }

  function ageFromBirthdate(iso) {
    if (!iso) return '';
    const nac = parseIso(iso);
    if (Number.isNaN(nac.getTime())) return '';
    const hoy = new Date();
    let meses = (hoy.getFullYear() - nac.getFullYear()) * 12 + (hoy.getMonth() - nac.getMonth());
    if (hoy.getDate() < nac.getDate()) meses--;
    if (meses < 0) return '';
    if (meses < 12) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
    const a = Math.floor(meses / 12);
    return `${a} ${a === 1 ? 'año' : 'años'}`;
  }

  function formatCurrency(v) {
    const n = Number(v) || 0;
    return '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function normalizarTelefonoWhatsApp(telefono) {
    const bruto = String(telefono || '').trim();
    if (!bruto) return '';
    const traeIndicativo = bruto.startsWith('+');
    const digitos = bruto.replace(/\D/g, '');
    if (!digitos) return '';
    if (traeIndicativo) return digitos;
    if (digitos.startsWith('00')) return digitos.slice(2);
    if (digitos.length === 10) return CODIGO_PAIS_WHATSAPP + digitos;
    if (digitos.startsWith(CODIGO_PAIS_WHATSAPP) && digitos.length > 10) return digitos;
    return CODIGO_PAIS_WHATSAPP + digitos;
  }

  function whatsappUrl(telefono, mensaje) {
    return `https://wa.me/${normalizarTelefonoWhatsApp(telefono)}?text=${encodeURIComponent(mensaje || '')}`;
  }

  function especieIcono(especie) {
    return { Perro: '🐶', Gato: '🐱', Ave: '🐦', Conejo: '🐰' }[especie] || '🐾';
  }

  function badge(estado) {
    const etiquetas = {
      pendiente: 'Pendiente', atendida: 'Atendida', cancelada: 'Cancelada',
      pagada: 'Pagada', anulada: 'Anulada', activo: 'Activo', finalizado: 'Finalizado',
      suspendido: 'Suspendido', aplicada: 'Aplicada', vencida: 'Vencida', proxima: 'Próxima'
    };
    return `<span class="badge badge-${e(estado)}">${e(etiquetas[estado] || estado || '-')}</span>`;
  }

  // --- Avisos -----------------------------------------------------------
  let toastTimer = null;
  function toast(mensaje, esError) {
    const el = document.getElementById('toast');
    el.textContent = mensaje;
    el.className = 'toast visible' + (esError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, esError ? 4500 : 2800);
  }

  function dialogo({ titulo, mensaje, html, aceptar = 'Aceptar', cancelar = 'Cancelar', peligro = false, campo = null }) {
    return new Promise((resolve) => {
      const capa = document.createElement('div');
      capa.className = 'dialog-overlay';
      capa.innerHTML = `
        <div class="dialog" role="dialog" aria-modal="true">
          ${titulo ? `<h3>${e(titulo)}</h3>` : ''}
          ${mensaje ? `<p>${e(mensaje).replace(/\n/g, '<br>')}</p>` : ''}
          ${html || ''}
          ${campo ? `<input class="dialog-input" type="${campo.type || 'text'}" placeholder="${e(campo.placeholder || '')}" autocomplete="off" />` : ''}
          <div class="dialog-actions">
            ${cancelar ? `<button type="button" class="btn secondary" data-r="no">${e(cancelar)}</button>` : ''}
            <button type="button" class="btn ${peligro ? 'danger' : ''}" data-r="si">${e(aceptar)}</button>
          </div>
        </div>`;
      document.body.appendChild(capa);
      const input = capa.querySelector('.dialog-input');
      if (input) setTimeout(() => input.focus(), 50);
      const cerrar = (valor) => { capa.remove(); resolve(valor); };
      capa.querySelector('[data-r="si"]').addEventListener('click', () => cerrar(input ? input.value : true));
      const no = capa.querySelector('[data-r="no"]');
      if (no) no.addEventListener('click', () => cerrar(input ? null : false));
      if (input) input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') cerrar(input.value); });
    });
  }

  /** Diálogo con varias opciones: devuelve el id elegido o null. */
  function elegir({ titulo, mensaje, opciones }) {
    return new Promise((resolve) => {
      const capa = document.createElement('div');
      capa.className = 'dialog-overlay';
      capa.innerHTML = `
        <div class="dialog" role="dialog" aria-modal="true">
          ${titulo ? `<h3>${e(titulo)}</h3>` : ''}
          ${mensaje ? `<p>${e(mensaje).replace(/\n/g, '<br>')}</p>` : ''}
          <div class="dialog-options">
            ${opciones.map((o) => `<button type="button" class="btn ${o.estilo || ''} block" data-id="${e(o.id)}">${e(o.texto)}</button>`).join('')}
            <button type="button" class="btn secondary block" data-id="">Cancelar</button>
          </div>
        </div>`;
      document.body.appendChild(capa);
      capa.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => {
        capa.remove();
        resolve(b.dataset.id || null);
      }));
    });
  }

  function confirmar(mensaje, opciones = {}) {
    return dialogo({ titulo: opciones.titulo || '¿Estás seguro?', mensaje, aceptar: opciones.aceptar || 'Sí', peligro: opciones.peligro });
  }

  function cargando(mensaje) {
    const capa = document.createElement('div');
    capa.className = 'dialog-overlay';
    capa.innerHTML = `<div class="dialog loading"><div class="spinner"></div><p>${e(mensaje)}</p></div>`;
    document.body.appendChild(capa);
    return () => capa.remove();
  }

  // --- Formularios --------------------------------------------------------
  /**
   * Genera un campo de formulario. tipo: text, number, date, time, tel,
   * email, textarea, select. opciones: [[valor, etiqueta], ...] o ['a', 'b'].
   */
  function campo({ label, name, type = 'text', value = '', options = null, required = false, placeholder = '', step, min, hint, full = true, attrs = '' }) {
    const req = required ? 'required' : '';
    const ph = placeholder ? `placeholder="${e(placeholder)}"` : '';
    let control;
    if (type === 'textarea') {
      control = `<textarea name="${name}" ${ph} ${req} ${attrs}>${e(value)}</textarea>`;
    } else if (type === 'select') {
      control = `<select name="${name}" ${req} ${attrs}>${(options || []).map((o) => {
        const [v, t] = Array.isArray(o) ? o : [o, o];
        return `<option value="${e(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${e(t)}</option>`;
      }).join('')}</select>`;
    } else {
      const extra = [step !== undefined ? `step="${step}"` : '', min !== undefined ? `min="${min}"` : ''].join(' ');
      const inputmode = type === 'number' ? 'inputmode="decimal"' : '';
      control = `<input type="${type}" name="${name}" value="${e(value ?? '')}" ${ph} ${req} ${extra} ${inputmode} ${attrs} />`;
    }
    return `<label class="field ${full ? 'full' : ''}"><span>${e(label)}</span>${control}${hint ? `<small>${hint}</small>` : ''}</label>`;
  }

  function formData(form) {
    const fd = new FormData(form);
    const out = {};
    for (const [k, v] of fd.entries()) out[k] = typeof v === 'string' ? v.trim() : v;
    return out;
  }

  function numOrNull(v) {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Selector con búsqueda: un campo de texto que filtra una lista y guarda el
   * id elegido en un input oculto. items: [{ id, label, sub }].
   */
  function selectorBuscable(contenedor, { name, items, valor, placeholder, onChange }) {
    const actual = items.find((i) => String(i.id) === String(valor));
    contenedor.innerHTML = `
      <div class="picker">
        <input type="search" class="picker-input" placeholder="${e(placeholder || 'Buscar...')}" value="${actual ? e(actual.label) : ''}" autocomplete="off" />
        <input type="hidden" name="${name}" value="${actual ? e(actual.id) : ''}" />
        <div class="picker-list hidden"></div>
      </div>`;
    const input = contenedor.querySelector('.picker-input');
    const oculto = contenedor.querySelector('input[type=hidden]');
    const lista = contenedor.querySelector('.picker-list');
    const pintar = () => {
      const q = normalizar(input.value);
      const filtrados = items.filter((i) => !q || normalizar(i.label + ' ' + (i.sub || '')).includes(q)).slice(0, 40);
      lista.innerHTML = filtrados.length
        ? filtrados.map((i) => `<button type="button" class="picker-item" data-id="${e(i.id)}"><strong>${e(i.label)}</strong>${i.sub ? `<small>${e(i.sub)}</small>` : ''}</button>`).join('')
        : '<div class="picker-empty">Sin resultados</div>';
      lista.classList.remove('hidden');
    };
    input.addEventListener('focus', pintar);
    input.addEventListener('input', () => { oculto.value = ''; pintar(); });
    lista.addEventListener('click', (ev) => {
      const b = ev.target.closest('.picker-item');
      if (!b) return;
      const item = items.find((i) => String(i.id) === b.dataset.id);
      input.value = item.label;
      oculto.value = item.id;
      lista.classList.add('hidden');
      if (onChange) onChange(item);
    });
    document.addEventListener('click', (ev) => {
      if (!contenedor.contains(ev.target)) lista.classList.add('hidden');
    });
  }

  function normalizar(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /** Reduce una foto a JPEG (máx. 800 px), como hace el escritorio. */
  function leerImagen(file, max = 800) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) return reject(new Error('El archivo no es una imagen'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Imagen no válida'));
        img.onload = () => {
          const escala = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * escala);
          canvas.height = Math.round(img.height * escala);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function leerArchivoTexto(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('No se pudo leer el archivo'));
      r.readAsText(file, 'utf-8');
    });
  }

  function vacio(icono, texto, extra = '') {
    return `<div class="empty"><div class="empty-icon">${icono}</div><p>${e(texto)}</p>${extra}</div>`;
  }

  window.U = {
    e, escapeHtml, todayIso, parseIso, addDaysIso, addDaysSkipSunday, addMonthsIso,
    formatDate, formatDateLong, daysUntil, relativo, ageFromBirthdate, formatCurrency,
    normalizarTelefonoWhatsApp, whatsappUrl, especieIcono, badge,
    toast, dialogo, elegir, confirmar, cargando, campo, formData, numOrNull,
    selectorBuscable, normalizar, leerImagen, leerArchivoTexto, vacio, MESES, DIAS
  };
})();
