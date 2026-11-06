const { pool } = require('./baseDatos');
const { aIso } = require('../utils/fechas');

const aAbono = (fila) => ({
  id: fila.id,
  montoCentavos: fila.monto_centavos,
  nota: fila.nota,
  fecha: aIso(fila.fecha),
});

async function listarPorDeuda(deudaId, ejecutor = pool) {
  const [filas] = await ejecutor.execute(
    'SELECT id, monto_centavos, nota, fecha FROM abonos WHERE deuda_id = ? ORDER BY fecha, id',
    [deudaId]
  );
  return filas.map(aAbono);
}

async function totalPorDeuda(deudaId, ejecutor = pool) {
  const [filas] = await ejecutor.execute(
    'SELECT COALESCE(SUM(monto_centavos), 0) AS total FROM abonos WHERE deuda_id = ?',
    [deudaId]
  );
  return Number(filas[0].total);
}

async function agregar({ id, deudaId, montoCentavos, nota, fecha }, ejecutor = pool) {
  await ejecutor.execute(
    'INSERT INTO abonos (id, deuda_id, monto_centavos, nota, fecha) VALUES (?, ?, ?, ?, ?)',
    [id, deudaId, montoCentavos, nota ?? null, fecha]
  );
}

async function eliminar(deudaId, abonoId, ejecutor = pool) {
  const [resultado] = await ejecutor.execute('DELETE FROM abonos WHERE id = ? AND deuda_id = ?', [
    abonoId,
    deudaId,
  ]);
  return resultado.affectedRows > 0;
}

module.exports = { listarPorDeuda, totalPorDeuda, agregar, eliminar };
