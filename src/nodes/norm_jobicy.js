const plan = $('Plan Jobicy').all();
const out = []; let errores = 0, n = 0;
for (const { json: r } of $input.all()) {
  if (r.error) { errores++; out.push({ json: fallo('jobicy', mensajeError(r.error)) }); continue; }
  for (const j of r.jobs ?? []) {
    n++;
    out.push({ json: oferta({
      fuente: 'jobicy', titulo: stripHtml(j.jobTitle), empresa: j.companyName, ubicacion: j.jobGeo, modalidad: 'remoto',
      salario_min: j.salaryMin ?? j.annualSalaryMin, salario_max: j.salaryMax ?? j.annualSalaryMax,
      salario_periodo: j.salaryPeriod ?? 'year', salario_moneda: j.salaryCurrency ?? '',
      fecha: j.pubDate, url: j.url, descripcion: stripHtml(j.jobDescription || j.jobExcerpt),
    }) });
  }
}
out.push({ json: uso('jobicy', plan.length, n, errores) });
return out;
