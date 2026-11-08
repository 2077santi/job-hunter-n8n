// Resumen diario: ofertas detectadas hoy por debajo del umbral + uso de APIs del día
const c = $('Config').first().json;
const hoy = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 10);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const filas = $('Leer ofertas (resumen)').all().map((i) => i.json).filter((r) => String(r.fecha_detectada ?? '').startsWith(hoy));
const usoHoy = $input.all().map((i) => i.json).filter((r) => String(r.fecha ?? '').startsWith(hoy));
const altas = filas.filter((r) => Number(r.score) >= c.SCORE_ALERTA && r.estado !== 'Descartado');
const resto = filas.filter((r) => Number(r.score) < c.SCORE_ALERTA && r.estado !== 'Descartado').sort((a, b) => b.score - a.score);
const porFuente = {};
for (const u of usoHoy) { const k = u.fuente; porFuente[k] ??= { pet: 0, err: 0, coste: 0 }; porFuente[k].pet += Number(u.peticiones) || 0; porFuente[k].err += Number(u.errores) || 0; porFuente[k].coste += Number(u.coste_usd) || 0; }
const mes = hoy.slice(0, 7);
const jsearchMes = $input.all().map((i) => i.json).filter((r) => r.fuente === 'jsearch' && String(r.fecha ?? '').startsWith(mes)).reduce((n, r) => n + (Number(r.peticiones) || 0), 0);
const costeHoy = Object.values(porFuente).reduce((n, v) => n + v.coste, 0);

const lineas = [`📋 <b>Resumen ${hoy}</b>`, `Nuevas hoy: ${filas.length} · ≥${c.SCORE_ALERTA}: ${altas.length} (ya avisadas) · resto: ${resto.length}`, ''];
for (const r of resto.slice(0, 15)) lineas.push(`• <b>${r.score}</b> <a href="${esc(r.url)}">${esc(r.titulo)}</a> — ${esc(r.empresa)} (${esc(r.modalidad)})`);
if (resto.length > 15) lineas.push(`…y ${resto.length - 15} más en la hoja.`);
lineas.push('', '<b>Peticiones hoy</b>: ' + Object.entries(porFuente).filter(([k]) => k !== 'filtros').map(([k, v]) => `${k} ${v.pet}${v.err ? ` (⚠️${v.err})` : ''}`).join(' · '));
lineas.push(`JSearch este mes: ${jsearchMes}/${c.JSEARCH_CUOTA_MES} · Claude hoy: ${costeHoy.toFixed(3)} $`);
return [{ json: { texto: lineas.join('\n').slice(0, 4000) } }];
