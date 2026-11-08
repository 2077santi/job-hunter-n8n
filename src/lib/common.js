// ---- helpers comunes (el build los inyecta al principio de cada nodo Code que los usa) ----
const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const normTxt = (s) => sinAcentos(s).toLowerCase().replace(/\s+/g, ' ').trim();

function stripHtml(html) {
  return String(html ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&#039;|&rsquo;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

function detectaModalidad(texto, flagRemoto) {
  const t = normTxt(texto);
  if (/hibrid|hybrid/.test(t)) return 'híbrido';
  if (flagRemoto === true || /\b(remote|remoto|teletrabajo|teletreball|en remot|work from home|100% remot|fully remote)\b/.test(t)) return 'remoto';
  if (/presencial|on-?site|in-?office|en oficina/.test(t)) return 'presencial';
  return 'desconocida';
}

function detectaIdioma(texto) {
  const t = ' ' + normTxt(texto).slice(0, 3000) + ' ';
  const cuenta = (ws) => ws.reduce((n, w) => n + (t.split(` ${w} `).length - 1), 0);
  const p = {
    en: cuenta(['the', 'and', 'with', 'you', 'our', 'will', 'for', 'experience']),
    es: cuenta(['el', 'los', 'las', 'con', 'para', 'experiencia', 'y', 'una', 'del']),
    ca: cuenta(['els', 'les', 'amb', 'per', 'experiencia', 'i', 'una', 'del', 'aquesta']),
    de: cuenta(['und', 'der', 'die', 'mit', 'wir', 'sie', 'fur']),
    fr: cuenta(['et', 'les', 'avec', 'vous', 'nous', 'pour', 'des']),
  };
  const [top, n] = Object.entries(p).sort((a, b) => b[1] - a[1])[0];
  return n >= 3 ? top : 'desconocido';
}

function aIso(x) {
  if (x === null || x === undefined || x === '') return '';
  if (typeof x === 'string' && /T\d\d:\d\d(:\d\d)?$/.test(x)) x += 'Z'; // sin zona = UTC
  const d = typeof x === 'number' ? new Date(x < 1e12 ? x * 1000 : x) : new Date(x);
  return isNaN(d) ? '' : d.toISOString();
}

// "hace 21 horas", "hace 3 días", "2 days ago" -> ISO
function fechaRelativa(t) {
  const m = normTxt(t).match(/(\d+)\s*(minuto|minute|hora|hour|dia|day|semana|week|mes|month)/);
  if (!m) return '';
  const ms = { minuto: 6e4, minute: 6e4, hora: 36e5, hour: 36e5, dia: 864e5, day: 864e5, semana: 6048e5, week: 6048e5, mes: 2592e6, month: 2592e6 }[m[2]];
  return new Date(Date.now() - Number(m[1]) * ms).toISOString();
}

// Hash corto y estable para ids (FNV-1a 32 bits)
function hash(s) {
  let h = 0x811c9dc5;
  for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

function claveTituloEmpresa(titulo, empresa) {
  const limpia = (s) => normTxt(s)
    .replace(/\((m|f|h|w|d|x)(\/(m|f|h|w|d|x))*\)/g, ' ')
    .replace(/\b(s\.?l\.?u?|s\.?a\.?|gmbh|ltd|inc|llc|bv)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();
  return `${limpia(titulo)}|${limpia(empresa)}`;
}

// El sandbox de Code de n8n no tiene URL ni URLSearchParams
class QS {
  constructor(o = {}) { this.o = { ...o }; }
  set(k, v) { this.o[k] = v; }
  append(k, v) { this.o[k] = v; }
  toString() { return Object.entries(this.o).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&'); }
}

function urlCanonica(u) {
  if (!u) return '';
  const txt = String(u).trim();
  const m = txt.match(/^(https?:)\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?/i);
  if (!m) return txt;
  const [, protocolo, hostRaw, path, query = ''] = m;
  const host = hostRaw.toLowerCase().replace(/^www\./, '');
  const param = (k) => { const r = query.match(new RegExp(`(?:^|&)${k}=([^&]*)`)); return r ? decodeURIComponent(r[1]) : ''; };
  const li = path.match(/\/jobs\/view\/(?:[^/]*-)?(\d{6,})/);
  if (host.endsWith('linkedin.com') && li) return `https://www.linkedin.com/jobs/view/${li[1]}/`;
  if (host.endsWith('linkedin.com') && param('currentJobId')) return `https://www.linkedin.com/jobs/view/${param('currentJobId')}/`;
  if (host.includes('glassdoor') && param('jobListingId')) return `https://www.glassdoor.es/job-listing/j?jl=${param('jobListingId')}`;
  return `${protocolo}//${host}${path.replace(/\/$/, '')}`;
}

function oferta(o) {
  const descripcion = String(o.descripcion ?? '').slice(0, 4000);
  const titulo = String(o.titulo ?? '').trim();
  const empresa = String(o.empresa ?? '').trim();
  const clave = claveTituloEmpresa(titulo, empresa);
  return {
    _tipo: 'oferta',
    id: hash(clave),
    fuente: o.fuente,
    titulo,
    empresa,
    ubicacion: String(o.ubicacion ?? '').trim(),
    pais: o.pais ?? '',
    modalidad: o.modalidad ?? detectaModalidad(`${titulo} ${o.ubicacion ?? ''} ${descripcion.slice(0, 1500)}`, o.remoto),
    salario_texto: o.salario_texto ?? '',
    salario_min: Number(o.salario_min) || null,
    salario_max: Number(o.salario_max) || null,
    salario_periodo: o.salario_periodo ?? '',
    salario_moneda: o.salario_moneda ?? '',
    idioma: o.idioma ?? detectaIdioma(`${titulo} ${descripcion}`),
    fecha: aIso(o.fecha),
    url: o.url ?? '',
    url_canonica: urlCanonica(o.url),
    clave_dedupe: clave,
    descripcion,
  };
}

const uso = (fuente, peticiones, ofertas, errores, nota = '') =>
  ({ _tipo: 'uso', fuente, peticiones, ofertas, errores, nota });
const fallo = (fuente, mensaje) => ({ _tipo: 'error', fuente, mensaje: String(mensaje).slice(0, 300) });
const mensajeError = (e) => e?.message || e?.description || JSON.stringify(e).slice(0, 300);
// ---- fin helpers ----
