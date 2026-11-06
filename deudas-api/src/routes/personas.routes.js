const { Router } = require('express');
const controlador = require('../controllers/personas.controller');

const router = Router();

router.get('/', controlador.listar);
router.post('/', controlador.crear);
router.put('/:id', controlador.editar);
router.delete('/:id', controlador.eliminar);

module.exports = router;
