const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const { pool } = require('./repositories/baseDatos');
const autenticar = require('./middlewares/autenticar');
const registrarPeticiones = require('./middlewares/registrarPeticiones');
const rutaNoEncontrada = require('./middlewares/rutaNoEncontrada');
const manejarErrores = require('./middlewares/manejarErrores');
const authRoutes = require('./routes/auth.routes');
const aliasRoutes = require('./routes/alias.routes');
const personasRoutes = require('./routes/personas.routes');
const deudasRoutes = require('./routes/deudas.routes');
const abonosRoutes = require('./routes/abonos.routes');
const resumenRoutes = require('./routes/resumen.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
app.disable('x-powered-by');
// Detrás de Nginx o un balanceador, esto hace que req.ip sea la del cliente real (ver TRUST_PROXY).
app.set('trust proxy', config.trustProxy);

if (config.logPeticiones) app.use(registrarPeticiones);
app.use(helmet());
// CORS solo se activa si defines CORS_ORIGENES (una app web). La app Android no lo necesita.
if (config.corsOrigenes.length > 0) {
  app.use(
    cors({
      origin: config.corsOrigenes,
      exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Limit'],
    })
  );
}
app.use(express.json({ limit: '10kb' }));

// Comprobación de que la API y la base de datos responden (sin login).
app.get('/api/salud', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ estado: 'ok', baseDatos: 'ok' });
  } catch (error) {
    console.error('Falla la conexión con la base de datos:', error.message);
    res.status(503).json({ estado: 'error', baseDatos: 'sin conexión' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api', aliasRoutes);

// Todo lo demás requiere iniciar sesión.
app.use('/api/personas', autenticar, personasRoutes);
app.use('/api/deudas', autenticar, deudasRoutes, abonosRoutes);
app.use('/api/resumen', autenticar, resumenRoutes);
app.use('/api/admin', autenticar, adminRoutes);

app.use(rutaNoEncontrada);
app.use(manejarErrores);

module.exports = app;
