const servicio = require('../services/admin.service');
const v = require('../utils/validaciones');

async function listarUsuarios(req, res) {
  res.json(await servicio.listarUsuarios());
}

async function cambiarRol(req, res) {
  const datos = v.cuerpo(req);
  res.json(await servicio.cambiarRol(req.usuarioId, req.params.id, v.opcion(datos.rol, 'rol', v.ROLES)));
}

async function eliminarUsuario(req, res) {
  await servicio.eliminarUsuario(req.usuarioId, req.params.id);
  res.status(204).send();
}

module.exports = { listarUsuarios, cambiarRol, eliminarUsuario };
