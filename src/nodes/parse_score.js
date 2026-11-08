// Junta cada respuesta de Claude con su oferta (mismo orden que la entrada del HTTP) y monta la fila de Sheets.
const c = $('Config').first().json;
const prep = $('Preparar scoring').all().map((i) => i.json);
const hoy = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 16);
const CAT = { '1': '1 · Automatización IA', '2': '2 · Operations/BA', '3': '3 · Customer Success', bonus: 'Bonus · PO/IT BP', ninguna: 'Ninguna' };
const filas = [];
let errores = [], tin = 0, tout = 0, tcache = 0;
$input.all().forEach(({ json: r }, i) => {
  const o = prep[i]?.oferta;
  if (!o) return;
  if (r.error) { errores.push(`${o.titulo}: ${mensajeError(r.error)}`); return; }
  tin += (r.usage?.input_tokens ?? 0) + (r.usage?.cache_creation_input_tokens ?? 0);
  tcache += r.usage?.cache_read_input_tokens ?? 0;
  tout += r.usage?.output_tokens ?? 0;
  if (r.stop_reason === 'refusal' || r.stop_reason === 'max_tokens') { errores.push(`${o.titulo}: stop_reason=${r.stop_reason}`); return; }
  let s;
  try { s = JSON.parse((r.content ?? []).find((b) => b.type === 'text')?.text); }
  catch (e) { errores.push(`${o.titulo}: JSON inválido`); return; }
  const descartada = s.salario_por_debajo_minimo === true;
  filas.push({
    id: o.id,
    fecha_detectada: hoy,
    score: s.score,
    categoria: CAT[s.puesto_categoria] ?? s.puesto_categoria,
    titulo: o.titulo,
    empresa: o.empresa,
    ubicacion: o.ubicacion,
    modalidad: o.modalidad,
    salario_publicado: o.salario_texto || (o.salario_max ? `${o.salario_min ?? ''}-${o.salario_max} ${o.salario_moneda} ${o.salario_periodo}` : ''),
    salario_estimado_neto_mes: s.salario_estimado_neto_mes ?? '',
    idioma: o.idioma,
    fecha_publicacion: o.fecha ? o.fecha.slice(0, 10) : '',
    fuente: o.fuente,
    url: o.url,
    motivos_match: (s.motivos_match ?? []).join(' · '),
    gaps: (s.gaps ?? []).join(' · '),
    red_flags: [...(s.red_flags ?? []), ...(s.posible_oferta_fantasma ? ['⚠️ posible oferta fantasma'] : [])].join(' · '),
    resumen: s.resumen,
    estado: descartada ? 'Descartado' : 'Por postular',
    fecha_postulacion: '',
    fecha_respuesta: '',
    notas: descartada ? 'Auto: salario por debajo del mínimo' : '',
    clave_dedupe: o.clave_dedupe,
  });
});
// Coste Haiku 5.5: 0,10 $/MTok entrada, 0,50 $/MTok salida, lectura de caché 0,01 $/MTok
const coste = (tin * 0.10 + tcache * 0.01 + tout * 0.50) / 1e6;
$getWorkflowStaticData('global').ultimoScoring = { llamadas: prep.length, ok: filas.length, errores, tin, tcache, tout, coste };
return filas.map((f) => ({ json: f }));
