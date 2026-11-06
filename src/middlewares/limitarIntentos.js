const rateLimit = require('express-rate-limit');
const config = require('../config');

// Frena los intentos fallidos repetidos de login y registro desde una misma IP.
// Los intentos correctos no cuentan, así que un usuario normal nunca se bloquea.
module.exports = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.limiteAuth,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        codigo: 'DEMASIADOS_INTENTOS',
        mensaje: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
      },
    });
  },
});
