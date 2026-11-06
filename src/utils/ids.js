const { randomUUID } = require('crypto');

// Ejemplo: nuevoId('d') -> "d_3f9a1c2b"
const nuevoId = (prefijo) => `${prefijo}_${randomUUID().slice(0, 8)}`;

module.exports = { nuevoId };
