// Simula el resto del pipeline con respuestas de Claude falsas (forma real de la API)
import fs from 'node:fs';
import assert from 'node:assert';
import { crearEntorno } from './harness.mjs';
const env = crearEntorno();
env.run('Config', fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8'), [{ json: {} }], []);
if (!fs.existsSync(new URL('../samples/', import.meta.url))) { console.log('samples/ no se publica (datos reales): genera los tuyos con test/probar_fuentes.mjs'); process.exit(0); }
const cands = JSON.parse(fs.readFileSync(new URL('../samples/_candidatas.json', import.meta.url))).map((json) => ({ json }));
env.salidas['Unir fuentes'] = [{ json: { _tipo: 'uso', fuente: 'jsearch', peticiones: 3, ofertas: 30, errores: 0, nota: 'acumulado mes: 3' } },
  { json: { _tipo: 'error', fuente: 'adzuna', mensaje: '401 Unauthorized' } }];
env.staticData.ultimoFiltrado = { recibidas: 40, candidatas: 3, puntuadas: 3, descartes: { 'título no relevante': 37 } };

const prep = env.run('Preparar scoring', 'prep_scoring.js', cands);
assert.equal(prep.length, cands.length);
assert.equal(prep[0].json.body.model, 'claude-haiku-5-5');
console.log('system prompt ~', Math.round(prep[0].json.body.system[0].text.length / 4), 'tokens');
const resp = (s) => ({ json: { content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(s) }], stop_reason: 'end_turn', usage: { input_tokens: 900, cache_read_input_tokens: 1400, output_tokens: 250 } } });
const base = { motivos_match: ['n8n en producción'], gaps: ['sin Salesforce'], salario_estimado_neto_mes: 2600, salario_por_debajo_minimo: false, red_flags: [], posible_oferta_fantasma: false, resumen: 'ok' };
const salidaHttp = [resp({ ...base, score: 88, puesto_categoria: '1' }), { json: { error: { message: '529 Overloaded' } } }, resp({ ...base, score: 61, puesto_categoria: '2' })];
const filas = env.run('Parsear score', 'parse_score.js', salidaHttp).map((i) => i.json);
assert.equal(filas.length, 2); assert.equal(filas[0].estado, 'Por postular');
assert.ok(!('_alerta' in filas[0]));
console.log('fila Sheets:', filas[0]);
const al = env.run('Preparar alertas', 'alertas.js', []).map((i) => i.json);
assert.equal(al.length, 1); console.log('\nTelegram:\n' + al[0].texto + '\nbotón → ' + al[0].cv_url);
const uso = env.run('Registrar uso', 'registrar_uso.js', []).map((i) => i.json);
console.log('\nUso_API:', uso.map((u) => `${u.fuente}:${u.peticiones} ${u.coste_usd}`).join(' | '));
const err = env.run('Errores', 'errores.js', []).map((i) => i.json);
console.log('\nErrores:\n' + err[0].texto);

// Resumen diario
const hoy = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 10);
env.salidas['Leer ofertas (resumen)'] = [...filas, { ...filas[1], titulo: 'Otra', score: 40, fecha_detectada: '2020-01-01 10:00' }].map((json) => ({ json }));
const res = env.run('Montar resumen', 'resumen.js', [{ json: { fecha: `${hoy} 08:00`, fuente: 'jsearch', peticiones: 3, errores: 0 } }, { json: { fecha: `${hoy} 08:00`, fuente: 'claude-scoring', peticiones: 3, coste_usd: '0.0004' } }]);
console.log('\nResumen:\n' + res[0].json.texto);

// Botón CV
env.salidas.Config[0].json._entrada = { query: { id: filas[0].id } };
let cv = env.run('Buscar oferta', 'cv_buscar.js', filas.map((json) => ({ json })))[0].json;
assert.equal(cv.ok, false); // adaptador sin configurar
env.salidas.Config[0].json.CV_ADAPTER_WORKFLOW_ID = 'abc';
cv = env.run('Buscar oferta', 'cv_buscar.js', filas.map((json) => ({ json })))[0].json;
assert.equal(cv.ok, true); assert.equal(cv.oferta.id, filas[0].id);

// Gmail: preparación y normalización
const html = `<p>Nuevas ofertas</p><a href="https://www.linkedin.com/comm/jobs/view/4099999999/?trackingId=x&amp;refId=y">AI Automation Specialist</a><p>Acme · Barcelona (Híbrido)</p><a href="https://www.linkedin.com/comm/psettings/email-unsubscribe">Darse de baja</a>`;
env.run('Config', fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8'), [{ json: {} }], []);
const pg = env.run('Preparar correos', 'prep_gmail.js', [{ json: { id: '1', html, subject: 'Ofertas para ti', from: { text: 'LinkedIn <jobalerts-noreply@linkedin.com>' }, date: new Date().toISOString() } }]);
assert.deepEqual(Object.keys(pg[0].json.links), ['L1']);
assert.ok(pg[0].json.body.messages[0].content.includes('AI Automation Specialist [L1]'));
const ng = env.run('Norm Gmail', 'norm_gmail.js', [{ json: { content: [{ type: 'text', text: JSON.stringify({ ofertas: [{ titulo: 'AI Automation Specialist', empresa: 'Acme', ubicacion: 'Barcelona', modalidad: 'híbrido', salario: '', link_ref: 'L1' }] }) }], usage: { input_tokens: 500, output_tokens: 80 } } }]).map((i) => i.json);
assert.equal(ng[0].url_canonica, 'https://www.linkedin.com/jobs/view/4099999999/');
assert.equal(ng[0].fuente, 'linkedin (alerta)');
assert.equal(env.run('Preparar correos', 'prep_gmail.js', [{ json: {} }])[0].json._skip, true);
console.log('\nOK: pipeline completo simulado');
