'use strict';

/*
 * Respaldos cifrados (.vetenc), compatibles con el programa de escritorio.
 *
 * El escritorio (src/seguridad.js) usa AES-256-GCM con una clave derivada de
 * la contraseña por scrypt (N=32768, r=8, p=1, 32 bytes) y guarda un JSON:
 *   { formato: 'VETENC1', salt, iv, tag, datos }   (todo en base64)
 * Aquí se hace lo mismo con WebCrypto (AES-GCM) y scrypt-js.
 */
(function () {
  const CABECERA = 'VETENC1';
  const SCRYPT = { N: 32768, r: 8, p: 1, dkLen: 32 };

  function b64aBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function bytesAB64(bytes) {
    let bin = '';
    const paso = 0x8000;
    for (let i = 0; i < bytes.length; i += paso) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + paso));
    }
    return btoa(bin);
  }

  async function derivarClave(password, salt, usos) {
    const pw = new TextEncoder().encode(String(password));
    const bruta = await window.scrypt.scrypt(pw, salt, SCRYPT.N, SCRYPT.r, SCRYPT.p, SCRYPT.dkLen);
    return crypto.subtle.importKey('raw', bruta, { name: 'AES-GCM' }, false, usos);
  }

  function esCifrado(texto) {
    try {
      return JSON.parse(texto).formato === CABECERA;
    } catch (_) {
      return false;
    }
  }

  async function descifrar(texto, password) {
    const sobre = JSON.parse(texto);
    if (sobre.formato !== CABECERA) throw new Error('El archivo no está cifrado por el programa.');
    const clave = await derivarClave(password, b64aBytes(sobre.salt), ['decrypt']);
    const datos = b64aBytes(sobre.datos);
    const tag = b64aBytes(sobre.tag);
    // WebCrypto espera la etiqueta GCM pegada al final del texto cifrado.
    const junto = new Uint8Array(datos.length + tag.length);
    junto.set(datos, 0);
    junto.set(tag, datos.length);
    try {
      const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64aBytes(sobre.iv), tagLength: 128 }, clave, junto);
      return new TextDecoder().decode(plano);
    } catch (_) {
      throw new Error('Contraseña incorrecta o archivo alterado.');
    }
  }

  async function cifrar(textoPlano, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const clave = await derivarClave(password, salt, ['encrypt']);
    const salida = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 }, clave, new TextEncoder().encode(textoPlano)
    ));
    const datos = salida.subarray(0, salida.length - 16);
    const tag = salida.subarray(salida.length - 16);
    return JSON.stringify({
      formato: CABECERA,
      salt: bytesAB64(salt),
      iv: bytesAB64(iv),
      tag: bytesAB64(tag),
      datos: bytesAB64(datos)
    });
  }

  window.Cifrado = { esCifrado, cifrar, descifrar };
})();
