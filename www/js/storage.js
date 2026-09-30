'use strict';

/*
 * Dónde vive el archivo de datos en el móvil.
 *
 * En Android se usa el almacenamiento privado de la app (Capacitor
 * Filesystem, Directory.Data): nadie más que la app lo puede leer y no se
 * borra al actualizarla. En un navegador (para probar la interfaz en el
 * computador) se usa localStorage.
 */
(function () {
  const ARCHIVO = 'vetclinic-data.json';
  const RESPALDO = 'vetclinic-data.antes-de-importar.json';

  const cap = window.Capacitor;
  const esNativo = Boolean(cap && cap.isNativePlatform && cap.isNativePlatform());

  function plugin(nombre) {
    if (!esNativo) return null;
    if (cap.Plugins && cap.Plugins[nombre]) return cap.Plugins[nombre];
    return cap.registerPlugin ? cap.registerPlugin(nombre) : null;
  }

  const Filesystem = plugin('Filesystem');
  const Share = plugin('Share');
  const LocalNotifications = plugin('LocalNotifications');

  async function leerNativo(nombre) {
    try {
      const res = await Filesystem.readFile({ path: nombre, directory: 'DATA', encoding: 'utf8' });
      return res.data;
    } catch (_) {
      return null;
    }
  }

  async function escribirNativo(nombre, texto) {
    // Primero a un temporal y luego se renombra: si el móvil se apaga a mitad
    // de la escritura, el archivo bueno sigue intacto.
    const tmp = `${nombre}.tmp`;
    await Filesystem.writeFile({ path: tmp, directory: 'DATA', data: texto, encoding: 'utf8' });
    try { await Filesystem.deleteFile({ path: nombre, directory: 'DATA' }); } catch (_) { /* no existía */ }
    await Filesystem.rename({ from: tmp, to: nombre, directory: 'DATA', toDirectory: 'DATA' });
  }

  const Storage = {
    esNativo,
    Share,
    LocalNotifications,

    async read() {
      if (esNativo) return leerNativo(ARCHIVO);
      try { return window.localStorage.getItem(ARCHIVO); } catch (_) { return null; }
    },

    async write(texto) {
      if (esNativo) return escribirNativo(ARCHIVO, texto);
      window.localStorage.setItem(ARCHIVO, texto);
    },

    async writeBackup(texto) {
      if (esNativo) return escribirNativo(RESPALDO, texto);
      try { window.localStorage.setItem(RESPALDO, texto); } catch (_) { /* sin espacio: se omite */ }
    },

    async readBackup() {
      if (esNativo) return leerNativo(RESPALDO);
      try { return window.localStorage.getItem(RESPALDO); } catch (_) { return null; }
    },

    /**
     * Entrega un archivo al usuario: en Android abre el menú "Compartir"
     * (Google Drive, WhatsApp, Gmail, Archivos...); en el navegador lo descarga.
     */
    async compartirArchivo(nombre, texto, titulo) {
      if (esNativo && Share) {
        const res = await Filesystem.writeFile({ path: nombre, directory: 'CACHE', data: texto, encoding: 'utf8' });
        await Share.share({ title: titulo || nombre, dialogTitle: titulo || 'Enviar archivo', files: [res.uri] });
        return;
      }
      const blob = new Blob([texto], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    },

    /** Abre un enlace externo (WhatsApp, llamada) fuera de la app. */
    abrirExterno(url) {
      window.open(url, '_system');
    }
  };

  window.Storage = Storage;
})();
