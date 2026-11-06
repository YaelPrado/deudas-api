// Error propio de la API: lleva el código HTTP y un código estable que la app puede interpretar.
class ErrorApi extends Error {
  constructor(estado, codigo, mensaje) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
  }
}

module.exports = {
  ErrorApi,
  // 400
  datosInvalidos: (mensaje) => new ErrorApi(400, 'DATOS_INVALIDOS', mensaje),
  // 401
  noAutenticado: () => new ErrorApi(401, 'NO_AUTENTICADO', 'Debes iniciar sesión.'),
  tokenInvalido: () => new ErrorApi(401, 'TOKEN_INVALIDO', 'La sesión no es válida.'),
  tokenExpirado: () => new ErrorApi(401, 'TOKEN_EXPIRADO', 'La sesión expiró. Renueva el token o inicia sesión de nuevo.'),
  sesionCerrada: () => new ErrorApi(401, 'SESION_CERRADA', 'La sesión fue cerrada. Inicia sesión de nuevo.'),
  refrescoInvalido: () =>
    new ErrorApi(401, 'REFRESCO_INVALIDO', 'El token de renovación no es válido. Inicia sesión de nuevo.'),
  credencialesInvalidas: () =>
    new ErrorApi(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.'),
  // 403
  sinPermiso: () => new ErrorApi(403, 'SIN_PERMISO', 'No tienes permiso para esta acción.'),
  // 404
  personaNoEncontrada: () => new ErrorApi(404, 'PERSONA_NO_ENCONTRADA', 'La persona no existe.'),
  deudaNoEncontrada: () => new ErrorApi(404, 'DEUDA_NO_ENCONTRADA', 'La deuda no existe.'),
  abonoNoEncontrado: () => new ErrorApi(404, 'ABONO_NO_ENCONTRADO', 'El abono no existe.'),
  usuarioNoEncontrado: () => new ErrorApi(404, 'USUARIO_NO_ENCONTRADO', 'El usuario no existe.'),
  // 409
  correoEnUso: () => new ErrorApi(409, 'CORREO_EN_USO', 'Ya existe una cuenta con ese correo.'),
  abonoExcedeSaldo: () => new ErrorApi(409, 'ABONO_EXCEDE_SALDO', 'El abono supera el saldo pendiente.'),
  deudaYaPagada: () => new ErrorApi(409, 'DEUDA_YA_PAGADA', 'La deuda ya está pagada.'),
  montoMenorAAbonos: () =>
    new ErrorApi(409, 'MONTO_MENOR_A_ABONOS', 'El monto total no puede ser menor que lo ya abonado.'),
  accionNoPermitida: (mensaje) => new ErrorApi(409, 'ACCION_NO_PERMITIDA', mensaje),
};
