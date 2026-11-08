// Prueba real: 1 llamada por fuente (las de pago solo si hay clave en .env), filtros y scoring de hasta N ofertas con Haiku.
// Uso: node test/probar_fuentes.mjs [N_scoring=2]
import fs from 'node:fs';
import { crearEntorno } from './harness.mjs';
const envFile = new URL('../.env', import.meta.url);
const K = Object.fromEntries((fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '').split('\n')
  .filter((l) => /^\w+=./.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const N = Number(process.argv[2] ?? 2);
const env = crearEntorno();
env.run('Config', fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8'), [{ json: {} }], []);
const peticiones = {};
async function llamar(fuente, url, opts = {}) {
  peticiones[fuente] = (peticiones[fuente] ?? 0) + 1;
  try {
    const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(60000) });
    const body = await r.json().catch(() => ({}));
    return r.ok ? { json: body } : { json: { error: { message: `${r.status} ${JSON.stringify(body).slice(0, 200)}` } } };
  } catch (e) { return { json: { error: { message: e.message } } }; }
}
const fuentes = [];
async function fuente(nombre, plan, norm, peticion, activa = true) {
  const p = env.run(`Plan ${nombre}`, plan, [], []).map((i) => i.json);
  if (!activa) { console.log(`- ${nombre}: SIN CLAVE en .env, no probada`); env.salidas[`Plan ${nombre}`] = [{ json: { _skip: true, nota: 'sin clave (prueba local)' } }]; fuentes.push(...env.run(`Norm ${nombre}`, norm, [{ json: { _skip: true } }])); return; }
  const items = p[0]?._skip ? [{ json: { _skip: true } }] : [await peticion(p[0])]; // solo 1 llamada por fuente en la prueba
  env.salidas[`Plan ${nombre}`] = env.salidas[`Plan ${nombre}`].slice(0, 1);
  const out = env.run(`Norm ${nombre}`, norm, items);
  const u = out.find((i) => i.json._tipo === 'uso').json, e = out.filter((i) => i.json._tipo === 'error');
  console.log(`- ${nombre}: ${u.peticiones} petición, ${u.ofertas} ofertas${e.length ? ' · ERROR ' + e[0].json.mensaje : ''}`);
  fuentes.push(...out);
}
console.log('Fuentes (llamadas reales):');
await fuente('JSearch', 'plan_jsearch.js', 'norm_jsearch.js', (q) => llamar('jsearch', q.url, { headers: { 'X-RapidAPI-Key': K.RAPIDAPI_KEY, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' } }), !!K.RAPIDAPI_KEY);
await fuente('Adzuna', 'plan_adzuna.js', 'norm_adzuna.js', (q) => llamar('adzuna', `${q.url}&app_id=${K.ADZUNA_APP_ID}&app_key=${K.ADZUNA_APP_KEY}`), !!K.ADZUNA_APP_KEY);
await fuente('Remotive', 'plan_remotive.js', 'norm_remotive.js', (q) => llamar('remotive', q.url));
await fuente('Arbeitnow', 'plan_arbeitnow.js', 'norm_arbeitnow.js', (q) => llamar('arbeitnow', q.url));
await fuente('Jobicy', 'plan_jobicy.js', 'norm_jobicy.js', (q) => llamar('jobicy', q.url));

env.salidas['Unir fuentes'] = fuentes;
const cands = env.run('Dedupe y filtros', 'dedupe_filtros.js', [], ['common', 'salario']);
console.log('\nFiltrado:', JSON.stringify(env.staticData.ultimoFiltrado));
cands.slice(0, 15).forEach((c) => console.log(`  · [p${c.json._prioridad}] ${c.json.titulo} — ${c.json.empresa} (${c.json.ubicacion}, ${c.json.modalidad}) [${c.json.fuente}]`));
fs.writeFileSync(new URL('../samples/_candidatas_reales.json', import.meta.url), JSON.stringify(cands.map((i) => i.json)));

if (!K.ANTHROPIC_API_KEY) { console.log('\nScoring: falta ANTHROPIC_API_KEY en .env'); process.exit(0); }
const prep = env.run('Preparar scoring', 'prep_scoring.js', cands.slice(0, N), []);
const resp = [];
for (const p of prep) resp.push(await llamar('claude', 'https://api.anthropic.com/v1/messages', { method: 'POST',
  headers: { 'x-api-key': K.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(p.json.body) }));
const filas = env.run('Parsear score', 'parse_score.js', resp);
const sc = env.staticData.ultimoScoring;
console.log(`\nScoring: ${sc.ok}/${sc.llamadas} ok · tokens in ${sc.tin} (+${sc.tcache} caché) out ${sc.tout} · ${sc.coste.toFixed(5)} $`, sc.errores);
filas.forEach((f) => console.log(JSON.stringify(f.json, null, 2)));
env.run('Preparar alertas', 'alertas.js', [], []).forEach((a) => console.log('\n--- Telegram ---\n' + a.json.texto));
fs.writeFileSync(new URL('../samples/_puntuadas.json', import.meta.url), JSON.stringify(filas.map((i) => i.json), null, 2));
console.log('\nPeticiones gastadas en esta prueba:', peticiones);
