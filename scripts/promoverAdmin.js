// Da el rol ADMIN a un usuario que ya se registró.
// Uso: npm run admin -- correo@ejemplo.com        (para quitarlo: npm run admin -- correo@ejemplo.com USUARIO)
require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const correo = (process.argv[2] || '').trim().toLowerCase();
  const rol = (process.argv[3] || 'ADMIN').toUpperCase();
  if (!correo || !['ADMIN', 'USUARIO'].includes(rol)) {
    throw new Error('Uso: npm run admin -- correo@ejemplo.com [ADMIN|USUARIO]');
  }

  const conexion = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'deudas_db',
  });

  try {
    const [resultado] = await conexion.execute('UPDATE usuarios SET rol = ? WHERE correo = ?', [rol, correo]);
    if (resultado.affectedRows === 0) throw new Error(`No existe un usuario con el correo ${correo}.`);
    console.log(`Listo: ${correo} ahora tiene el rol ${rol}.`);
  } finally {
    await conexion.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
