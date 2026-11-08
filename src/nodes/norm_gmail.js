// Recibe la respuesta de Claude (o el item _skip si no hubo correos)
const entrada = $input.all();
if (entrada[0]?.json._skip) return [{ json: uso('gmail', 1, 0, 0, 'sin alertas nuevas') }];
const prep = $('Preparar correos').all().map((i) => i.json);
const out = []; let errores = 0, n = 0, tin = 0, tout = 0;
entrada.forEach(({ json: r }, i) => {
  const m = prep[i] ?? {};
  if (r.error) { errores++; out.push({ json: fallo('gmail', `extracción "${m.asunto}": ${mensajeError(r.error)}`) }); return; }
  tin += r.usage?.input_tokens ?? 0; tout += r.usage?.output_tokens ?? 0;
  let datos;
  try { datos = JSON.parse((r.content ?? []).find((b) => b.type === 'text')?.text ?? '{}'); }
  catch (e) { errores++; out.push({ json: fallo('gmail', `JSON inválido en "${m.asunto}"`) }); return; }
  const remitente = String(m.remitente ?? '').toLowerCase();
  const fuente = remitente.includes('linkedin') ? 'linkedin' : remitente.includes('infojobs') ? 'infojobs' : remitente.includes('glassdoor') ? 'glassdoor' : 'gmail';
  for (const o of datos.ofertas ?? []) {
    if (!o.titulo) continue;
    n++;
    out.push({ json: oferta({
      fuente: `${fuente} (alerta)`, titulo: o.titulo, empresa: o.empresa, ubicacion: o.ubicacion,
      modalidad: o.modalidad === 'desconocida' ? undefined : o.modalidad,
      salario_texto: o.salario, fecha: m.fecha, url: m.links?.[o.link_ref] ?? '',
      descripcion: '', idioma: 'desconocido',
    }) });
  }
});
out.push({ json: uso('gmail', prep.length, n, errores, `correos: ${prep.length}`) });
if (prep.length) out.push({ json: { _tipo: 'tokens', fuente: 'claude-extraccion', llamadas: prep.length, input_tokens: tin, output_tokens: tout } });
return out;
