const servicio = require('../services/deudas.service');
const v = require('../utils/validaciones');

async function registrar(req, res) {
  const datos = v.cuerpo(req);
  const deuda = await servicio.registrarAbono(req.usuarioId, req.params.id, {
    montoCentavos: v.montoCentavos(datos.montoCentavos, 'montoCentavos'),
    nota: v.textoOpcional(datos.nota, 'nota', 100),
  });
  res.status(201).json(deuda);
}

async function liquidar(req, res) {
  res.json(await servicio.liquidar(req.usuarioId, req.params.id));
}

// Responde con la deuda ya recalculada (saldo, estado y abonos restantes).
async function eliminar(req, res) {
  res.json(await servicio.eliminarAbono(req.usuarioId, req.params.id, req.params.abonoId));
}

module.exports = { registrar, liquidar, eliminar };
