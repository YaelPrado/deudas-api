const servicio = require('../services/auth.service');
const v = require('../utils/validaciones');

async function registro(req, res) {
  const datos = v.cuerpo(req);
  const sesion = await servicio.registrar({
    nombre: v.textoObligatorio(datos.nombre, 'nombre', 50),
    correo: v.correo(datos.correo),
    contrasena: v.contrasenaNueva(datos.contrasena),
  });
  res.status(201).json(sesion);
}

async function login(req, res) {
  const datos = v.cuerpo(req);
  const sesion = await servicio.iniciarSesion({
    correo: v.correo(datos.correo),
    contrasena: v.contrasenaPresente(datos.contrasena),
  });
  res.json(sesion);
}

async function refrescar(req, res) {
  const datos = v.cuerpo(req);
  res.json(await servicio.refrescar(v.textoObligatorio(datos.refreshToken, 'refreshToken', 200)));
}

async function logout(req, res) {
  const datos = v.cuerpo(req);
  await servicio.cerrarSesion(v.textoObligatorio(datos.refreshToken, 'refreshToken', 200));
  res.status(204).send();
}

async function cerrarTodas(req, res) {
  await servicio.cerrarTodasLasSesiones(req.usuarioId);
  res.status(204).send();
}

async function perfil(req, res) {
  res.json(await servicio.obtenerPerfil(req.usuarioId));
}

module.exports = { registro, login, refrescar, logout, cerrarTodas, perfil };
