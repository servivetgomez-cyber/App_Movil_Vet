package com.servivet.clinicaveterinaria;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.UriPermission;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Archivo de datos vinculado (por ejemplo, el vetclinic-data.json que el
 * programa de escritorio guarda en Google Drive).
 *
 * Usa el selector de documentos de Android (Storage Access Framework): el
 * usuario elige el archivo una vez en Drive y la app conserva el permiso de
 * lectura y escritura sobre ese único archivo, sin pedir su cuenta de Google
 * ni acceso al resto del Drive. Leer y escribir pasa por la app de Google
 * Drive del teléfono, que se encarga de sincronizar con la nube.
 */
@CapacitorPlugin(name = "ArchivoVinculado")
public class ArchivoVinculadoPlugin extends Plugin {

    private ContentResolver resolver() {
        return getContext().getContentResolver();
    }

    /** Abre el selector de documentos para elegir el archivo. */
    @PluginMethod
    public void elegir(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        );
        startActivityForResult(call, intent, "alElegir");
    }

    @ActivityCallback
    private void alElegir(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("No se eligió ningún archivo", "CANCELADO");
            return;
        }
        Uri uri = data.getData();
        // Permiso que sobrevive a reinicios del teléfono. Si el proveedor no
        // concede escritura, se intenta al menos conservar la lectura.
        try {
            resolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        } catch (SecurityException e) {
            try {
                resolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (SecurityException ignored) {
                // Sin permiso persistente: funcionará solo mientras la app siga abierta.
            }
        }
        call.resolve(info(uri));
    }

    /** Nombre, tamaño, fecha de modificación y si se puede escribir. */
    @PluginMethod
    public void info(PluginCall call) {
        Uri uri = uriDe(call);
        if (uri == null) return;
        try {
            call.resolve(info(uri));
        } catch (Exception e) {
            call.reject("No se pudo consultar el archivo: " + e.getMessage(), "SIN_ACCESO", e);
        }
    }

    @PluginMethod
    public void leer(PluginCall call) {
        Uri uri = uriDe(call);
        if (uri == null) return;
        try (InputStream in = resolver().openInputStream(uri)) {
            if (in == null) throw new FileNotFoundException("sin contenido");
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[64 * 1024];
            int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            JSObject ret = info(uri);
            ret.put("texto", new String(out.toByteArray(), StandardCharsets.UTF_8));
            call.resolve(ret);
        } catch (SecurityException e) {
            call.reject("La app perdió el permiso sobre el archivo. Vuelve a vincularlo.", "SIN_PERMISO", e);
        } catch (Exception e) {
            call.reject("No se pudo leer el archivo: " + e.getMessage(), "ERROR_LECTURA", e);
        }
    }

    @PluginMethod
    public void escribir(PluginCall call) {
        Uri uri = uriDe(call);
        if (uri == null) return;
        String texto = call.getString("texto");
        if (texto == null) {
            call.reject("Falta el contenido a guardar");
            return;
        }
        byte[] bytes = texto.getBytes(StandardCharsets.UTF_8);
        try {
            OutputStream out;
            try {
                // "wt" = escribir truncando; no todos los proveedores lo aceptan.
                out = resolver().openOutputStream(uri, "wt");
            } catch (FileNotFoundException | IllegalArgumentException e) {
                out = resolver().openOutputStream(uri, "w");
            }
            if (out == null) throw new FileNotFoundException("no se pudo abrir para escribir");
            try (OutputStream o = out) {
                o.write(bytes);
                o.flush();
            }
            call.resolve(info(uri));
        } catch (SecurityException e) {
            call.reject("La app no tiene permiso para escribir en el archivo. Vuelve a vincularlo.", "SIN_PERMISO", e);
        } catch (Exception e) {
            call.reject("No se pudo guardar en el archivo: " + e.getMessage(), "ERROR_ESCRITURA", e);
        }
    }

    /** Suelta el permiso guardado sobre el archivo (al desvincular). */
    @PluginMethod
    public void liberar(PluginCall call) {
        Uri uri = uriDe(call);
        if (uri == null) return;
        for (UriPermission p : resolver().getPersistedUriPermissions()) {
            if (p.getUri().equals(uri)) {
                try {
                    resolver().releasePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION | (p.isWritePermission() ? Intent.FLAG_GRANT_WRITE_URI_PERMISSION : 0));
                } catch (SecurityException ignored) {
                    // ya no existía
                }
            }
        }
        call.resolve();
    }

    private Uri uriDe(PluginCall call) {
        String u = call.getString("uri");
        if (u == null || u.isEmpty()) {
            call.reject("Falta la dirección del archivo");
            return null;
        }
        return Uri.parse(u);
    }

    private JSObject info(Uri uri) {
        JSObject ret = new JSObject();
        ret.put("uri", uri.toString());
        String nombre = null;
        long tamano = -1;
        long modificado = 0;
        int flags = 0;
        try (Cursor c = resolver().query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (i >= 0 && !c.isNull(i)) nombre = c.getString(i);
                i = c.getColumnIndex(OpenableColumns.SIZE);
                if (i >= 0 && !c.isNull(i)) tamano = c.getLong(i);
                i = c.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED);
                if (i >= 0 && !c.isNull(i)) modificado = c.getLong(i);
                i = c.getColumnIndex(DocumentsContract.Document.COLUMN_FLAGS);
                if (i >= 0 && !c.isNull(i)) flags = c.getInt(i);
            }
        } catch (Exception ignored) {
            // Algunos proveedores no responden a la consulta; se devuelve lo que haya.
        }
        boolean permisoEscritura = false;
        for (UriPermission p : resolver().getPersistedUriPermissions()) {
            if (p.getUri().equals(uri) && p.isWritePermission()) permisoEscritura = true;
        }
        ret.put("nombre", nombre != null ? nombre : uri.getLastPathSegment());
        ret.put("tamano", tamano);
        ret.put("modificado", modificado);
        ret.put("escribible", permisoEscritura && (flags == 0 || (flags & DocumentsContract.Document.FLAG_SUPPORTS_WRITE) != 0));
        ret.put("proveedor", uri.getAuthority());
        return ret;
    }
}
