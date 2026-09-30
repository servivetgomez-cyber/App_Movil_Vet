'use strict';

/*
 * Motor de datos de la app móvil.
 *
 * Es un puerto del src/db.js del programa de escritorio: guarda exactamente
 * el mismo JSON (vetclinic-data.json), con las mismas colecciones, los mismos
 * contadores nextIds y los mismos campos en cada registro. Así el archivo se
 * puede pasar del computador al móvil y de vuelta sin conversiones.
 *
 * Lo que cambia es dónde se guarda: en el móvil el archivo vive en el
 * almacenamiento privado de la app (ver storage.js), no en %APPDATA%.
 */
(function () {
  const CLINICA_SCOPED = [
    'clientes', 'pacientes', 'citas', 'vacunas', 'historias', 'tratamientos',
    'facturas', 'inventario', 'movimientosInventario', 'historialPrecios',
    'devoluciones', 'movimientosCaja', 'proveedores', 'facturasProveedor',
    'abonos', 'evoluciones', 'tasasInteres', 'certificados', 'cierresMes', 'activos'
  ];
  const GLOBAL_COLLECTIONS = ['clinicas', 'medicamentosDosis'];
  const COLLECTIONS = [...CLINICA_SCOPED, ...GLOBAL_COLLECTIONS];

  function emptySchema() {
    const schema = { nextIds: {}, ultimaSedeId: null, backupFolder: '', backupAutoAlCerrar: false, dosisImportadoEn: null };
    for (const c of COLLECTIONS) {
      schema[c] = [];
      schema.nextIds[c] = 1;
    }
    return schema;
  }

  // Fecha local AAAA-MM-DD (no UTC: a las 8 p. m. en Colombia toISOString ya
  // devuelve el día siguiente).
  function fmtDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function addDays(base, days) {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  }

  /**
   * Builds sample/demo data anchored to "today" so vaccine and appointment
   * reminders are meaningful no matter when the app is first launched.
   * Includes two sedes to showcase the multi-clinic features.
   */
  function buildSeedData() {
    const data = emptySchema();
    const now = new Date();
    const iso = () => new Date().toISOString();

    // Sedes
    const clinicas = [
      { nombre: 'Clínica Veterinaria San Roque', direccion: 'Av. Principal 123, Ciudad', telefono: '555-0100', email: 'contacto@clinicasanroque.com', logo: '', medicoNombre: 'Dra. Sofía Ramírez', medicoLicencia: 'TP-84930', medicoUniversidad: 'Universidad Nacional', medicoEspecialidad: 'Medicina interna', activa: true },
      { nombre: 'Clínica Veterinaria Norte', direccion: 'Calle 45 #12-08, Zona Norte', telefono: '555-0200', email: 'contacto@clinicanorte.com', logo: '', medicoNombre: '', medicoLicencia: '', medicoUniversidad: '', medicoEspecialidad: '', activa: true }
    ];
    clinicas.forEach((c) => {
      const id = data.nextIds.clinicas++;
      data.clinicas.push({ id, ...c, creadoEn: iso() });
    });
    const CLINICA_1 = data.clinicas[0].id;
    const CLINICA_2 = data.clinicas[1].id;

    // Clientes (sede 1)
    const clientes = [
      { clinicaId: CLINICA_1, nombre: 'María González', tipoDocumento: 'CC', numeroDocumento: '1032456789', telefono: '555-1001', email: 'maria.gonzalez@example.com', direccion: 'Calle 10 #45-20', notas: '' },
      { clinicaId: CLINICA_1, nombre: 'Carlos Ramírez', tipoDocumento: 'CC', numeroDocumento: '1045678901', telefono: '555-1002', email: 'carlos.ramirez@example.com', direccion: 'Carrera 5 #12-30', notas: '' },
      { clinicaId: CLINICA_1, nombre: 'Laura Fernández', tipoDocumento: 'CC', numeroDocumento: '1078912345', telefono: '555-1003', email: 'laura.fernandez@example.com', direccion: 'Av. Los Pinos 88', notas: 'Cliente preferencial' },
      // Sede 2
      { clinicaId: CLINICA_2, nombre: 'Jorge Martínez', tipoDocumento: 'CC', numeroDocumento: '1099887766', telefono: '555-2001', email: 'jorge.martinez@example.com', direccion: 'Calle Norte 22', notas: '' }
    ];
    clientes.forEach((c) => {
      const id = data.nextIds.clientes++;
      data.clientes.push({ id, ...c, hcConsecutivo: 0, creadoEn: iso() });
    });

    const clienteIdByIndex = data.clientes.map((c) => c.id);
    function siguienteHc(clienteIdx) {
      const cliente = data.clientes[clienteIdx];
      cliente.hcConsecutivo += 1;
      return `${cliente.numeroDocumento}-${String(cliente.hcConsecutivo).padStart(3, '0')}`;
    }

    // Pacientes (mascotas)
    const pacientesSeed = [
      { clienteIdx: 0, clinicaId: CLINICA_1, nombre: 'Max', especie: 'Perro', raza: 'Labrador', sexo: 'Macho', fechaNacimiento: '2021-03-15', peso: 28.5, color: 'Dorado', esterilizado: true, notas: '', activo: true },
      { clienteIdx: 0, clinicaId: CLINICA_1, nombre: 'Luna', especie: 'Gato', raza: 'Siamés', sexo: 'Hembra', fechaNacimiento: '2022-07-01', peso: 4.2, color: 'Crema', esterilizado: true, notas: '', activo: true },
      { clienteIdx: 1, clinicaId: CLINICA_1, nombre: 'Rocky', especie: 'Perro', raza: 'Bulldog Francés', sexo: 'Macho', fechaNacimiento: '2020-11-20', peso: 12.0, color: 'Atigrado', esterilizado: false, notas: 'Alergia a pollo', activo: true },
      { clienteIdx: 2, clinicaId: CLINICA_1, nombre: 'Michi', especie: 'Gato', raza: 'Mestizo', sexo: 'Hembra', fechaNacimiento: '2023-01-10', peso: 3.6, color: 'Negro', esterilizado: false, notas: '', activo: true },
      { clienteIdx: 3, clinicaId: CLINICA_2, nombre: 'Bruno', especie: 'Perro', raza: 'Pastor Alemán', sexo: 'Macho', fechaNacimiento: '2021-09-05', peso: 32.0, color: 'Negro y café', esterilizado: false, notas: '', activo: true }
    ];
    pacientesSeed.forEach((p, idx) => {
      const { clienteIdx, ...rest } = p;
      const id = data.nextIds.pacientes++;
      data.pacientes.push({ id, clienteId: clienteIdByIndex[clienteIdx], historiaClinica: siguienteHc(clienteIdx), ...rest, creadoEn: iso() });
    });
    const pacienteIds = data.pacientes.map((p) => p.id);

    // Citas: algunas pasadas, una hoy, varias próximas
    const citas = [
      { pacienteId: pacienteIds[0], clinicaId: CLINICA_1, fecha: fmtDate(addDays(now, -10)), horaInicio: '09:00', horaFin: '09:30', motivo: 'Consulta general', estado: 'atendida', notas: '' },
      { pacienteId: pacienteIds[1], clinicaId: CLINICA_1, fecha: fmtDate(addDays(now, -3)), horaInicio: '11:00', horaFin: '11:30', motivo: 'Control de peso', estado: 'atendida', notas: '' },
      { pacienteId: pacienteIds[2], clinicaId: CLINICA_1, fecha: fmtDate(now), horaInicio: '15:00', horaFin: '15:30', motivo: 'Revisión de piel', estado: 'pendiente', notas: '' },
      { pacienteId: pacienteIds[0], clinicaId: CLINICA_1, fecha: fmtDate(addDays(now, 2)), horaInicio: '10:00', horaFin: '10:30', motivo: 'Vacunación anual', estado: 'pendiente', notas: '' },
      { pacienteId: pacienteIds[3], clinicaId: CLINICA_1, fecha: fmtDate(addDays(now, 5)), horaInicio: '16:30', horaFin: '17:00', motivo: 'Primera consulta', estado: 'pendiente', notas: '' },
      { pacienteId: pacienteIds[1], clinicaId: CLINICA_1, fecha: fmtDate(addDays(now, -20)), horaInicio: '09:30', horaFin: '10:00', motivo: 'Vómito y decaimiento', estado: 'cancelada', notas: 'Cliente reprogramó' },
      { pacienteId: pacienteIds[4], clinicaId: CLINICA_2, fecha: fmtDate(now), horaInicio: '14:00', horaFin: '14:30', motivo: 'Chequeo general', estado: 'pendiente', notas: '' }
    ];
    citas.forEach((c) => {
      const id = data.nextIds.citas++;
      data.citas.push({ id, ...c, creadoEn: iso() });
    });

    // Vacunas: aplicadas, próximas a vencer y vencidas
    const vacunas = [
      { pacienteId: pacienteIds[0], clinicaId: CLINICA_1, nombre: 'Rabia', fechaAplicacion: fmtDate(addDays(now, -350)), fechaProximaDosis: fmtDate(addDays(now, 15)), estadoProximaDosis: 'pendiente', lote: 'RB-2201', veterinario: 'Dr. Pedro Salas', notas: '' },
      { pacienteId: pacienteIds[0], clinicaId: CLINICA_1, nombre: 'Parvovirus', fechaAplicacion: fmtDate(addDays(now, -200)), fechaProximaDosis: fmtDate(addDays(now, -5)), estadoProximaDosis: 'pendiente', lote: 'PV-1187', veterinario: 'Dr. Pedro Salas', notas: 'Dosis vencida, reagendar' },
      { pacienteId: pacienteIds[1], clinicaId: CLINICA_1, nombre: 'Triple felina', fechaAplicacion: fmtDate(addDays(now, -30)), fechaProximaDosis: fmtDate(addDays(now, 335)), estadoProximaDosis: 'pendiente', lote: 'TF-0093', veterinario: 'Dra. Ana Torres', notas: '' },
      { pacienteId: pacienteIds[2], clinicaId: CLINICA_1, nombre: 'Moquillo', fechaAplicacion: fmtDate(addDays(now, -100)), fechaProximaDosis: fmtDate(addDays(now, 3)), estadoProximaDosis: 'pendiente', lote: 'MQ-4471', veterinario: 'Dr. Pedro Salas', notas: '' },
      { pacienteId: pacienteIds[3], clinicaId: CLINICA_1, nombre: 'Rabia', fechaAplicacion: fmtDate(addDays(now, -5)), fechaProximaDosis: fmtDate(addDays(now, 360)), estadoProximaDosis: 'pendiente', lote: 'RB-2255', veterinario: 'Dra. Ana Torres', notas: 'Primera dosis' }
    ];
    vacunas.forEach((v) => {
      const id = data.nextIds.vacunas++;
      data.vacunas.push({ id, ...v, creadoEn: iso() });
    });

    // Historias clínicas
    const historias = [
      { pacienteId: pacienteIds[0], clinicaId: CLINICA_1, fecha: fmtDate(addDays(now, -10)), motivoConsulta: 'Consulta general', sintomas: 'Ninguno, chequeo de rutina', diagnostico: 'Paciente sano', peso: 28.5, temperatura: 38.3, veterinario: 'Dr. Pedro Salas', notas: '', anamnesis: '', tiempoLlenadoCapilar: '< 2 segundos', turgenciaPiel: 'Normal', deshidratacion: 'Sin deshidratación' },
      { pacienteId: pacienteIds[1], clinicaId: CLINICA_1, fecha: fmtDate(addDays(now, -3)), motivoConsulta: 'Control de peso', sintomas: 'Sobrepeso leve', diagnostico: 'Sobrepeso grado I', peso: 12.0, temperatura: 38.1, veterinario: 'Dra. Ana Torres', notas: 'Se recomienda dieta baja en grasa', anamnesis: '', tiempoLlenadoCapilar: '', turgenciaPiel: '', deshidratacion: '' }
    ];
    const historiaIds = [];
    historias.forEach((h) => {
      const id = data.nextIds.historias++;
      data.historias.push({ id, ...h, creadoEn: iso() });
      historiaIds.push(id);
    });

    // Tratamientos ligados a historias
    const tratamientos = [
      { historiaId: historiaIds[1], pacienteId: pacienteIds[1], clinicaId: CLINICA_1, descripcion: 'Plan de control de peso', medicamento: 'Ninguno', dosis: '-', frecuencia: '-', fechaInicio: fmtDate(addDays(now, -3)), fechaFin: fmtDate(addDays(now, 27)), estado: 'activo', recomendaciones: '', notas: 'Dieta especial + ejercicio diario' },
      { historiaId: historiaIds[0], pacienteId: pacienteIds[0], clinicaId: CLINICA_1, descripcion: 'Suplemento vitamínico', medicamento: 'Complejo B', dosis: '1 tableta', frecuencia: 'Cada 24 horas', fechaInicio: fmtDate(addDays(now, -10)), fechaFin: fmtDate(addDays(now, -3)), estado: 'finalizado', recomendaciones: '', notas: '' }
    ];
    tratamientos.forEach((t) => {
      const id = data.nextIds.tratamientos++;
      data.tratamientos.push({ id, ...t, creadoEn: iso() });
    });

    // Inventario (por sede)
    const inventario = [
      { clinicaId: CLINICA_1, nombre: 'Vacuna Antirrábica', categoria: 'Vacuna', stock: 18, stockMinimo: 10, unidad: 'dosis', precioCompra: 4.5, precioVenta: 12.0, proveedor: 'BioVet Labs', notas: '' },
      { clinicaId: CLINICA_1, nombre: 'Amoxicilina 250mg', categoria: 'Antibiótico', stock: 6, stockMinimo: 15, unidad: 'tabletas', precioCompra: 0.3, precioVenta: 1.0, proveedor: 'FarmaAnimal', notas: 'Stock bajo' },
      { clinicaId: CLINICA_1, nombre: 'Desparasitante oral', categoria: 'Antiparasitario', stock: 25, stockMinimo: 10, unidad: 'tabletas', precioCompra: 1.2, precioVenta: 3.5, proveedor: 'BioVet Labs', notas: '' },
      { clinicaId: CLINICA_1, nombre: 'Suero fisiológico 500ml', categoria: 'Insumo', stock: 4, stockMinimo: 8, unidad: 'unidades', precioCompra: 2.0, precioVenta: 5.0, proveedor: 'MedSupply', notas: 'Stock bajo' },
      { clinicaId: CLINICA_2, nombre: 'Vacuna Antirrábica', categoria: 'Vacuna', stock: 12, stockMinimo: 8, unidad: 'dosis', precioCompra: 4.5, precioVenta: 12.0, proveedor: 'BioVet Labs', notas: '' }
    ];
    const invIds = [];
    inventario.forEach((i) => {
      const id = data.nextIds.inventario++;
      data.inventario.push({ id, ...i, creadoEn: iso() });
      invIds.push(id);
    });

    const movimientos = [
      { itemId: invIds[0], clinicaId: CLINICA_1, tipo: 'entrada', cantidad: 20, fecha: fmtDate(addDays(now, -30)), motivo: 'Compra a proveedor' },
      { itemId: invIds[0], clinicaId: CLINICA_1, tipo: 'salida', cantidad: 2, fecha: fmtDate(addDays(now, -5)), motivo: 'Aplicación a paciente' },
      { itemId: invIds[1], clinicaId: CLINICA_1, tipo: 'entrada', cantidad: 20, fecha: fmtDate(addDays(now, -40)), motivo: 'Compra a proveedor' },
      { itemId: invIds[1], clinicaId: CLINICA_1, tipo: 'salida', cantidad: 14, fecha: fmtDate(addDays(now, -2)), motivo: 'Tratamientos recetados' }
    ];
    movimientos.forEach((m) => {
      const id = data.nextIds.movimientosInventario++;
      data.movimientosInventario.push({ id, ...m, creadoEn: iso() });
    });

    // Tasa de interés vigente para créditos, sede 1
    data.tasasInteres.push({
      id: data.nextIds.tasasInteres++,
      clinicaId: CLINICA_1,
      tipo: 'anual',
      valor: 24,
      vigenteDesde: fmtDate(addDays(now, -60)),
      creadoPor: null,
      creadoEn: iso()
    });

    // Facturas (una de contado pagada, una de crédito vencida generando interés)
    const facturas = [
      {
        numero: 'F-0001',
        clienteId: clienteIdByIndex[0],
        pacienteId: pacienteIds[0],
        clinicaId: CLINICA_1,
        fecha: fmtDate(addDays(now, -10)),
        items: [
          { concepto: 'Consulta general', cantidad: 1, precioUnitario: 20, itemInventarioId: null },
          { concepto: 'Complejo B (7 tabletas)', cantidad: 7, precioUnitario: 1.0, itemInventarioId: null }
        ],
        estado: 'pagada',
        metodoPago: 'Efectivo',
        modalidadPago: 'contado',
        notas: ''
      },
      {
        numero: 'F-0002',
        clienteId: clienteIdByIndex[1],
        pacienteId: pacienteIds[2],
        clinicaId: CLINICA_1,
        fecha: fmtDate(addDays(now, -45)),
        items: [
          { concepto: 'Cirugía menor', cantidad: 1, precioUnitario: 150, itemInventarioId: null }
        ],
        estado: 'pendiente',
        metodoPago: '',
        modalidadPago: 'credito',
        fechaVencimiento: fmtDate(addDays(now, -15)),
        fechaInicioMora: null,
        tipoInteres: 'simple',
        interesAcumulado: 0,
        ultimoCalculoInteres: null,
        notas: 'Crédito a 30 días'
      }
    ];
    facturas.forEach((f) => {
      const id = data.nextIds.facturas++;
      const total = f.items.reduce((sum, it) => sum + it.cantidad * it.precioUnitario, 0);
      data.facturas.push({ id, ...f, total, saldoConInteres: total, creadoEn: iso() });
    });

    // Certificados médicos
    const certificados = [
      { pacienteId: pacienteIds[0], clinicaId: CLINICA_1, tipoCertificado: 'Salud General', fecha: fmtDate(addDays(now, -5)), fechaVigencia: fmtDate(addDays(now, 355)), declaracion: 'Se certifica que la mascota Max, Labrador de 3 años, se encuentra en perfecto estado de salud, apto para viajes y competencias. Examen clínico dentro de los parámetros normales. Se recomienda mantener sus vacunaciones al día.' },
      { pacienteId: pacienteIds[1], clinicaId: CLINICA_1, tipoCertificado: 'Vacunación', fecha: fmtDate(addDays(now, -2)), fechaVigencia: fmtDate(addDays(now, 358)), declaracion: 'Se certifica que el felino Luna ha sido vacunado contra Panleucopenia, Calicivirus y Rinotraqueítis Felina con fecha 2 de agosto del presente año. La inmunidad se mantendrá durante 12 meses a partir de la aplicación.' },
      { pacienteId: pacienteIds[2], clinicaId: CLINICA_1, tipoCertificado: 'Post-operatorio / Aptitud', fecha: fmtDate(addDays(now, -20)), fechaVigencia: null, declaracion: 'Se certifica que el paciente Rocky, Bulldog Francés macho, fue sometido a cirugía de castración hace 20 días. Presenta recuperación satisfactoria, incisión completamente cicatrizada y sin signos de complicaciones. El paciente es apto para actividades normales.' }
    ];
    const medicoSede1 = data.clinicas[0];
    certificados.forEach((c) => {
      const id = data.nextIds.certificados++;
      data.certificados.push({
        id,
        ...c,
        fechaVigencia: c.fechaVigencia || '',
        medicoNombre: medicoSede1.medicoNombre,
        medicoLicencia: medicoSede1.medicoLicencia,
        medicoUniversidad: medicoSede1.medicoUniversidad,
        medicoEspecialidad: medicoSede1.medicoEspecialidad,
        creadoEn: iso()
      });
    });

    return data;
  }

  class VetDB {
    constructor(storage) {
      this.storage = storage;
      this.data = null;
      this._saveChain = Promise.resolve();
      this.listeners = new Set();
    }

    /** Carga el archivo guardado. Devuelve false si todavía no hay datos. */
    async load() {
      const raw = await this.storage.read();
      if (!raw) return false;
      this.data = JSON.parse(raw);
      this._ensureShape();
      return true;
    }

    isLoaded() {
      return Boolean(this.data);
    }

    /** Reemplaza todo por el contenido de un archivo (texto JSON ya descifrado). */
    async replaceWithJson(texto) {
      const nuevo = JSON.parse(texto);
      if (!nuevo || typeof nuevo !== 'object' || Array.isArray(nuevo)) {
        throw new Error('El archivo no tiene el formato de datos del programa.');
      }
      const tieneAlgo = COLLECTIONS.some((c) => Array.isArray(nuevo[c]));
      if (!tieneAlgo) throw new Error('El archivo no parece ser un vetclinic-data.json del programa.');
      // Copia de seguridad de lo que había en el móvil, por si se importó el archivo equivocado.
      if (this.data) await this.storage.writeBackup(JSON.stringify(this.data));
      this.data = nuevo;
      this._ensureShape();
      await this.save();
    }

    async startWithSeed() {
      this.data = buildSeedData();
      await this.save();
    }

    async startEmpty(nombreSede) {
      this.data = emptySchema();
      this._ensureShape(nombreSede);
      await this.save();
    }

    toJson() {
      return JSON.stringify(this.data, null, 2);
    }

    _ensureShape(nombreSede) {
      if (typeof this.data.nextIds !== 'object' || this.data.nextIds === null) this.data.nextIds = {};
      for (const c of COLLECTIONS) {
        if (!Array.isArray(this.data[c])) this.data[c] = [];
        if (typeof this.data.nextIds[c] !== 'number') {
          const maxId = this.data[c].reduce((m, item) => Math.max(m, item.id || 0), 0);
          this.data.nextIds[c] = maxId + 1;
        }
      }
      if (this.data.ultimaSedeId === undefined) this.data.ultimaSedeId = null;
      if (typeof this.data.backupFolder !== 'string') this.data.backupFolder = '';
      if (typeof this.data.backupAutoAlCerrar !== 'boolean') this.data.backupAutoAlCerrar = false;
      if (this.data.dosisImportadoEn === undefined) this.data.dosisImportadoEn = null;
      this._migrateToMultiSede(nombreSede);
    }

    // Igual que en el escritorio: un archivo de antes de las sedes se queda
    // con una sede única y todos sus registros pasan a pertenecer a ella.
    _migrateToMultiSede(nombreSede) {
      if (this.data.clinicas.length > 0) return;
      const legacy = this.data.config && this.data.config.clinica ? this.data.config.clinica : {};
      const clinica = {
        id: this.data.nextIds.clinicas++,
        nombre: nombreSede || legacy.nombre || 'Mi Clínica Veterinaria',
        direccion: legacy.direccion || '',
        telefono: legacy.telefono || '',
        email: legacy.email || '',
        logo: legacy.logo || '',
        medicoNombre: legacy.medicoNombre || '',
        medicoLicencia: legacy.medicoLicencia || '',
        medicoUniversidad: legacy.medicoUniversidad || '',
        medicoEspecialidad: legacy.medicoEspecialidad || '',
        activa: true,
        creadoEn: new Date().toISOString()
      };
      this.data.clinicas.push(clinica);
      for (const c of CLINICA_SCOPED) {
        this.data[c].forEach((item) => { if (!item.clinicaId) item.clinicaId = clinica.id; });
      }
    }

    /** Guarda en disco. Las escrituras se encadenan para que nunca se pisen. */
    save() {
      const texto = JSON.stringify(this.data, null, 2);
      this._saveChain = this._saveChain
        .catch(() => {})
        .then(() => this.storage.write(texto));
      this.listeners.forEach((fn) => { try { fn(); } catch (_) { /* ignore */ } });
      return this._saveChain;
    }

    onChange(fn) {
      this.listeners.add(fn);
    }

    // --- Sede activa ------------------------------------------------------
    getUltimaSedeId() {
      return this.data.ultimaSedeId || null;
    }

    setUltimaSedeId(clinicaId) {
      this.data.ultimaSedeId = clinicaId ? Number(clinicaId) : null;
      return this.save();
    }

    // --- CRUD genérico (mismo contrato que el escritorio) -------------------
    getAll(collection, clinicaId) {
      this._assertCollection(collection);
      let items = this.data[collection];
      if (clinicaId && CLINICA_SCOPED.includes(collection)) {
        items = items.filter((item) => item.clinicaId === Number(clinicaId));
      }
      return [...items];
    }

    getById(collection, id) {
      this._assertCollection(collection);
      return this.data[collection].find((item) => item.id === Number(id)) || null;
    }

    async create(collection, payload) {
      this._assertCollection(collection);
      const id = this.data.nextIds[collection]++;
      const record = { id, ...payload, creadoEn: new Date().toISOString() };
      this.data[collection].push(record);
      await this.save();
      return record;
    }

    async update(collection, id, payload) {
      this._assertCollection(collection);
      const idx = this.data[collection].findIndex((item) => item.id === Number(id));
      if (idx === -1) throw new Error(`Registro no encontrado en ${collection} (id ${id})`);
      const actual = this.data[collection][idx];
      // clinicaId es la frontera entre sedes: al editar no se cambia (igual que el escritorio).
      const limpio = { ...payload };
      delete limpio.id;
      delete limpio.creadoEn;
      if (CLINICA_SCOPED.includes(collection) && actual.clinicaId) delete limpio.clinicaId;
      const updated = { ...actual, ...limpio, id: actual.id };
      this.data[collection][idx] = updated;
      await this.save();
      return updated;
    }

    async remove(collection, id) {
      this._assertCollection(collection);
      const before = this.data[collection].length;
      this.data[collection] = this.data[collection].filter((item) => item.id !== Number(id));
      await this.save();
      return before !== this.data[collection].length;
    }

    _assertCollection(collection) {
      if (!COLLECTIONS.includes(collection)) throw new Error(`Colección desconocida: ${collection}`);
    }

    // --- Consultas relacionadas ---------------------------------------------
    by(collection, campo, valor) {
      return this.data[collection].filter((x) => x[campo] === Number(valor));
    }

    // --- Panel / recordatorios (mismas reglas que el escritorio) ------------
    _enSede(item, clinicaId) {
      return clinicaId ? item.clinicaId === Number(clinicaId) : true;
    }

    getCitasHoy(clinicaId) {
      const hoy = fmtDate(new Date());
      return this.data.citas
        .filter((c) => c.fecha === hoy && c.estado === 'pendiente' && this._enSede(c, clinicaId))
        .sort((a, b) => String(a.horaInicio).localeCompare(String(b.horaInicio)));
    }

    getCitasProximas(dias, clinicaId) {
      const hoy = fmtDate(new Date());
      const limite = fmtDate(addDays(new Date(), dias));
      return this.data.citas
        .filter((c) => c.estado === 'pendiente' && c.fecha > hoy && c.fecha <= limite && this._enSede(c, clinicaId))
        .sort((a, b) => (a.fecha + a.horaInicio).localeCompare(b.fecha + b.horaInicio));
    }

    // Sin estadoProximaDosis (datos viejos) cuenta como 'pendiente'.
    getVacunasProximas(dias, clinicaId) {
      const hoy = fmtDate(new Date());
      const limite = fmtDate(addDays(new Date(), dias));
      return this.data.vacunas
        .filter((v) => v.estadoProximaDosis !== 'aplicada' && v.fechaProximaDosis && v.fechaProximaDosis >= hoy && v.fechaProximaDosis <= limite && this._enSede(v, clinicaId))
        .sort((a, b) => a.fechaProximaDosis.localeCompare(b.fechaProximaDosis));
    }

    getVacunasVencidas(clinicaId) {
      const hoy = fmtDate(new Date());
      return this.data.vacunas
        .filter((v) => v.estadoProximaDosis !== 'aplicada' && v.fechaProximaDosis && v.fechaProximaDosis < hoy && this._enSede(v, clinicaId))
        .sort((a, b) => a.fechaProximaDosis.localeCompare(b.fechaProximaDosis));
    }

    getInventarioBajo(clinicaId) {
      return this.data.inventario.filter((i) => Number(i.stock) <= Number(i.stockMinimo) && this._enSede(i, clinicaId));
    }

    // Mismo cálculo que el escritorio: tratamientos activos cuya fecha fin ya pasó.
    async finalizarTratamientosVencidos() {
      const hoy = fmtDate(new Date());
      let cambios = 0;
      this.data.tratamientos.forEach((t) => {
        if (t.estado === 'activo' && t.fechaFin && t.fechaFin < hoy) {
          t.estado = 'finalizado';
          cambios++;
        }
      });
      if (cambios) await this.save();
      return cambios;
    }

    // --- Inventario -----------------------------------------------------------
    /** Registra una entrada o salida y actualiza el stock, como el escritorio. */
    async moverInventario(item, tipo, cantidad, fecha, motivo) {
      await this.create('movimientosInventario', {
        itemId: item.id, tipo, cantidad, fecha, motivo, clinicaId: item.clinicaId
      });
      const stock = Number(item.stock) || 0;
      const nuevo = tipo === 'entrada' ? stock + cantidad : Math.max(0, stock - cantidad);
      return this.update('inventario', item.id, { stock: nuevo });
    }
  }

  window.VetDB = VetDB;
  window.VetSchema = { COLLECTIONS, CLINICA_SCOPED, fmtDate, addDays, buildSeedData };
})();
