require('dotenv').config();

const secreto = process.env.JWT_SECRET;
if (!secreto || secreto.length < 32) {
  throw new Error(
    'Falta JWT_SECRET en el archivo .env o es demasiado corto (mínimo 32 caracteres).'
  );
}

// TRUST_PROXY: cuántos proxys hay delante de la API (por ejemplo 1 con Nginx o un balanceador).
// Vacío = ninguno. Sin esto, detrás de un proxy todas las peticiones parecen venir de la misma IP
// y el límite de intentos bloquearía a todos a la vez.
function leerTrustProxy(valor) {
  if (valor === undefined || valor.trim() === '' || valor.trim() === 'false') return false;
  const texto = valor.trim();
  if (/^\d+$/.test(texto)) return Number(texto);
  if (texto === 'true') {
    throw new Error('TRUST_PROXY=true confía en cualquier IP. Usa el número de proxys (por ejemplo 1).');
  }
  return texto; // por ejemplo "loopback" o "10.0.0.0/8"
}

const lista = (valor) =>
  (valor || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

module.exports = {
  puerto: Number(process.env.PORT) || 3000,
  bd: {
    host: process.env.DB_HOST || '127.0.0.1',
    puerto: Number(process.env.DB_PORT) || 3306,
    usuario: process.env.DB_USER || 'root',
    contrasena: process.env.DB_PASSWORD || '',
    nombre: process.env.DB_NAME || 'deudas_db',
    limiteConexiones: Number(process.env.DB_LIMITE_CONEXIONES) || 10,
  },
  jwt: {
    secreto,
    // El token de acceso dura poco; la sesión se renueva con el refresh token.
    expira: process.env.JWT_EXPIRA || '15m',
    refrescoDias: Number(process.env.REFRESCO_DIAS) || 30,
  },
  limiteAuth: Number(process.env.LIMITE_AUTH) || 30,
  trustProxy: leerTrustProxy(process.env.TRUST_PROXY),
  // Orígenes web permitidos (CORS), separados por comas. Vacío = CORS desactivado.
  corsOrigenes: lista(process.env.CORS_ORIGENES),
  logPeticiones: process.env.LOG_PETICIONES !== 'false',
};
