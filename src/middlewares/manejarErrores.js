const { ErrorApi } = require('../utils/errores');

// Último middleware: convierte cualquier error en la respuesta JSON estándar de la API.
// eslint-disable-next-line no-unused-vars
module.exports = function manejarErrores(error, req, res, next) {
  if (error instanceof ErrorApi) {
    return res.status(error.estado).json({ error: { codigo: error.codigo, mensaje: error.message } });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { codigo: 'DATOS_INVALIDOS', mensaje: 'El cuerpo de la petición no es un JSON válido.' },
    });
  }
  if (error.type === 'entity.too.large') {
    return res.status(400).json({
      error: { codigo: 'DATOS_INVALIDOS', mensaje: 'El cuerpo de la petición es demasiado grande.' },
    });
  }
  console.error(error);
  return res.status(500).json({
    error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado.' },
  });
};
