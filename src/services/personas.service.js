const personasRepo = require('../repositories/personas.repository');
const { nuevoId } = require('../utils/ids');
const { personaNoEncontrada } = require('../utils/errores');

const listar = (usuarioId) => personasRepo.listar(usuarioId);

async function crear(usuarioId, { nombre, telefono }) {
  const persona = { id: nuevoId('p'), nombre, telefono };
  await personasRepo.crear(usuarioId, persona);
  return persona;
}

// Reemplaza nombre y teléfono (si no viene teléfono, se borra).
async function editar(usuarioId, id, { nombre, telefono }) {
  if (!(await personasRepo.actualizar(usuarioId, id, { nombre, telefono }))) throw personaNoEncontrada();
  return personasRepo.buscarPorId(usuarioId, id);
}

// Atención: también se eliminan sus deudas y los abonos de esas deudas.
async function eliminar(usuarioId, id) {
  if (!(await personasRepo.eliminar(usuarioId, id))) throw personaNoEncontrada();
}

module.exports = { listar, crear, editar, eliminar };
