const plan = $('Plan Remotive').all().map((i) => i.json);
if (plan[0]?._skip) return [{ json: uso('remotive', 0, 0, 0, plan[0].nota) }];
const out = []; let errores = 0, n = 0;
for (const { json: r } of $input.all()) {
  if (r.error) { errores++; out.push({ json: fallo('remotive', mensajeError(r.error)) }); continue; }
  for (const j of r.jobs ?? []) {
    n++;
    out.push({ json: oferta({
      fuente: 'remotive', titulo: j.title, empresa: j.company_name,
      ubicacion: j.candidate_required_location, modalidad: 'remoto',
      salario_texto: j.salary ?? "", fecha: j.publication_date,
      url: j.url, descripcion: stripHtml(j.description),
    }) });
  }
}
out.push({ json: uso('remotive', plan.length, n, errores) });
return out;
