'use strict';
// Revisión rápida: sintaxis de todos los scripts y que los datos de ejemplo se generen.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const raiz = path.join(__dirname, '..');
const archivos = [];
(function recorrer(dir) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) recorrer(p);
    else if (n.endsWith('.js')) archivos.push(p);
  }
})(path.join(raiz, 'www', 'js'));

for (const f of archivos) execFileSync(process.execPath, ['--check', f], { stdio: 'inherit' });

global.window = {};
require(path.join(raiz, 'www', 'js', 'db.js'));
const datos = window.VetSchema.buildSeedData();
if (!datos.pacientes.length || !datos.clinicas.length) throw new Error('Datos de ejemplo vacíos');
console.log(`OK: ${archivos.length} scripts revisados, datos de ejemplo con ${datos.pacientes.length} pacientes.`);
