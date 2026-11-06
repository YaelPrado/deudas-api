// Crea la base de datos (si no existe), las tablas y aplica las migraciones a las bases
// creadas con versiones anteriores. Es repetible. Uso: npm run db:init
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function columna(conexion, bd, tabla, nombre) {
  const [filas] = await conexion.query(
    `SELECT DATETIME_PRECISION AS decimales
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [bd, tabla, nombre]
  );
  return filas.length ? filas[0] : null;
}

// Cambios para bases creadas antes de agregar roles, sesiones y fechas con milisegundos.
async function migrar(conexion, bd) {
  if (!(await columna(conexion, bd, 'usuarios', 'rol'))) {
    await conexion.query(
      "ALTER TABLE usuarios ADD COLUMN rol ENUM('USUARIO', 'ADMIN') NOT NULL DEFAULT 'USUARIO' AFTER contrasena_hash"
    );
    console.log('Migración: columna usuarios.rol agregada.');
  }

  const fechas = [
    ['usuarios', 'creado_en', 'NOT NULL'],
    ['deudas', 'creada_en', 'NOT NULL'],
    ['abonos', 'fecha', 'NOT NULL'],
  ];
  for (const [tabla, nombre, extra] of fechas) {
    const info = await columna(conexion, bd, tabla, nombre);
    if (info && Number(info.decimales) === 0) {
      await conexion.query(`ALTER TABLE \`${tabla}\` MODIFY \`${nombre}\` DATETIME(3) ${extra}`);
      console.log(`Migración: ${tabla}.${nombre} ahora guarda milisegundos.`);
    }
  }
}

async function main() {
  const nombre = process.env.DB_NAME || 'deudas_db';
  if (!/^[A-Za-z0-9_]+$/.test(nombre)) {
    throw new Error('DB_NAME solo puede tener letras, números y guion bajo.');
  }

  const conexion = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    await conexion.query(
      `CREATE DATABASE IF NOT EXISTS \`${nombre}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conexion.query(`USE \`${nombre}\``);
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
    await conexion.query(sql);
    await migrar(conexion, nombre);
    console.log(`Base de datos "${nombre}" lista.`);
  } finally {
    await conexion.end();
  }
}

main().catch((error) => {
  console.error('No se pudo inicializar la base de datos:', error.message);
  process.exit(1);
});
