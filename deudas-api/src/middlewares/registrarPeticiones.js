// Registra una línea por petición: fecha, método, ruta, código de respuesta, duración e IP.
// No escribe el cuerpo, los encabezados ni la query string, para no dejar tokens ni contraseñas en los logs.
module.exports = function registrarPeticiones(req, res, next) {
  const inicio = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    const ruta = req.originalUrl.split('?')[0];
    console.log(
      `${new Date().toISOString()} ${req.method} ${ruta} ${res.statusCode} ${ms.toFixed(1)}ms ip=${req.ip}`
    );
  });
  next();
};
