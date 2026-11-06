const { pool } = require('./baseDatos');
const { aIso } = require('../utils/fechas');

const COLUMNAS = 'id, nombre, correo, contrasena_hash, rol, creado_en';

const aUsuario = (fila) => ({
  id: fila.id,
  nombre: fila.nombre,
  correo: fila.correo,
  contrasenaHash: fila.contrasena_hash,
  rol: fila.rol,
  creadoEn: aIso(fila.creado_en),
});

async function buscarPorCorreo(correo, ejecutor = pool) {
  const [filas] = await ejecutor.execute(`SELECT ${COLUMNAS} FROM usuarios WHERE correo = ?`, [correo]);
  return filas.length ? aUsuario(filas[0]) : null;
}

async function buscarPorId(id, ejecutor = pool) {
  const [filas] = await ejecutor.execute(`SELECT ${COLUMNAS} FROM usuarios WHERE id = ?`, [id]);
  return filas.length ? aUsuario(filas[0]) : null;
}

async function listar(ejecutor = pool) {
  const [filas] = await ejecutor.execute(`SELECT ${COLUMNAS} FROM usuarios ORDER BY creado_en, id`);
  return filas.map(aUsuario);
}

async function crear({ id, nombre, correo, contrasenaHash, rol = 'USUARIO', creadoEn }, ejecutor = pool) {
  await ejecutor.execute(
    'INSERT INTO usuarios (id, nombre, correo, contrasena_hash, rol, creado_en) VALUES (?, ?, ?, ?, ?, ?)',
    [id, nombre, correo, contrasenaHash, rol, creadoEn]
  );
}

async function actualizarRol(id, rol, ejecutor = pool) {
  const [resultado] = await ejecutor.execute('UPDATE usuarios SET rol = ? WHERE id = ?', [rol, id]);
  return resultado.affectedRows > 0;
}

// Sus personas, deudas, abonos y sesiones se borran solos por las claves foráneas.
async function eliminar(id, ejecutor = pool) {
  const [resultado] = await ejecutor.execute('DELETE FROM usuarios WHERE id = ?', [id]);
  return resultado.affectedRows > 0;
}

module.exports = { buscarPorCorreo, buscarPorId, listar, crear, actualizarRol, eliminar };
