const plan = $('Plan Adzuna').all();
const out = []; let errores = 0, n = 0;
for (const { json: r } of $input.all()) {
  if (r.error) { errores++; out.push({ json: fallo('adzuna', mensajeError(r.error)) }); continue; }
  for (const j of r.results ?? []) {
    n++;
    const predicho = String(j.salary_is_predicted) === '1'; // salario estimado por Adzuna: no lo usamos para descartar
    out.push({ json: oferta({
      fuente: 'adzuna',
      titulo: stripHtml(j.title),
      empresa: j.company?.display_name,
      ubicacion: j.location?.display_name,
      pais: 'ES',
      salario_min: predicho ? null : j.salary_min, salario_max: predicho ? null : j.salary_max,
      salario_periodo: 'year', salario_moneda: 'EUR',
      salario_texto: predicho || !j.salary_min ? '' : `${j.salary_min}-${j.salary_max} €/año`,
      fecha: j.created,
      url: j.redirect_url,
      descripcion: stripHtml(j.description),
    }) });
  }
}
out.push({ json: uso('adzuna', plan.length, n, errores) });
return out;
