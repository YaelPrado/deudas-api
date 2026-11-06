const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { transaccion } = require('../repositories/baseDatos');
const usuariosRepo = require('../repositories/usuarios.repository');
const sesionesRepo = require('../repositories/sesiones.repository');
const { nuevoId } = require('../utils/ids');
const { ahoraParaBd, fechaParaBd, aMilisegundos } = require('../utils/fechas');
const {
  correoEnUso,
  credencialesInvalidas,
  noAutenticado,
  sesionCerrada,
  tokenInvalido,
  refrescoInvalido,
} = require('../utils/errores');

const COSTO_BCRYPT = 10;
// Se compara contra este hash cuando el correo no existe, para que la respuesta tarde lo mismo.
const HASH_FALSO = bcrypt.hashSync('contrasena-que-nadie-usa', COSTO_BCRYPT);

// Si un refresh token ya rotado llega dentro de este margen, se rechaza sin cerrar la sesión:
// suele ser un reintento de la app (red lenta), no un robo. Pasado el margen, se asume robo.
const GRACIA_REFRESCO_MS = 10_000;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

const aUsuarioPublico = (usuario) => ({
  id: usuario.id,
  nombre: usuario.nombre,
  correo: usuario.correo,
  rol: usuario.rol,
});

// Del refresh token solo se guarda su hash: si roban la base, no sirven para renovar sesiones.
const sha256 = (texto) => crypto.createHash('sha256').update(texto).digest('hex');

function nuevoRefresco() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: sha256(token) };
}

const vencimientoRefresco = () =>
  fechaParaBd(new Date(Date.now() + config.jwt.refrescoDias * UN_DIA_MS));

function firmarAcceso(usuarioId, sesionId) {
  return jwt.sign({ sid: sesionId }, config.jwt.secreto, {
    algorithm: 'HS256',
    subject: usuarioId,
    expiresIn: config.jwt.expira,
  });
}

const respuestaSesion = (usuario, sesionId, refreshToken) => ({
  token: firmarAcceso(usuario.id, sesionId),
  refreshToken,
  usuario: aUsuarioPublico(usuario),
});

async function abrirSesion(usuario) {
  const id = nuevoId('s');
  const refresco = nuevoRefresco();
  await sesionesRepo.crear({
    id,
    usuarioId: usuario.id,
    refreshHash: refresco.hash,
    ahora: ahoraParaBd(),
    expiraEn: vencimientoRefresco(),
  });
  return respuestaSesion(usuario, id, refresco.token);
}

async function registrar({ nombre, correo, contrasena }) {
  if (await usuariosRepo.buscarPorCorreo(correo)) throw correoEnUso();

  const usuario = {
    id: nuevoId('u'),
    nombre,
    correo,
    contrasenaHash: await bcrypt.hash(contrasena, COSTO_BCRYPT),
    rol: 'USUARIO',
    creadoEn: ahoraParaBd(),
  };
  try {
    await usuariosRepo.crear(usuario);
  } catch (error) {
    // Dos registros simultáneos con el mismo correo: lo detecta la restricción UNIQUE.
    if (error.code === 'ER_DUP_ENTRY') throw correoEnUso();
    throw error;
  }
  return abrirSesion(usuario);
}

async function iniciarSesion({ correo, contrasena }) {
  const usuario = await usuariosRepo.buscarPorCorreo(correo);
  const coincide = await bcrypt.compare(contrasena, usuario ? usuario.contrasenaHash : HASH_FALSO);
  if (!usuario || !coincide) throw credencialesInvalidas();
  return abrirSesion(usuario);
}

// Cambia un refresh token por un par nuevo (rotación). Cada refresh token sirve una sola vez.
async function refrescar(refreshToken) {
  const hash = sha256(refreshToken);
  const resultado = await transaccion(async (cx) => {
    const ahora = ahoraParaBd();
    const sesion = await sesionesRepo.buscarPorRefresh(hash, cx);
    if (sesion) {
      if (sesion.revocadaEn || sesion.expiraEn <= ahora) return { fallo: true };
      const nuevo = nuevoRefresco();
      await sesionesRepo.rotar(
        sesion.id,
        { refreshHash: nuevo.hash, anteriorHash: hash, ahora, expiraEn: vencimientoRefresco() },
        cx
      );
      const usuario = await usuariosRepo.buscarPorId(sesion.usuarioId, cx);
      return { sesionId: sesion.id, usuario, token: nuevo.token };
    }

    // Un refresh token ya usado: o es un reintento de la app o alguien lo copió.
    const vieja = await sesionesRepo.buscarPorRefreshAnterior(hash, cx);
    if (vieja && !vieja.revocadaEn && Date.now() - aMilisegundos(vieja.rotadaEn) > GRACIA_REFRESCO_MS) {
      await sesionesRepo.revocar(vieja.id, ahora, cx); // se confirma porque no lanzamos error aquí
    }
    return { fallo: true };
  });

  if (resultado.fallo || !resultado.usuario) throw refrescoInvalido();
  return respuestaSesion(resultado.usuario, resultado.sesionId, resultado.token);
}

// Cierra la sesión a la que pertenece el refresh token. Siempre responde igual: no revela nada.
async function cerrarSesion(refreshToken) {
  await sesionesRepo.revocarPorRefresh(sha256(refreshToken), ahoraParaBd());
}

async function cerrarTodasLasSesiones(usuarioId) {
  await sesionesRepo.revocarTodasDelUsuario(usuarioId, ahoraParaBd());
}

// Lo usa el middleware de autenticación: el token de acceso solo vale mientras su sesión siga viva.
async function verificarSesion(sesionId, usuarioId) {
  const sesion = await sesionesRepo.buscarVigente(sesionId, ahoraParaBd());
  if (!sesion) throw sesionCerrada();
  if (sesion.usuarioId !== usuarioId) throw tokenInvalido();
  return sesion;
}

async function limpiarSesiones() {
  const ahora = Date.now();
  return sesionesRepo.limpiar(fechaParaBd(new Date(ahora)), fechaParaBd(new Date(ahora - UN_DIA_MS)));
}

async function obtenerPerfil(usuarioId) {
  const usuario = await usuariosRepo.buscarPorId(usuarioId);
  if (!usuario) throw noAutenticado();
  return aUsuarioPublico(usuario);
}

module.exports = {
  registrar,
  iniciarSesion,
  refrescar,
  cerrarSesion,
  cerrarTodasLasSesiones,
  verificarSesion,
  limpiarSesiones,
  obtenerPerfil,
};
