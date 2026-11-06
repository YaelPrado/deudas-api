const jwt = require('jsonwebtoken');
const config = require('../config');
const authService = require('../services/auth.service');
const { noAutenticado, tokenInvalido, tokenExpirado } = require('../utils/errores');

// Exige "Authorization: Bearer <token>". Además de verificar la firma y la caducidad del token,
// comprueba que su sesión siga viva (no cerrada ni revocada). Deja en la petición:
//   req.usuarioId, req.rol y req.sesionId.
async function autenticar(req, res, next) {
  const [esquema, token] = (req.headers.authorization || '').split(' ');
  if (esquema !== 'Bearer' || !token) throw noAutenticado();

  let carga;
  try {
    carga = jwt.verify(token, config.jwt.secreto, { algorithms: ['HS256'] });
  } catch (error) {
    throw error.name === 'TokenExpiredError' ? tokenExpirado() : tokenInvalido();
  }
  // Los tokens emitidos antes de existir las sesiones no traen "sid": hay que iniciar sesión de nuevo.
  if (typeof carga.sid !== 'string' || typeof carga.sub !== 'string') throw tokenInvalido();

  const sesion = await authService.verificarSesion(carga.sid, carga.sub);
  req.usuarioId = sesion.usuarioId;
  req.rol = sesion.rol;
  req.sesionId = carga.sid;
  next();
}

module.exports = autenticar;
