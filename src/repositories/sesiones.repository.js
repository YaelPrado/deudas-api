const { pool } = require('./baseDatos');

const aSesion = (fila) => ({
  id: fila.id,
  usuarioId: fila.usuario_id,
  rotadaEn: fila.rotada_en,
  expiraEn: fila.expira_en,
  revocadaEn: fila.revocada_en,
});

const COLUMNAS = 'id, usuario_id, rotada_en, expira_en, revocada_en';

async function crear({ id, usuarioId, refreshHash, ahora, expiraEn }, ejecutor = pool) {
  await ejecutor.execute(
    `INSERT INTO sesiones (id, usuario_id, refresh_hash, creada_en, rotada_en, expira_en)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, usuarioId, refreshHash, ahora, ahora, expiraEn]
  );
}

// Sesión vigente (no revocada ni vencida) junto con el rol actual de su usuario.
// Se consulta en cada petición autenticada, por eso revocar una sesión surte efecto al instante.
async function buscarVigente(id, ahora, ejecutor = pool) {
  const [filas] = await ejecutor.execute(
    `SELECT s.usuario_id, u.rol
       FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.id = ? AND s.revocada_en IS NULL AND s.expira_en > ?`,
    [id, ahora]
  );
  return filas.length ? { usuarioId: filas[0].usuario_id, rol: filas[0].rol } : null;
}

// Las dos búsquedas por refresh token bloquean la fila hasta que termine la transacción,
// para que dos renovaciones simultáneas no usen el mismo token a la vez.
async function buscarPorRefresh(refreshHash, ejecutor) {
  const [filas] = await ejecutor.execute(
    `SELECT ${COLUMNAS} FROM sesiones WHERE refresh_hash = ? FOR UPDATE`,
    [refreshHash]
  );
  return filas.length ? aSesion(filas[0]) : null;
}

async function buscarPorRefreshAnterior(refreshHash, ejecutor) {
  const [filas] = await ejecutor.execute(
    `SELECT ${COLUMNAS} FROM sesiones WHERE refresh_anterior_hash = ? FOR UPDATE`,
    [refreshHash]
  );
  return filas.length ? aSesion(filas[0]) : null;
}

async function rotar(id, { refreshHash, anteriorHash, ahora, expiraEn }, ejecutor = pool) {
  await ejecutor.execute(
    `UPDATE sesiones
        SET refresh_hash = ?, refresh_anterior_hash = ?, rotada_en = ?, expira_en = ?
      WHERE id = ?`,
    [refreshHash, anteriorHash, ahora, expiraEn, id]
  );
}

async function revocar(id, ahora, ejecutor = pool) {
  await ejecutor.execute('UPDATE sesiones SET revocada_en = ? WHERE id = ? AND revocada_en IS NULL', [
    ahora,
    id,
  ]);
}

// Cierre de sesión con el refresh token (vigente o ya rotado). Es idempotente.
async function revocarPorRefresh(refreshHash, ahora, ejecutor = pool) {
  await ejecutor.execute(
    `UPDATE sesiones SET revocada_en = ?
      WHERE (refresh_hash = ? OR refresh_anterior_hash = ?) AND revocada_en IS NULL`,
    [ahora, refreshHash, refreshHash]
  );
}

async function revocarTodasDelUsuario(usuarioId, ahora, ejecutor = pool) {
  await ejecutor.execute(
    'UPDATE sesiones SET revocada_en = ? WHERE usuario_id = ? AND revocada_en IS NULL',
    [ahora, usuarioId]
  );
}

// Borra las sesiones vencidas y las revocadas hace tiempo.
async function limpiar(ahora, limiteRevocadas, ejecutor = pool) {
  const [resultado] = await ejecutor.execute(
    'DELETE FROM sesiones WHERE expira_en < ? OR revocada_en < ?',
    [ahora, limiteRevocadas]
  );
  return resultado.affectedRows;
}

module.exports = {
  crear,
  buscarVigente,
  buscarPorRefresh,
  buscarPorRefreshAnterior,
  rotar,
  revocar,
  revocarPorRefresh,
  revocarTodasDelUsuario,
  limpiar,
};
