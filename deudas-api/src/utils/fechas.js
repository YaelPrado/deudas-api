// MySQL guarda las fechas con hora como "AAAA-MM-DD HH:MM:SS.mmm" (en UTC).
// La API las entrega en ISO 8601 a segundos, igual que siempre.

// Convierte un Date al formato que espera MySQL (con milisegundos).
function fechaParaBd(fecha) {
  return fecha.toISOString().slice(0, 23).replace('T', ' ');
}

// Fecha actual en el formato que espera MySQL.
function ahoraParaBd() {
  return fechaParaBd(new Date());
}

// "2026-10-30 18:00:00.123" -> "2026-10-30T18:00:00Z"
function aIso(valorBd) {
  return `${String(valorBd).replace(' ', 'T').slice(0, 19)}Z`;
}

// "2026-10-30 18:00:00.123" -> milisegundos desde 1970
function aMilisegundos(valorBd) {
  return Date.parse(`${String(valorBd).replace(' ', 'T')}Z`);
}

module.exports = { ahoraParaBd, fechaParaBd, aIso, aMilisegundos };
