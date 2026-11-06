const { pool } = require('./baseDatos');

const aPersona = (fila) => ({ id: fila.id, nombre: fila.nombre, telefono: fila.telefono });

async function listar(usuarioId, ejecutor = pool) {
  const [filas] = await ejecutor.execute(
    'SELECT id, nombre, telefono FROM personas WHERE usuario_id = ? ORDER BY nombre, id',
    [usuarioId]
  );
  return filas.map(aPersona);
}

async function buscarPorId(usuarioId, id, ejecutor = pool) {
  const [filas] = await ejecutor.execute(
    'SELECT id, nombre, telefono FROM personas WHERE id = ? AND usuario_id = ?',
    [id, usuarioId]
  );
  return filas.length ? aPersona(filas[0]) : null;
}

async function crear(usuarioId, { id, nombre, telefono }, ejecutor = pool) {
  await ejecutor.execute(
    'INSERT INTO personas (id, usuario_id, nombre, telefono) VALUES (?, ?, ?, ?)',
    [id, usuarioId, nombre, telefono ?? null]
  );
}

async function actualizar(usuarioId, id, { nombre, telefono }, ejecutor = pool) {
  const [resultado] = await ejecutor.execute(
    'UPDATE personas SET nombre = ?, telefono = ? WHERE id = ? AND usuario_id = ?',
    [nombre, telefono ?? null, id, usuarioId]
  );
  return resultado.affectedRows > 0;
}

// Sus deudas (y los abonos de esas deudas) se borran solas por la clave foránea.
async function eliminar(usuarioId, id, ejecutor = pool) {
  const [resultado] = await ejecutor.execute('DELETE FROM personas WHERE id = ? AND usuario_id = ?', [
    id,
    usuarioId,
  ]);
  return resultado.affectedRows > 0;
}

module.exports = { listar, buscarPorId, crear, actualizar, eliminar };
