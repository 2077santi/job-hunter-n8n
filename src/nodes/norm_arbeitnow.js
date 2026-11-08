const plan = $('Plan Arbeitnow').all();
const out = []; let errores = 0, n = 0;
for (const { json: r } of $input.all()) {
  if (r.error) { errores++; out.push({ json: fallo('arbeitnow', mensajeError(r.error)) }); continue; }
  for (const j of r.data ?? []) {
    n++;
    out.push({ json: oferta({
      fuente: 'arbeitnow', titulo: j.title, empresa: j.company_name, ubicacion: j.location,
      remoto: j.remote === true, modalidad: j.remote === true ? 'remoto' : undefined,
      fecha: j.created_at, url: j.url, descripcion: stripHtml(j.description),
    }) });
  }
}
out.push({ json: uso('arbeitnow', plan.length, n, errores) });
return out;
