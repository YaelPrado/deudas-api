const { sinPermiso } = require('../utils/errores');

// Úsalo después de "autenticar": solo deja pasar a los usuarios con alguno de los roles indicados.
module.exports = function exigirRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.rol)) throw sinPermiso();
    next();
  };
};
