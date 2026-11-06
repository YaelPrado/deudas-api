const { Router } = require('express');
const controlador = require('../controllers/auth.controller');
const autenticar = require('../middlewares/autenticar');
const limitarIntentos = require('../middlewares/limitarIntentos');

const router = Router();

router.post('/registro', limitarIntentos, controlador.registro);
router.post('/login', limitarIntentos, controlador.login);
router.post('/refrescar', limitarIntentos, controlador.refrescar);
router.post('/logout', controlador.logout);
router.post('/cerrar-todas', autenticar, controlador.cerrarTodas);
router.get('/perfil', autenticar, controlador.perfil);

module.exports = router;
