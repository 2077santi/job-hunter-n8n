// Entrada: filas ya guardadas en Sheets ($input). Ofertas: salida de "Unir fuentes".
const c = $('Config').first().json;
const st = $getWorkflowStaticData('global'); st.ultimoScoring = null;
const todo = $('Unir fuentes').all().map((i) => i.json);
const ofertas = todo.filter((x) => x._tipo === 'oferta');
const filas = $input.all().map((i) => i.json).filter((r) => r && (r.url || r.clave_dedupe));
const vistas = new Set();
for (const r of filas) { if (r.url) vistas.add(urlCanonica(r.url)); if (r.clave_dedupe) vistas.add(r.clave_dedupe); if (r.id) vistas.add(`id:${r.id}`); }

const rx = (lista) => lista.map((p) => new RegExp(p, 'i'));
const RELEV = rx(c.RELEVANTES_TITULO), EXCL = rx(c.EXCLUIR_TITULO), EXCL_SALVO = rx(c.EXCLUIR_TITULO_SALVO_AUTOMATIZACION);
const AUTOM = /automat|n8n|zapier|\bmake\b|\brpa\b|workflow|low.?code/i;
const BCN = /barcelona|\bbcn\b|hospitalet|badalona|sant cugat|cornella|el prat|terrassa|sabadell|mataro|granollers|castelldefels|viladecans|sant boi|esplugues|sant joan despi|\brubi\b|cerdanyola|molins de rei|gava|martorell|sant just/;
const REMOTO_OK = /espana|spain|espanya|europe|europa|emea|\bcet\b|\bcest\b|worldwide|anywhere|global|international|^remote$|^remoto$|^$/;
const ANIOS = /(\d{1,2})\s*\+?\s*(?:(?:-|–|a|to)\s*\d{1,2}\s*)?(?:anos|years?|yrs|anys)\b(?:\s+(?:de|of|d'))?[^.\n]{0,40}experi/g;

const motivo = (o) => {
  const t = normTxt(o.titulo), loc = normTxt(o.ubicacion);
  if (EXCL.some((r) => r.test(t))) return 'título excluido';
  if (!AUTOM.test(t) && EXCL_SALVO.some((r) => r.test(t))) return 'perfil técnico/no objetivo';
  if (!RELEV.some((r) => r.test(t))) return 'título no relevante';
  if (o.idioma === 'de' || o.idioma === 'fr') return `oferta en ${o.idioma}`;
  const enBcn = BCN.test(loc);
  if (!enBcn) {
    if (o.modalidad !== 'remoto') return 'fuera de Barcelona y no remoto';
    if (!(REMOTO_OK.test(loc) || o.pais === 'ES')) return 'remoto fuera de España/Europa';
  }
  if (o.fecha) {
    const dias = (Date.now() - new Date(o.fecha)) / 86400000;
    if (dias > c.MAX_DIAS) return `antigua (${Math.floor(dias)} días)`;
  }
  const anios = [...normTxt(o.descripcion).matchAll(ANIOS)].map((m) => Number(m[1])).filter((n) => n < 30);
  if (anios.length && Math.min(...anios) > c.ANIOS_EXPERIENCIA_MAX) return `pide ${Math.min(...anios)}+ años`;
  const sal = estimaSalario(o);
  if (sal && sal.neto_mes_max < c.SALARIO_MIN_NETO_MES * c.SALARIO_TOLERANCIA) return `salario bajo (~${sal.neto_mes_max} € netos/mes)`;
  return null;
};

const prioridad = (o) => {
  const t = normTxt(o.titulo);
  if (AUTOM.test(t) || /\bai\b|\bia\b|llm|gen ?ai/.test(t)) return 1;
  if (/operation|operacion|analyst|analista|process|proces|revops/.test(t)) return 2;
  if (/product owner|business partner/.test(t)) return 2.5;
  return 3;
};

const descartes = {}; const candidatas = new Map();
for (const o of ofertas) {
  if (!o.titulo) continue;
  if (vistas.has(o.url_canonica) || vistas.has(o.clave_dedupe) || vistas.has(`id:${o.id}`)) { descartes['ya guardada'] = (descartes['ya guardada'] ?? 0) + 1; continue; }
  const m = motivo(o);
  if (m) { const k = m.replace(/\s*\(.*\)$/, '').replace(/\d+\+ años/, '8+ años'); descartes[k] = (descartes[k] ?? 0) + 1; continue; }
  const previa = candidatas.get(o.clave_dedupe);
  const nueva = { ...o, _prioridad: prioridad(o), salario_neto_mes_hard: estimaSalario(o)?.neto_mes_max ?? null };
  if (previa) {
    descartes['duplicada entre fuentes'] = (descartes['duplicada entre fuentes'] ?? 0) + 1;
    const fuentes = [...new Set([...previa.fuente.split('+'), o.fuente])].join('+');
    // Nos quedamos con la versión con más descripción
    candidatas.set(o.clave_dedupe, o.descripcion.length > previa.descripcion.length ? { ...nueva, fuente: fuentes } : { ...previa, fuente: fuentes });
    continue;
  }
  candidatas.set(o.clave_dedupe, nueva);
}
// Una misma URL puede llegar con distinto título (alertas): quitar repetidas por URL
const porUrl = new Set();
const lista = [...candidatas.values()].filter((o) => !o.url_canonica || (!porUrl.has(o.url_canonica) && porUrl.add(o.url_canonica)))
  .sort((a, b) => a._prioridad - b._prioridad || (b.fecha || '').localeCompare(a.fecha || ''));
const aPuntuar = lista.slice(0, c.MAX_SCORING_POR_EJECUCION);

// Resumen del filtrado para el log (se lee desde "Registrar uso")
$getWorkflowStaticData('global').ultimoFiltrado = { recibidas: ofertas.length, candidatas: lista.length, puntuadas: aPuntuar.length, descartes };
return aPuntuar.map((o) => ({ json: o }));
