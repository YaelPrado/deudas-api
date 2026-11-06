const { Router } = require('express');
const controlador = require('../controllers/abonos.controller');

// Se monta en /api/deudas junto con las rutas de deudas (la autenticación se aplica una sola vez).
const router = Router();

router.post('/:id/abonos', controlador.registrar);
router.delete('/:id/abonos/:abonoId', controlador.eliminar);
router.post('/:id/liquidar', controlador.liquidar);

module.exports = router;
