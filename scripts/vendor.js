'use strict';
// Copia a www/vendor las librerías de terceros que usa la interfaz (no hay
// empaquetador: la app carga scripts normales).
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const copias = [
  ['node_modules/scrypt-js/scrypt.js', 'www/vendor/scrypt.js']
];
for (const [desde, hasta] of copias) {
  fs.mkdirSync(path.dirname(path.join(raiz, hasta)), { recursive: true });
  fs.copyFileSync(path.join(raiz, desde), path.join(raiz, hasta));
  console.log(`  ${desde} -> ${hasta}`);
}
