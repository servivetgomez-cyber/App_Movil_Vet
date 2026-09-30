package com.servivet.clinicaveterinaria;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin propio de la app: archivo de datos vinculado (Google Drive).
        registerPlugin(ArchivoVinculadoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
