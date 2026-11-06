const servicio = require('../services/deudas.service');
const v = require('../utils/validaciones');

const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAXIMO = 100;

function leerFiltros(consulta) {
  return {
    tipo: v.opcionOpcional(consulta.tipo, 'tipo', v.TIPOS),
    estado: v.opcionOpcional(consulta.estado, 'estado', v.ESTADOS),
    personaId: typeof consulta.personaId === 'string' ? consulta.personaId : null,
  };
}

// La paginación es opcional: sin "page" ni "limit" se devuelven todas las deudas.
function leerPaginacion(consulta) {
  const pagina = v.enteroConsulta(consulta.page, 'page', 1, 1_000_000);
  const limite = v.enteroConsulta(consulta.limit, 'limit', 1, LIMITE_MAXIMO);
  if (pagina === null && limite === null) return {};
  return { pagina: pagina ?? 1, limite: limite ?? LIMITE_POR_DEFECTO };
}

async function listar(req, res) {
  const paginacion = leerPaginacion(req.query);
  const { deudas, total } = await servicio.listar(req.usuarioId, {
    ...leerFiltros(req.query),
    ...paginacion,
  });
  if (total !== null) {
    // El cuerpo sigue siendo la lista; el total viaja en un encabezado.
    res.set({
      'X-Total-Count': String(total),
      'X-Page': String(paginacion.pagina),
      'X-Limit': String(paginacion.limite),
    });
  }
  res.json(deudas);
}

async function obtener(req, res) {
  res.json(await servicio.obtener(req.usuarioId, req.params.id));
}

async function crear(req, res) {
  const datos = v.cuerpo(req);
  const deuda = await servicio.crear(req.usuarioId, {
    personaId: v.textoObligatorio(datos.personaId, 'personaId', 20),
    tipo: v.opcion(datos.tipo, 'tipo', v.TIPOS),
    concepto: v.textoObligatorio(datos.concepto, 'concepto', 100),
    montoTotalCentavos: v.montoCentavos(datos.montoTotalCentavos, 'montoTotalCentavos'),
    vencimiento: v.fechaOpcional(datos.vencimiento, 'vencimiento'),
  });
  res.status(201).json(deuda);
}

// "tipo" y "personaId" son opcionales al editar: si no vienen, se conservan.
async function editar(req, res) {
  const datos = v.cuerpo(req);
  const deuda = await servicio.editar(req.usuarioId, req.params.id, {
    tipo: v.opcionOpcional(datos.tipo, 'tipo', v.TIPOS),
    personaId:
      datos.personaId === undefined ? null : v.textoObligatorio(datos.personaId, 'personaId', 20),
    concepto: v.textoObligatorio(datos.concepto, 'concepto', 100),
    montoTotalCentavos: v.montoCentavos(datos.montoTotalCentavos, 'montoTotalCentavos'),
    vencimiento: v.fechaOpcional(datos.vencimiento, 'vencimiento'),
  });
  res.json(deuda);
}

async function eliminar(req, res) {
  await servicio.eliminar(req.usuarioId, req.params.id);
  res.status(204).send();
}

async function resumen(req, res) {
  res.json(await servicio.resumen(req.usuarioId));
}

module.exports = { listar, obtener, crear, editar, eliminar, resumen };
