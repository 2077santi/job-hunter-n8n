// ---- salario: bruto anual -> neto (aprox. Barcelona, soltero, sin hijos, 12 pagas) ----
const TABLA_NETO = [[15000, 12900], [20000, 16300], [25000, 19900], [30000, 23200], [35000, 26400], [40000, 29600],
  [45000, 32600], [50000, 35400], [60000, 40900], [70000, 46100], [80000, 51200], [100000, 61500], [150000, 86000]];
function netoAnual(bruto) {
  if (bruto <= TABLA_NETO[0][0]) return bruto * TABLA_NETO[0][1] / TABLA_NETO[0][0];
  for (let i = 1; i < TABLA_NETO.length; i++) {
    const [b0, n0] = TABLA_NETO[i - 1], [b1, n1] = TABLA_NETO[i];
    if (bruto <= b1) return n0 + (n1 - n0) * (bruto - b0) / (b1 - b0);
  }
  return bruto * 0.57;
}
const TIPO_EUR = { EUR: 1, USD: 0.92, GBP: 1.17, CHF: 1.05 };

function parseSalarioTexto(t) {
  const s = String(t ?? '').replace(/ /g, ' ');
  if (!s || /per task|por tarea|commission only|solo comisi/i.test(s)) return null;
  const moneda = /\$|usd/i.test(s) ? 'USD' : /£|gbp/i.test(s) ? 'GBP' : /chf/i.test(s) ? 'CHF' : 'EUR';
  const nums = [...s.matchAll(/(\d{1,3}(?:[.,\s]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|mil)?/gi)].map(([, n, k]) => {
    let v = /[.,\s]\d{3}$/.test(n) ? Number(n.replace(/[.,\s]/g, '')) : Number(n.replace(',', '.'));
    if (k) v *= 1000;
    return v;
  }).filter((v) => v >= 5);
  if (!nums.length) return null;
  const periodo = /hour|hora|\/h\b|\bh\b/i.test(s) ? 'hour' : /day|día|dia\b/i.test(s) ? 'day'
    : /month|mes|mensual|\/m\b/i.test(s) ? 'month' : /year|año|anual|annual|\/y|p\.a\./i.test(s) ? 'year' : '';
  return { min: Math.min(...nums), max: Math.max(...nums), periodo, moneda };
}

// Devuelve { neto_mes_max, bruto_anual_max } o null si no hay datos fiables
function estimaSalario(o) {
  let d = o.salario_max || o.salario_min
    ? { min: o.salario_min || o.salario_max, max: o.salario_max || o.salario_min, periodo: String(o.salario_periodo || '').toLowerCase(), moneda: (o.salario_moneda || 'EUR').toUpperCase() }
    : parseSalarioTexto(o.salario_texto);
  if (!d || !d.max) return null;
  const mult = { hour: 1760, day: 220, week: 46, month: 12, year: 1, yearly: 1, annual: 1, monthly: 12, hourly: 1760 }[d.periodo]
    ?? (d.max < 400 ? 1760 : d.max < 15000 ? 12 : 1);
  const bruto = d.max * mult * (TIPO_EUR[d.moneda] ?? 1);
  if (bruto < 8000 || bruto > 400000) return null; // dato raro: no penalizar
  return { bruto_anual_max: Math.round(bruto), neto_mes_max: Math.round(netoAnual(bruto) / 12) };
}
// ---- fin salario ----
