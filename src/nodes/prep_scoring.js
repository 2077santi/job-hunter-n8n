// Construye la petición a Claude Haiku por oferta. El system prompt (CV + rúbrica) es idéntico en todas -> se cachea.
const c = $('Config').first().json;
const ofertas = $input.all().map((i) => i.json).filter((o) => o.titulo);
if (!ofertas.length) return [];
const kw = Object.entries(c.KEYWORDS).map(([k, v]) => `- ${k}: ${v.join(', ')}`).join('\n');
const system = `Eres un headhunter en Barcelona que evalúa ofertas de empleo para un candidato concreto. Sé exigente y realista.

<cv>
${c.CV_PERFIL}
</cv>

<categorias>
1 = Automatización con IA (n8n, Make, Zapier, APIs de LLM, AI automation specialist)
4 = AI Operations, evaluación de LLM, calidad de datos de IA, AI data program operations
2 = Operations Analyst / Business Analyst / Process Improvement
5 = Support/CX Operations, análisis de contact center, WFM, Trust & Safety Operations
6 = Data Analyst, BI o Reporting con SQL y Power BI
3 = Customer Success (plan C)
bonus = Product Owner junior / IT Business Partner
ninguna = no encaja en ninguna
Keywords de referencia:
${kw}
</categorias>

<rubrica>
score 0-100 = probabilidad de que merezca la pena postular y pasar el primer filtro:
- Encaje de funciones y stack con el CV (40 pts). Las categorías 1 y 4 puntúan más alto a igual encaje; en la 6 penaliza si piden ingeniería de datos o estadística avanzada; la 3 se queda como mucho en 75 salvo encaje excepcional.
- Seniority: el candidato tiene ~3,5 años; penaliza fuerte si piden 6+ años o rol de manager de equipo; penaliza prácticas/junior extremo (20 pts).
- Ubicación/modalidad: Barcelona cualquier modalidad; fuera de Barcelona solo remoto desde España/Europa (15 pts).
- Idioma: inglés, castellano o catalán OK; si exige otro idioma, score <= 30 (10 pts).
- Requisitos duros que no tiene (Salesforce, SAP, ingeniería formal, etc.) restan (15 pts).
Calibración: 85+ encaje casi perfecto; 75-84 postular ya; 60-74 posible; 40-59 flojo; <40 no encaja.
Si la descripción está vacía o es muy corta (alertas de email), puntúa solo con título/empresa/ubicación, no pases de 80 y dilo en gaps.
</rubrica>

<salario>
Mínimo del candidato: ${c.SALARIO_MIN_NETO_MES} € netos/mes (≈40-41 k€ brutos/año en Barcelona, 12 pagas).
salario_estimado_neto_mes: si la oferta da salario, conviértelo a neto mensual aproximado en España; si no lo da, estima por rol/empresa/ubicación o null si no hay base. No penalices el score por no indicar salario.
salario_por_debajo_minimo: true SOLO si la oferta indica explícitamente un salario claramente inferior al mínimo.
</salario>

<red_flags>
Señales de oferta fantasma o dudosa: descripción genérica sin funciones concretas, empresa oculta o "confidencial" sin contexto, "bolsa de candidatos", republicada constantemente, salario irreal, solo comisiones, pagos por formación, requisitos contradictorios. posible_oferta_fantasma = true si hay 2 o más señales fuertes.
</red_flags>

Responde en castellano, con frases cortas. motivos_match y gaps: máximo 4 elementos cada uno.`;

const schema = {
  type: 'object', additionalProperties: false,
  required: ['score', 'puesto_categoria', 'motivos_match', 'gaps', 'salario_estimado_neto_mes', 'salario_por_debajo_minimo', 'red_flags', 'posible_oferta_fantasma', 'resumen'],
  properties: {
    score: { type: 'integer' },
    puesto_categoria: { type: 'string', enum: ['1', '2', '3', '4', '5', '6', 'bonus', 'ninguna'] },
    motivos_match: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' } },
    salario_estimado_neto_mes: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    salario_por_debajo_minimo: { type: 'boolean' },
    red_flags: { type: 'array', items: { type: 'string' } },
    posible_oferta_fantasma: { type: 'boolean' },
    resumen: { type: 'string' },
  },
};

return ofertas.map((o) => ({ json: {
  oferta: o,
  body: {
    model: c.MODELO,
    max_tokens: 3000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content:
`<oferta>
Título: ${o.titulo}
Empresa: ${o.empresa || '(no indicada)'}
Ubicación: ${o.ubicacion || '(no indicada)'} · Modalidad: ${o.modalidad}
Salario publicado: ${o.salario_texto || (o.salario_max ? `${o.salario_min}-${o.salario_max} ${o.salario_moneda} ${o.salario_periodo}` : 'no indicado')}
Fecha: ${o.fecha || '?'} · Fuente: ${o.fuente}
Descripción:
${o.descripcion || '(sin descripción: solo datos de la alerta)'}
</oferta>` }],
  },
} }));
