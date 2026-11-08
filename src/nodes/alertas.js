// Mensajes de Telegram para score >= umbral (texto HTML + URL del botón)
const c = $('Config').first().json;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
return $('Parsear score').all().map((i) => i.json).filter((f) => f.estado !== 'Descartado' && !f.red_flags.includes('fantasma') && Number(f.score) >= c.SCORE_ALERTA).map((f) => {
  const lineas = [
    `🔥 <b>${f.score}/100</b> · ${esc(f.categoria)}`,
    `<b>${esc(f.titulo)}</b> — ${esc(f.empresa || '¿empresa?')}`,
    `📍 ${esc(f.ubicacion || '?')} · ${esc(f.modalidad)}`,
    `💶 ${esc(f.salario_publicado || 'no indicado')}${f.salario_estimado_neto_mes ? ` (≈${f.salario_estimado_neto_mes} € netos/mes)` : ''}`,
    f.motivos_match && `✅ ${esc(f.motivos_match)}`,
    f.gaps && `⚠️ ${esc(f.gaps)}`,
    f.red_flags && `🚩 ${esc(f.red_flags)}`,
    `<a href="${esc(f.url)}">Ver oferta</a> · ${esc(f.fuente)}`,
  ].filter(Boolean);
  const cvUrl = `${c.N8N_BASE_URL.replace(/\/$/, '')}/webhook/cv-adaptado?id=${encodeURIComponent(f.id)}`;
  return { json: { texto: lineas.join('\n').slice(0, 4000), cv_url: cvUrl } };
});
