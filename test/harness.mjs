// Ejecuta el código de un nodo Code de n8n fuera de n8n, con $, $input y static data simulados.
import fs from 'node:fs';
const SRC = new URL('../src/', import.meta.url);
const lib = (f) => fs.readFileSync(new URL(`lib/${f}`, SRC), 'utf8');
export const LIBS = { common: lib('common.js'), salario: lib('salario.js') };
export const codigoNodo = (file, libs = []) => libs.map((l) => LIBS[l]).join('\n') + '\n' + fs.readFileSync(new URL(`nodes/${file}`, SRC), 'utf8');

export function crearEntorno() {
  const salidas = {}; const staticData = {};
  const nodo = (nombre) => ({
    all: () => { if (!salidas[nombre]) throw new Error(`nodo no ejecutado: ${nombre}`); return salidas[nombre]; },
    first: () => salidas[nombre]?.[0],
    get isExecuted() { return !!salidas[nombre]; },
  });
  return {
    salidas,
    staticData,
    run(nombre, file, input = [], libs = ['common']) {
      const code = file.endsWith('.js') && !file.includes('/') ? codigoNodo(file, libs) : file;
      const fn = new Function('$', '$input', '$getWorkflowStaticData', '$execution', code);
      const items = fn(nodo, { all: () => input, first: () => input[0] }, () => staticData, { id: 'test-1' });
      salidas[nombre] = items;
      return items;
    },
  };
}
