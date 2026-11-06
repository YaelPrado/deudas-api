const { datosInvalidos } = require('./errores');

const TIPOS = ['ME_DEBEN', 'DEBO'];
const ESTADOS = ['PENDIENTE', 'PARCIAL', 'PAGADA'];
const ROLES = ['USUARIO', 'ADMIN'];
const MONTO_MAXIMO_CENTAVOS = 1_000_000_000; // 10 millones de pesos
const CONTRASENA_MINIMA = 8;
const CONTRASENA_MAXIMA_BYTES = 72; // límite de bcrypt

// Devuelve el cuerpo de la petición, o un objeto vacío si no vino ninguno.
function cuerpo(req) {
  const datos = req.body;
  return datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {};
}

function textoObligatorio(valor, campo, maximo) {
  if (typeof valor !== 'string' || valor.trim().length === 0) {
    throw datosInvalidos(`El campo ${campo} es obligatorio.`);
  }
  if (valor.trim().length > maximo) {
    throw datosInvalidos(`El campo ${campo} admite hasta ${maximo} caracteres.`);
  }
  return valor.trim();
}

function textoOpcional(valor, campo, maximo) {
  if (valor === undefined || valor === null || valor === '') return null;
  return textoObligatorio(valor, campo, maximo);
}

// Los montos viajan como enteros en centavos.
function montoCentavos(valor, campo) {
  if (!Number.isInteger(valor) || valor <= 0 || valor > MONTO_MAXIMO_CENTAVOS) {
    throw datosInvalidos(`El campo ${campo} debe ser un entero mayor que cero (en centavos).`);
  }
  return valor;
}

function opcion(valor, campo, permitidos) {
  if (!permitidos.includes(valor)) {
    throw datosInvalidos(`El campo ${campo} debe ser uno de: ${permitidos.join(', ')}.`);
  }
  return valor;
}

// Para filtros: si no viene, devuelve null.
function opcionOpcional(valor, campo, permitidos) {
  return valor === undefined ? null : opcion(valor, campo, permitidos);
}

// Entero de la URL (por ejemplo ?page=2). Si no viene, devuelve null.
function enteroConsulta(valor, campo, minimo, maximo) {
  if (valor === undefined) return null;
  const numero = typeof valor === 'string' && /^\d{1,9}$/.test(valor) ? Number(valor) : NaN;
  if (!Number.isInteger(numero) || numero < minimo || numero > maximo) {
    throw datosInvalidos(`El parámetro ${campo} debe ser un entero entre ${minimo} y ${maximo}.`);
  }
  return numero;
}

// Fecha opcional con formato AAAA-MM-DD.
function fechaOpcional(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return null;
  const fecha = typeof valor === 'string' ? new Date(`${valor}T00:00:00Z`) : null;
  const valida =
    fecha && !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
  if (!valida) throw datosInvalidos(`El campo ${campo} debe tener el formato AAAA-MM-DD.`);
  return valor;
}

function correo(valor) {
  const texto = textoObligatorio(valor, 'correo', 100).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto)) {
    throw datosInvalidos('El correo no tiene un formato válido.');
  }
  return texto;
}

// Contraseña nueva: mínimo 8 caracteres.
function contrasenaNueva(valor) {
  if (typeof valor !== 'string' || valor.length < CONTRASENA_MINIMA) {
    throw datosInvalidos(`La contraseña debe tener al menos ${CONTRASENA_MINIMA} caracteres.`);
  }
  if (Buffer.byteLength(valor, 'utf8') > CONTRASENA_MAXIMA_BYTES) {
    throw datosInvalidos('La contraseña es demasiado larga (máximo 72 bytes).');
  }
  return valor;
}

// Contraseña al iniciar sesión: solo se exige que venga.
function contrasenaPresente(valor) {
  if (typeof valor !== 'string' || valor.length === 0) {
    throw datosInvalidos('El campo contrasena es obligatorio.');
  }
  return valor;
}

module.exports = {
  TIPOS,
  ESTADOS,
  ROLES,
  cuerpo,
  textoObligatorio,
  textoOpcional,
  montoCentavos,
  opcion,
  opcionOpcional,
  enteroConsulta,
  fechaOpcional,
  correo,
  contrasenaNueva,
  contrasenaPresente,
};
