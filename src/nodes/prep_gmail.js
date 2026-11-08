// Sustituye cada enlace por [Ln] para que Claude devuelva la referencia y no tenga que copiar URLs largas.
const c = $('Config').first().json;
const correos = $input.all().map((i) => i.json).filter((m) => m.id && (m.html || m.text));
if (!correos.length) return [{ json: { _skip: true } }];
const RUIDO = /unsubscribe|darse de baja|baja|settings|preferenc|privacy|privacidad|help|ayuda|premium|app-store|play\.google|apps\.apple|feed\/|\/mynetwork|\/notifications/i;
const schema = {
  type: 'object', additionalProperties: false, required: ['ofertas'],
  properties: { ofertas: { type: 'array', items: {
    type: 'object', additionalProperties: false,
    required: ['titulo', 'empresa', 'ubicacion', 'modalidad', 'salario', 'link_ref'],
    properties: {
      titulo: { type: 'string' }, empresa: { type: 'string' }, ubicacion: { type: 'string' },
      modalidad: { type: 'string', enum: ['remoto', 'híbrido', 'presencial', 'desconocida'] },
      salario: { type: 'string' }, link_ref: { type: 'string' },
    } } } },
};
return correos.map((m) => {
  const links = {}; let n = 0;
  let html = String(m.html || m.textAsHtml || '');
  html = html.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, txt) => {
    if (RUIDO.test(href)) return txt;
    const ref = `L${++n}`; links[ref] = href.replace(/&amp;/g, '&');
    return `${txt} [${ref}]`;
  });
  const texto = (html ? stripHtml(html) : String(m.text)).slice(0, 15000);
  return { json: {
    _skip: false,
    remitente: typeof m.from === 'object' ? m.from?.text : m.from,
    asunto: m.subject, fecha: m.date, links,
    body: {
      model: c.MODELO, max_tokens: 6000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      system: 'Extraes ofertas de empleo de correos de alertas (LinkedIn, InfoJobs, Glassdoor). Devuelve solo ofertas concretas de empleo. Cada oferta va seguida de una referencia de enlace como [L3]: devuelve esa referencia en link_ref (ej. "L3"), la del enlace de la oferta, no la de la empresa. Si un dato no aparece, usa cadena vacía. No inventes.',
      messages: [{ role: 'user', content: `Remitente: ${m.from?.text ?? m.from}\nAsunto: ${m.subject}\n\n${texto}` }],
    },
  } };
});
