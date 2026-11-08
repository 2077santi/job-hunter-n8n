import fs from 'node:fs';
import assert from 'node:assert';
import { crearEntorno, LIBS } from './harness.mjs';

// --- salario ---
const sal = new Function(LIBS.salario + '; return { parseSalarioTexto, estimaSalario, netoAnual };')();
assert.deepEqual(sal.parseSalarioTexto('$3.5k–$5k/month'), { min: 3500, max: 5000, periodo: 'month', moneda: 'USD' });
assert.equal(sal.parseSalarioTexto('70K-80K').max, 80000);
assert.equal(sal.parseSalarioTexto('$1000 per task'), null);
assert.equal(sal.parseSalarioTexto('24.000 - 28.000 € bruto/año').max, 28000);
assert.equal(sal.parseSalarioTexto('$50-$75 /hour').periodo, 'hour');
const e = (o) => sal.estimaSalario(o);
assert.ok(e({ salario_texto: '24.000 - 28.000 € bruto/año' }).neto_mes_max < 2300, '28k -> bajo');
assert.ok(e({ salario_texto: '38.000 - 45.000 €' }).neto_mes_max > 2500, '45k -> ok');
assert.equal(e({ salario_min: 263103, salario_max: 346000, salario_periodo: 'yearly', salario_moneda: 'USD' }).bruto_anual_max, 318320);
console.log('neto 40k:', Math.round(sal.netoAnual(40000) / 12), '€/mes · salario OK');

// --- dedupe + filtros con datos reales + casos sintéticos ---
const env = crearEntorno();
env.run('Config', fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8'), [{ json: {} }], []);
if (!fs.existsSync(new URL('../samples/', import.meta.url))) { console.log('samples/ no se publica (datos reales): genera los tuyos con test/probar_fuentes.mjs'); process.exit(0); }
const reales = JSON.parse(fs.readFileSync(new URL('../samples/_unidas.json', import.meta.url)));
const mk = new Function(LIBS.common + '; return oferta;')();
const hoy = new Date().toISOString();
const sint = [
  mk({ fuente: 't', titulo: 'AI Automation Specialist (n8n)', empresa: 'Acme SL', ubicacion: 'Barcelona, Cataluña', modalidad: 'híbrido', fecha: hoy, url: 'https://x.com/1', descripcion: 'We need 3+ years of experience with n8n' }),
  mk({ fuente: 't2', titulo: 'AI Automation Specialist (n8n)', empresa: 'ACME S.L.', ubicacion: 'Barcelona', fecha: hoy, url: 'https://y.com/2', descripcion: 'Descripción más larga para quedarse con esta versión de la oferta duplicada entre fuentes, con detalle.' }),
  mk({ fuente: 't', titulo: 'Operations Analyst', empresa: 'B', ubicacion: 'Madrid', modalidad: 'híbrido', fecha: hoy, url: 'https://x.com/3' }),
  mk({ fuente: 't', titulo: 'Analista de operaciones', empresa: 'C', ubicacion: 'Madrid', pais: 'ES', modalidad: 'remoto', fecha: hoy, url: 'https://x.com/4' }),
  mk({ fuente: 't', titulo: 'Business Analyst', empresa: 'D', ubicacion: 'Barcelona', fecha: hoy, url: 'https://x.com/5', descripcion: 'Minimum 10 years of experience in banking' }),
  mk({ fuente: 't', titulo: 'Customer Success Manager', empresa: 'E', ubicacion: 'Barcelona', fecha: hoy, url: 'https://x.com/6', salario_texto: '24.000 - 28.000 €' }),
  mk({ fuente: 't', titulo: 'Prácticas en automatización', empresa: 'F', ubicacion: 'Barcelona', fecha: hoy, url: 'https://x.com/7' }),
  mk({ fuente: 't', titulo: 'Process Improvement Analyst', empresa: 'G', ubicacion: 'Barcelona', fecha: '2026-10-01T00:00:00Z', url: 'https://x.com/8' }),
  mk({ fuente: 't', titulo: 'Product Owner Junior', empresa: 'H', ubicacion: 'Barcelona', fecha: hoy, url: 'https://www.linkedin.com/comm/jobs/view/4012345678/?trackingId=abc' }),
  mk({ fuente: 't', titulo: 'Senior Software Engineer', empresa: 'I', ubicacion: 'Barcelona', fecha: hoy, url: 'https://x.com/10' }),
  mk({ fuente: 't', titulo: 'Workflow Automation Developer', empresa: 'J', ubicacion: 'Europe', modalidad: 'remoto', fecha: hoy, url: 'https://x.com/11' }),
  mk({ fuente: 't', titulo: 'Operations Analyst', empresa: 'K', ubicacion: 'USA, Canada', modalidad: 'remoto', fecha: hoy, url: 'https://x.com/12' }),
  mk({ fuente: 't', titulo: 'Ya guardada Analyst', empresa: 'L', ubicacion: 'Barcelona', fecha: hoy, url: 'https://x.com/13' }),
].map((json) => ({ json }));
env.salidas['Unir fuentes'] = [...reales, ...sint];
const hoja = [{ json: { url: 'https://x.com/13?utm=1', clave_dedupe: 'otra|cosa' } }, { json: { url: 'https://www.linkedin.com/jobs/view/4012345678/' } }];
const out = env.run('Dedupe y filtros', 'dedupe_filtros.js', hoja, ['common', 'salario']).map((i) => i.json);
const titulos = out.map((o) => `${o.titulo} @${o.empresa} [${o.fuente}] p${o._prioridad}`);
console.log('\nCandidatas:\n ' + titulos.join('\n '));
console.log('\nFiltrado:', JSON.stringify(env.staticData.ultimoFiltrado, null, 1));
const t = out.map((o) => o.titulo + '|' + o.empresa);
assert.ok(t.includes('AI Automation Specialist (n8n)|ACME S.L.'), 'BCN + dedupe se queda la de descripción larga');
assert.equal(out.find((o) => o.titulo.startsWith('AI Automation')).fuente, 't+t2');
assert.ok(!t.some((x) => x.startsWith('Operations Analyst|B')), 'Madrid híbrido fuera');
assert.ok(t.includes('Analista de operaciones|C'), 'Madrid remoto dentro');
assert.ok(!t.includes('Business Analyst|D'), '10 años fuera');
assert.ok(!t.includes('Customer Success Manager|E'), 'salario bajo fuera');
assert.ok(!t.some((x) => x.startsWith('Prácticas')), 'prácticas fuera');
assert.ok(!t.includes('Process Improvement Analyst|G'), 'antigua fuera');
assert.ok(!t.includes('Product Owner Junior|H'), 'ya en hoja (linkedin canónica)');
assert.ok(!t.includes('Senior Software Engineer|I'), 'dev fuera');
assert.ok(t.includes('Workflow Automation Developer|J'), 'dev de automatización dentro');
assert.ok(!t.includes('Operations Analyst|K'), 'remoto USA fuera');
assert.ok(!t.some((x) => x.startsWith('Ya guardada')), 'ya en hoja (url)');
assert.equal(out[0]._prioridad, 1);
console.log('\nOK: todos los asserts de filtros pasan');
fs.writeFileSync(new URL('../samples/_candidatas.json', import.meta.url), JSON.stringify(out));
