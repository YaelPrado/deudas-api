const { Router } = require('express');
const controlador = require('../controllers/admin.controller');
const exigirRol = require('../middlewares/exigirRol');

// Se monta después de "autenticar". Solo para usuarios con rol ADMIN.
const router = Router();
router.use(exigirRol('ADMIN'));

router.get('/usuarios', controlador.listarUsuarios);
router.patch('/usuarios/:id/rol', controlador.cambiarRol);
router.delete('/usuarios/:id', controlador.eliminarUsuario);

module.exports = router;
