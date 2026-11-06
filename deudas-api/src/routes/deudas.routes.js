const { Router } = require('express');
const controlador = require('../controllers/deudas.controller');

const router = Router();

router.get('/', controlador.listar);
router.post('/', controlador.crear);
router.get('/:id', controlador.obtener);
router.put('/:id', controlador.editar);
router.delete('/:id', controlador.eliminar);

module.exports = router;
