const { Router } = require('express');
const controlador = require('../controllers/auth.controller');
const limitarIntentos = require('../middlewares/limitarIntentos');

// Alias en inglés con las rutas del contrato mínimo del proyecto: /register y /login.
// Hacen exactamente lo mismo que /auth/registro y /auth/login.
const router = Router();

router.post('/register', limitarIntentos, controlador.registro);
router.post('/login', limitarIntentos, controlador.login);

module.exports = router;
