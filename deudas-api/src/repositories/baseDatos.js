const mysql = require('mysql2/promise');
const config = require('../config');

// Un solo grupo de conexiones para toda la API.
const pool = mysql.createPool({
  host: config.bd.host,
  port: config.bd.puerto,
  user: config.bd.usuario,
  password: config.bd.contrasena,
  database: config.bd.nombre,
  waitForConnections: true,
  connectionLimit: config.bd.limiteConexiones,
  charset: 'utf8mb4',
  timezone: 'Z', // las fechas se guardan en UTC
  dateStrings: true, // DATE y DATETIME llegan como texto, no como objetos Date
});

/**
 * Ejecuta varias consultas como una sola unidad: o se guardan todas o ninguna.
 * El trabajo recibe la conexión de la transacción y debe pasarla a los repositorios.
 */
async function transaccion(trabajo) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await trabajo(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

module.exports = { pool, transaccion };
