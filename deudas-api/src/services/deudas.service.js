const { transaccion } = require('../repositories/baseDatos');
const deudasRepo = require('../repositories/deudas.repository');
const abonosRepo = require('../repositories/abonos.repository');
const personasRepo = require('../repositories/personas.repository');
const { nuevoId } = require('../utils/ids');
const { ahoraParaBd } = require('../utils/fechas');
const {
  personaNoEncontrada,
  deudaNoEncontrada,
  abonoNoEncontrado,
  abonoExcedeSaldo,
  deudaYaPagada,
  montoMenorAAbonos,
} = require('../utils/errores');

// El saldo y el estado no se guardan: se calculan cada vez a partir de los abonos.
function calcularEstado(montoTotal, abonado) {
  if (abonado >= montoTotal) return 'PAGADA';
  return abonado > 0 ? 'PARCIAL' : 'PENDIENTE';
}

function completar(deuda) {
  return {
    ...deuda,
    saldoCentavos: deuda.montoTotalCentavos - deuda.totalAbonadoCentavos,
    estado: calcularEstado(deuda.montoTotalCentavos, deuda.totalAbonadoCentavos),
  };
}

// Orden de los campos tal como lo define el contrato de la API.
function aRespuesta(deuda, abonos) {
  const c = completar(deuda);
  const respuesta = {
    id: c.id,
    personaId: c.personaId,
    personaNombre: c.personaNombre,
    tipo: c.tipo,
    concepto: c.concepto,
    montoTotalCentavos: c.montoTotalCentavos,
    totalAbonadoCentavos: c.totalAbonadoCentavos,
    saldoCentavos: c.saldoCentavos,
    estado: c.estado,
    vencimiento: c.vencimiento,
    creadaEn: c.creadaEn,
  };
  if (abonos) respuesta.abonos = abonos;
  return respuesta;
}

// Con "pagina" y "limite" devuelve solo esa página y el total; sin ellos, todas (total = null).
async function listar(usuarioId, { tipo, estado, personaId, pagina, limite }) {
  const filtros = { tipo, estado, personaId };
  if (!pagina) {
    const deudas = await deudasRepo.listar(usuarioId, filtros);
    return { deudas: deudas.map((d) => aRespuesta(d)), total: null };
  }
  const [deudas, total] = await Promise.all([
    deudasRepo.listar(usuarioId, { ...filtros, pagina, limite }),
    deudasRepo.contar(usuarioId, filtros),
  ]);
  return { deudas: deudas.map((d) => aRespuesta(d)), total };
}

async function obtener(usuarioId, id) {
  const deuda = await deudasRepo.buscarPorId(usuarioId, id);
  if (!deuda) throw deudaNoEncontrada();
  const abonos = await abonosRepo.listarPorDeuda(id);
  return aRespuesta(deuda, abonos);
}

async function crear(usuarioId, datos) {
  if (!(await personasRepo.buscarPorId(usuarioId, datos.personaId))) throw personaNoEncontrada();
  const id = nuevoId('d');
  await deudasRepo.crear(usuarioId, { id, ...datos, creadaEn: ahoraParaBd() });
  return obtener(usuarioId, id);
}

// "tipo" y "personaId" son opcionales: si no vienen, la deuda conserva los que tenía.
async function editar(usuarioId, id, { tipo, personaId, concepto, montoTotalCentavos, vencimiento }) {
  await transaccion(async (cx) => {
    const actual = await deudasRepo.bloquear(usuarioId, id, cx);
    if (!actual) throw deudaNoEncontrada();
    if (personaId && personaId !== actual.personaId) {
      if (!(await personasRepo.buscarPorId(usuarioId, personaId, cx))) throw personaNoEncontrada();
    }
    const abonado = await abonosRepo.totalPorDeuda(id, cx);
    if (montoTotalCentavos < abonado) throw montoMenorAAbonos();
    await deudasRepo.actualizar(
      id,
      {
        personaId: personaId || actual.personaId,
        tipo: tipo || actual.tipo,
        concepto,
        montoTotalCentavos,
        vencimiento,
      },
      cx
    );
  });
  return obtener(usuarioId, id);
}

async function eliminar(usuarioId, id) {
  if (!(await deudasRepo.eliminar(usuarioId, id))) throw deudaNoEncontrada();
}

async function registrarAbono(usuarioId, id, { montoCentavos, nota }) {
  await transaccion(async (cx) => {
    const deuda = await deudasRepo.bloquear(usuarioId, id, cx);
    if (!deuda) throw deudaNoEncontrada();
    const saldo = deuda.montoTotalCentavos - (await abonosRepo.totalPorDeuda(id, cx));
    if (saldo <= 0) throw deudaYaPagada();
    if (montoCentavos > saldo) throw abonoExcedeSaldo();
    await abonosRepo.agregar(
      { id: nuevoId('a'), deudaId: id, montoCentavos, nota, fecha: ahoraParaBd() },
      cx
    );
  });
  return obtener(usuarioId, id);
}

// Deshace un abono (por ejemplo, uno registrado por error). Devuelve la deuda ya recalculada.
async function eliminarAbono(usuarioId, id, abonoId) {
  await transaccion(async (cx) => {
    if (!(await deudasRepo.bloquear(usuarioId, id, cx))) throw deudaNoEncontrada();
    if (!(await abonosRepo.eliminar(id, abonoId, cx))) throw abonoNoEncontrado();
  });
  return obtener(usuarioId, id);
}

// Paga de golpe todo lo que falta.
async function liquidar(usuarioId, id) {
  await transaccion(async (cx) => {
    const deuda = await deudasRepo.bloquear(usuarioId, id, cx);
    if (!deuda) throw deudaNoEncontrada();
    const saldo = deuda.montoTotalCentavos - (await abonosRepo.totalPorDeuda(id, cx));
    if (saldo <= 0) throw deudaYaPagada();
    await abonosRepo.agregar(
      { id: nuevoId('a'), deudaId: id, montoCentavos: saldo, nota: 'Pago total', fecha: ahoraParaBd() },
      cx
    );
  });
  return obtener(usuarioId, id);
}

async function resumen(usuarioId) {
  const deudas = (await deudasRepo.listar(usuarioId)).map(completar);
  const suma = (tipo) =>
    deudas.filter((d) => d.tipo === tipo).reduce((total, d) => total + d.saldoCentavos, 0);
  const meDeben = suma('ME_DEBEN');
  const debo = suma('DEBO');
  return {
    meDebenCentavos: meDeben,
    deboCentavos: debo,
    balanceCentavos: meDeben - debo,
    deudasPendientes: deudas.filter((d) => d.saldoCentavos > 0).length,
  };
}

module.exports = {
  listar,
  obtener,
  crear,
  editar,
  eliminar,
  registrarAbono,
  eliminarAbono,
  liquidar,
  resumen,
};
