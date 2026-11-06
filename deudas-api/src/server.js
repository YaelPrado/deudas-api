const app = require('./app');
const config = require('./config');
const { pool } = require('./repositories/baseDatos');
const authService = require('./services/auth.service');

const servidor = app.listen(config.puerto, () => {
  console.log(`API de deudas escuchando en el puerto ${config.puerto}`);
});

// Cada hora se borran las sesiones vencidas o revocadas hace tiempo.
const limpieza = setInterval(() => {
  authService.limpiarSesiones().catch((error) => console.error('No se pudo limpiar sesiones:', error.message));
}, 60 * 60 * 1000);
limpieza.unref();

// Cierre ordenado cuando PM2 o el sistema detienen el proceso.
function cerrar() {
  clearInterval(limpieza);
  servidor.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
