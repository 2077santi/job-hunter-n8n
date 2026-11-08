import fs from 'node:fs';
import { crearEntorno, codigoNodo } from './harness.mjs';
const env = crearEntorno();
if (!fs.existsSync(new URL('../samples/', import.meta.url))) { console.log('samples/ no se publica (datos reales): genera los tuyos con test/probar_fuentes.mjs'); process.exit(0); }
const S = (f) => JSON.parse(fs.readFileSync(new URL(`../samples/${f}`, import.meta.url)));
const cfgCode = fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
env.run('Config', cfgCode, [{ json: {} }], []);
console.log('modo:', env.salidas.Config[0].json._modo);
for (const s of ['JSearch', 'Remotive', 'Adzuna', 'InfoJobs']) console.log(s, JSON.stringify(env.run(`Plan ${s}`, `plan_${s.toLowerCase()}.js`).map((i) => i.json)).slice(0, 300));

env.run('Plan Arbeitnow', 'plan_arbeitnow.js'); env.run('Plan Jobicy', 'plan_jobicy.js');
const norm = {
  remotive: env.run('Norm Remotive', 'norm_remotive.js', [{ json: S('remotive.json') }]),
  arbeitnow: env.run('Norm Arbeitnow', 'norm_arbeitnow.js', [{ json: S('arbeitnow.json') }, { json: { error: { message: '503 Service Unavailable' } } }]),
  jobicy: env.run('Norm Jobicy', 'norm_jobicy.js', [{ json: S('jobicy_es.json') }, { json: S('jobicy_eu.json') }]),
  infojobs: env.run('Norm InfoJobs', 'norm_infojobs.js', [{ json: { _skip: true } }]),
};
for (const [k, v] of Object.entries(norm)) {
  const of = v.filter((i) => i.json._tipo === 'oferta');
  console.log(`\n== ${k}: ${of.length} ofertas`, JSON.stringify(v.filter((i) => i.json._tipo !== 'oferta').map((i) => i.json)));
  if (of[0]) { const o = { ...of[0].json, descripcion: of[0].json.descripcion.slice(0, 80) }; console.log(o); }
}
const todas = Object.values(norm).flat();
fs.writeFileSync(new URL('../samples/_unidas.json', import.meta.url), JSON.stringify(todas));
