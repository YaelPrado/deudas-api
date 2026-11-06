const usuariosRepo = require('../repositories/usuarios.repository');
const { usuarioNoEncontrado, accionNoPermitida } = require('../utils/errores');

const aUsuarioAdmin = (u) => ({
  id: u.id,
  nombre: u.nombre,
  correo: u.correo,
  rol: u.rol,
  creadoEn: u.creadoEn,
});

async function listarUsuarios() {
  return (await usuariosRepo.listar()).map(aUsuarioAdmin);
}

// El rol se lee de la base en cada petición, así que el cambio surte efecto de inmediato.
async function cambiarRol(adminId, id, rol) {
  if (id === adminId) throw accionNoPermitida('No puedes cambiar tu propio rol.');
  if (!(await usuariosRepo.actualizarRol(id, rol))) throw usuarioNoEncontrado();
  return aUsuarioAdmin(await usuariosRepo.buscarPorId(id));
}

// Borra al usuario y, por cascada, sus personas, deudas, abonos y sesiones.
async function eliminarUsuario(adminId, id) {
  if (id === adminId) throw accionNoPermitida('No puedes eliminar tu propia cuenta.');
  if (!(await usuariosRepo.eliminar(id))) throw usuarioNoEncontrado();
}

module.exports = { listarUsuarios, cambiarRol, eliminarUsuario };
