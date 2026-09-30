'use strict';

/* Tabla de rutas: cada pantalla con su dirección (#/...). */
window.Rutas = {
  registrar(App) {
    App.ruta('/inicio', 'inicio');
    App.ruta('/agenda', 'agenda');
    App.ruta('/cita/nueva', 'citaForm');
    App.ruta('/cita/:id', 'citaForm');
    App.ruta('/pacientes', 'pacientes');
    App.ruta('/paciente/nuevo', 'pacienteForm');
    App.ruta('/paciente/:id/editar', 'pacienteForm');
    App.ruta('/paciente/:id', 'paciente');
    App.ruta('/tutores', 'tutores');
    App.ruta('/tutor/nuevo', 'tutorForm');
    App.ruta('/tutor/:id/editar', 'tutorForm');
    App.ruta('/tutor/:id', 'tutor');
    App.ruta('/vacunas', 'vacunas');
    App.ruta('/vacuna/nueva', 'vacunaForm');
    App.ruta('/vacuna/:id/aplicar', 'vacunaAplicar');
    App.ruta('/vacuna/:id', 'vacunaForm');
    App.ruta('/historias', 'historias');
    App.ruta('/historia/nueva', 'historiaForm');
    App.ruta('/historia/:id/editar', 'historiaForm');
    App.ruta('/historia/:id', 'historia');
    App.ruta('/tratamiento/nuevo', 'tratamientoForm');
    App.ruta('/tratamiento/:id', 'tratamientoForm');
    App.ruta('/inventario', 'inventario');
    App.ruta('/insumo/nuevo', 'insumoForm');
    App.ruta('/insumo/:id/editar', 'insumoForm');
    App.ruta('/insumo/:id/movimiento', 'movimiento');
    App.ruta('/insumo/:id', 'insumo');
    App.ruta('/facturas', 'facturas');
    App.ruta('/factura/:id', 'factura');
    App.ruta('/certificados', 'certificados');
    App.ruta('/dosis', 'dosis');
    App.ruta('/mas', 'mas');
    App.ruta('/sedes', 'sedes');
    App.ruta('/datos', 'datos');
    App.ruta('/acerca', 'acerca');
  }
};
