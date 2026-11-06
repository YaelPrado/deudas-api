const { Router } = require('express');
const controlador = require('../controllers/deudas.controller');

const router = Router();

router.get('/', controlador.resumen);

module.exports = router;
