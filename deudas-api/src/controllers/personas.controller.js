const servicio = require('../services/personas.service');
const v = require('../utils/validaciones');

async function listar(req, res) {
  res.json(await servicio.listar(req.usuarioId));
}

async function crear(req, res) {
  const datos = v.cuerpo(req);
  const persona = await servicio.crear(req.usuarioId, {
    nombre: v.textoObligatorio(datos.nombre, 'nombre', 50),
    telefono: v.textoOpcional(datos.telefono, 'telefono', 20),
  });
  res.status(201).json(persona);
}

async function editar(req, res) {
  const datos = v.cuerpo(req);
  const persona = await servicio.editar(req.usuarioId, req.params.id, {
    nombre: v.textoObligatorio(datos.nombre, 'nombre', 50),
    telefono: v.textoOpcional(datos.telefono, 'telefono', 20),
  });
  res.json(persona);
}

async function eliminar(req, res) {
  await servicio.eliminar(req.usuarioId, req.params.id);
  res.status(204).send();
}

module.exports = { listar, crear, editar, eliminar };
