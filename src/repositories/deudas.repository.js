const { pool } = require('./baseDatos');
const { aIso } = require('../utils/fechas');

// Cada deuda se entrega con el total abonado; el saldo y el estado los calcula el servicio.
const TOTAL_ABONADO = 'COALESCE(SUM(a.monto_centavos), 0)';
const SELECT_DEUDAS = `
  SELECT d.id, d.persona_id, p.nombre AS persona_nombre, d.tipo, d.concepto,
         d.monto_total_centavos, d.vencimiento, d.creada_en,
         ${TOTAL_ABONADO} AS total_abonado
  FROM deudas d
  JOIN personas p ON p.id = d.persona_id
  LEFT JOIN abonos a ON a.deuda_id = d.id`;
const AGRUPAR = ' GROUP BY d.id, p.nombre';

// El estado no se guarda: se obtiene comparando lo abonado con el monto total.
const FILTRO_ESTADO = {
  PENDIENTE: `${TOTAL_ABONADO} = 0`,
  PARCIAL: `${TOTAL_ABONADO} > 0 AND ${TOTAL_ABONADO} < d.monto_total_centavos`,
  PAGADA: `${TOTAL_ABONADO} >= d.monto_total_centavos`,
};

const aDeuda = (fila) => ({
  id: fila.id,
  personaId: fila.persona_id,
  personaNombre: fila.persona_nombre,
  tipo: fila.tipo,
  concepto: fila.concepto,
  montoTotalCentavos: fila.monto_total_centavos,
  totalAbonadoCentavos: Number(fila.total_abonado),
  vencimiento: fila.vencimiento,
  creadaEn: aIso(fila.creada_en),
});

// Arma la consulta base con los filtros opcionales (siempre con parámetros).
function consultaFiltrada(usuarioId, { tipo, personaId, estado }) {
  const condiciones = ['d.usuario_id = ?'];
  const parametros = [usuarioId];
  if (tipo) {
    condiciones.push('d.tipo = ?');
    parametros.push(tipo);
  }
  if (personaId) {
    condiciones.push('d.persona_id = ?');
    parametros.push(personaId);
  }
  const having = estado ? ` HAVING ${FILTRO_ESTADO[estado]}` : '';
  return {
    sql: `${SELECT_DEUDAS} WHERE ${condiciones.join(' AND ')}${AGRUPAR}${having}`,
    parametros,
  };
}

// Con "pagina" y "limite" devuelve solo esa página; sin ellos, todas las deudas.
async function listar(usuarioId, filtros = {}, ejecutor = pool) {
  const { sql, parametros } = consultaFiltrada(usuarioId, filtros);
  let paginacion = '';
  if (filtros.pagina && filtros.limite) {
    const { pagina, limite } = filtros;
    if (!Number.isInteger(pagina) || !Number.isInteger(limite) || pagina < 1 || limite < 1) {
      throw new Error('Paginación inválida');
    }
    // Enteros ya validados: se escriben en la consulta porque MySQL 8 no acepta LIMIT ? preparado.
    paginacion = ` LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`;
  }
  const [filas] = await ejecutor.execute(`${sql} ORDER BY d.creada_en DESC, d.id${paginacion}`, parametros);
  return filas.map(aDeuda);
}

// Cuántas deudas cumplen los filtros (sin paginar).
async function contar(usuarioId, filtros = {}, ejecutor = pool) {
  const { sql, parametros } = consultaFiltrada(usuarioId, filtros);
  const [filas] = await ejecutor.execute(`SELECT COUNT(*) AS total FROM (${sql}) AS filtradas`, parametros);
  return Number(filas[0].total);
}

async function buscarPorId(usuarioId, id, ejecutor = pool) {
  const [filas] = await ejecutor.execute(
    `${SELECT_DEUDAS} WHERE d.usuario_id = ? AND d.id = ?${AGRUPAR}`,
    [usuarioId, id]
  );
  return filas.length ? aDeuda(filas[0]) : null;
}

// Bloquea la fila de la deuda hasta que termine la transacción (evita abonos simultáneos).
async function bloquear(usuarioId, id, ejecutor) {
  const [filas] = await ejecutor.execute(
    'SELECT id, persona_id, tipo, monto_total_centavos FROM deudas WHERE id = ? AND usuario_id = ? FOR UPDATE',
    [id, usuarioId]
  );
  return filas.length
    ? {
        id: filas[0].id,
        personaId: filas[0].persona_id,
        tipo: filas[0].tipo,
        montoTotalCentavos: filas[0].monto_total_centavos,
      }
    : null;
}

async function crear(usuarioId, deuda, ejecutor = pool) {
  await ejecutor.execute(
    `INSERT INTO deudas
       (id, usuario_id, persona_id, tipo, concepto, monto_total_centavos, vencimiento, creada_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      deuda.id,
      usuarioId,
      deuda.personaId,
      deuda.tipo,
      deuda.concepto,
      deuda.montoTotalCentavos,
      deuda.vencimiento ?? null,
      deuda.creadaEn,
    ]
  );
}

async function actualizar(
  id,
  { personaId, tipo, concepto, montoTotalCentavos, vencimiento },
  ejecutor = pool
) {
  await ejecutor.execute(
    `UPDATE deudas
        SET persona_id = ?, tipo = ?, concepto = ?, monto_total_centavos = ?, vencimiento = ?
      WHERE id = ?`,
    [personaId, tipo, concepto, montoTotalCentavos, vencimiento ?? null, id]
  );
}

// Los abonos se borran solos por la clave foránea (ON DELETE CASCADE).
async function eliminar(usuarioId, id, ejecutor = pool) {
  const [resultado] = await ejecutor.execute(
    'DELETE FROM deudas WHERE id = ? AND usuario_id = ?',
    [id, usuarioId]
  );
  return resultado.affectedRows > 0;
}

module.exports = { listar, contar, buscarPorId, bloquear, crear, actualizar, eliminar };
