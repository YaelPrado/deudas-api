// Prueba rápida de punta a punta contra una API en marcha.
// Uso:  npm run prueba                     (usa http://localhost:PORT)
//       API_URL=http://IP:3000 npm run prueba
//
// Variables opcionales:
//   PRUEBA_LENTA=1                       también prueba el cierre por reutilizar un refresh token
//                                        viejo (espera unos 11 segundos).
//   PRUEBA_ADMIN_CORREO / PRUEBA_ADMIN_CONTRASENA
//                                        un usuario con rol ADMIN (créalo con "npm run admin")
//                                        para probar las rutas de administración.
require('dotenv').config();

const URL_BASE = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;
let aciertos = 0;
let fallos = 0;

async function pedir(metodo, ruta, cuerpo, token) {
  const opciones = { method: metodo, headers: {} };
  if (cuerpo !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
  }
  if (token) opciones.headers.Authorization = `Bearer ${token}`;
  const respuesta = await fetch(`${URL_BASE}${ruta}`, opciones);
  const texto = await respuesta.text();
  return {
    estado: respuesta.status,
    datos: texto ? JSON.parse(texto) : null,
    encabezados: respuesta.headers,
  };
}

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function afirmar(condicion, descripcion, detalle) {
  if (condicion) {
    aciertos += 1;
    console.log(`  ok   ${descripcion}`);
  } else {
    fallos += 1;
    console.log(`  FALLA ${descripcion}`, detalle !== undefined ? JSON.stringify(detalle) : '');
  }
}

const codigo = (r) => r.datos && r.datos.error && r.datos.error.codigo;

async function main() {
  const sufijo = Date.now();
  const correoA = `ana${sufijo}@correo.com`;
  const correoB = `beto${sufijo}@correo.com`;
  let r;

  console.log('Salud y acceso');
  r = await pedir('GET', '/api/salud');
  afirmar(r.estado === 200 && r.datos.baseDatos === 'ok', 'La API y la base de datos responden', r);
  r = await pedir('GET', '/api/deudas');
  afirmar(r.estado === 401 && codigo(r) === 'NO_AUTENTICADO', 'Sin token se rechaza', r);
  r = await pedir('GET', '/api/deudas', undefined, 'token-falso');
  afirmar(r.estado === 401 && codigo(r) === 'TOKEN_INVALIDO', 'Un token falso se rechaza', r);
  r = await pedir('GET', '/api/no-existe');
  afirmar(r.estado === 404 && codigo(r) === 'RUTA_NO_ENCONTRADA', 'Ruta inexistente: 404', r);
  r = await pedir('POST', '/api/auth/login', '{ esto no es json');
  afirmar(r.estado === 400 && codigo(r) === 'DATOS_INVALIDOS', 'JSON mal formado: 400', r);

  console.log('Registro e inicio de sesión');
  r = await pedir('POST', '/api/auth/registro', { nombre: 'Ana', correo: correoA, contrasena: '1234567' });
  afirmar(r.estado === 400 && codigo(r) === 'DATOS_INVALIDOS', 'Contraseña de 7 caracteres: 400', r);
  r = await pedir('POST', '/api/auth/registro', { nombre: 'Ana', correo: 'no-es-correo', contrasena: '12345678' });
  afirmar(r.estado === 400, 'Correo inválido: 400', r);
  r = await pedir('POST', '/api/auth/registro', { nombre: 'Ana', correo: correoA, contrasena: '12345678' });
  afirmar(r.estado === 201 && r.datos.token && r.datos.usuario.correo === correoA, 'Contraseña de 8 caracteres: registro correcto', r);
  afirmar(r.datos && !JSON.stringify(r.datos).includes('hash'), 'La respuesta no expone el hash de la contraseña');
  r = await pedir('POST', '/api/auth/registro', { nombre: 'Ana', correo: correoA.toUpperCase(), contrasena: '12345678' });
  afirmar(r.estado === 409 && codigo(r) === 'CORREO_EN_USO', 'Correo repetido (aunque cambien mayúsculas): 409', r);
  r = await pedir('POST', '/api/auth/login', { correo: correoA, contrasena: 'incorrecta1' });
  afirmar(r.estado === 401 && codigo(r) === 'CREDENCIALES_INVALIDAS', 'Contraseña incorrecta: 401', r);
  r = await pedir('POST', '/api/auth/login', { correo: `nadie${sufijo}@correo.com`, contrasena: '12345678' });
  afirmar(r.estado === 401 && codigo(r) === 'CREDENCIALES_INVALIDAS', 'Correo desconocido: mismo error 401', r);
  r = await pedir('POST', '/api/auth/login', { correo: correoA, contrasena: '12345678' });
  afirmar(r.estado === 200 && r.datos.token, 'Login correcto', r);
  const tokenA = r.datos.token;
  r = await pedir('GET', '/api/auth/perfil', undefined, tokenA);
  afirmar(r.estado === 200 && r.datos.correo === correoA, 'Perfil con token', r);

  console.log('Personas');
  r = await pedir('POST', '/api/personas', { nombre: '   ' }, tokenA);
  afirmar(r.estado === 400, 'Nombre vacío: 400', r);
  r = await pedir('POST', '/api/personas', { nombre: 'Carlos', telefono: '9611234567' }, tokenA);
  afirmar(r.estado === 201 && r.datos.id, 'Crear persona', r);
  const personaId = r.datos.id;
  r = await pedir('GET', '/api/personas', undefined, tokenA);
  afirmar(r.estado === 200 && r.datos.length === 1, 'Listar personas', r);

  console.log('Deudas');
  const base = { personaId, tipo: 'ME_DEBEN', concepto: 'Préstamo', montoTotalCentavos: 150000 };
  r = await pedir('POST', '/api/deudas', { ...base, personaId: 'p_inexistente' }, tokenA);
  afirmar(r.estado === 404 && codigo(r) === 'PERSONA_NO_ENCONTRADA', 'Persona inexistente: 404', r);
  r = await pedir('POST', '/api/deudas', { ...base, montoTotalCentavos: 10.5 }, tokenA);
  afirmar(r.estado === 400, 'Monto con decimales: 400', r);
  r = await pedir('POST', '/api/deudas', { ...base, montoTotalCentavos: 0 }, tokenA);
  afirmar(r.estado === 400, 'Monto cero: 400', r);
  r = await pedir('POST', '/api/deudas', { ...base, tipo: 'OTRO' }, tokenA);
  afirmar(r.estado === 400, 'Tipo inválido: 400', r);
  r = await pedir('POST', '/api/deudas', { ...base, vencimiento: '2026-02-31' }, tokenA);
  afirmar(r.estado === 400, 'Fecha inexistente: 400', r);
  r = await pedir('POST', '/api/deudas', { ...base, vencimiento: '2026-12-15' }, tokenA);
  afirmar(r.estado === 201 && r.datos.estado === 'PENDIENTE' && r.datos.saldoCentavos === 150000 && r.datos.vencimiento === '2026-12-15', 'Crear deuda', r);
  const deudaId = r.datos.id;
  afirmar(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(r.datos.creadaEn), 'creadaEn en formato ISO 8601', r.datos.creadaEn);
  r = await pedir('GET', '/api/deudas?tipo=DEBO', undefined, tokenA);
  afirmar(r.estado === 200 && r.datos.length === 0, 'Filtro por tipo', r);
  r = await pedir('GET', '/api/deudas?estado=XYZ', undefined, tokenA);
  afirmar(r.estado === 400, 'Filtro de estado inválido: 400', r);
  r = await pedir('GET', '/api/deudas?estado=PENDIENTE', undefined, tokenA);
  afirmar(r.estado === 200 && r.datos.length === 1 && r.datos[0].abonos === undefined, 'La lista no trae abonos', r);

  console.log('Abonos, edición y pago total');
  r = await pedir('POST', `/api/deudas/${deudaId}/abonos`, { montoCentavos: 50000, nota: 'Efectivo' }, tokenA);
  afirmar(r.estado === 201 && r.datos.estado === 'PARCIAL' && r.datos.saldoCentavos === 100000 && r.datos.abonos.length === 1, 'Abono parcial', r);
  r = await pedir('POST', `/api/deudas/${deudaId}/abonos`, { montoCentavos: 100001 }, tokenA);
  afirmar(r.estado === 409 && codigo(r) === 'ABONO_EXCEDE_SALDO', 'Abono mayor al saldo: 409', r);
  r = await pedir('POST', `/api/deudas/${deudaId}/abonos`, { montoCentavos: 0 }, tokenA);
  afirmar(r.estado === 400, 'Abono en cero: 400', r);
  r = await pedir('PUT', `/api/deudas/${deudaId}`, { concepto: 'Préstamo', montoTotalCentavos: 40000 }, tokenA);
  afirmar(r.estado === 409 && codigo(r) === 'MONTO_MENOR_A_ABONOS', 'Bajar el monto por debajo de lo abonado: 409', r);
  r = await pedir('PUT', `/api/deudas/${deudaId}`, { concepto: 'Préstamo libros', montoTotalCentavos: 200000 }, tokenA);
  afirmar(r.estado === 200 && r.datos.saldoCentavos === 150000 && r.datos.vencimiento === null, 'Editar deuda', r);
  r = await pedir('POST', `/api/deudas/${deudaId}/liquidar`, undefined, tokenA);
  afirmar(r.estado === 200 && r.datos.estado === 'PAGADA' && r.datos.saldoCentavos === 0 && r.datos.abonos.length === 2, 'Pago total', r);
  r = await pedir('POST', `/api/deudas/${deudaId}/liquidar`, undefined, tokenA);
  afirmar(r.estado === 409 && codigo(r) === 'DEUDA_YA_PAGADA', 'Liquidar una deuda pagada: 409', r);
  r = await pedir('POST', `/api/deudas/${deudaId}/abonos`, { montoCentavos: 100 }, tokenA);
  afirmar(r.estado === 409 && codigo(r) === 'DEUDA_YA_PAGADA', 'Abonar a una deuda pagada: 409', r);

  console.log('Resumen');
  await pedir('POST', '/api/deudas', { personaId, tipo: 'DEBO', concepto: 'Cena', montoTotalCentavos: 30000 }, tokenA);
  await pedir('POST', '/api/deudas', { personaId, tipo: 'ME_DEBEN', concepto: 'Renta', montoTotalCentavos: 100000 }, tokenA);
  r = await pedir('GET', '/api/resumen', undefined, tokenA);
  afirmar(
    r.estado === 200 && r.datos.meDebenCentavos === 100000 && r.datos.deboCentavos === 30000 &&
      r.datos.balanceCentavos === 70000 && r.datos.deudasPendientes === 2,
    'Totales del resumen', r
  );

  console.log('Aislamiento entre usuarios');
  r = await pedir('POST', '/api/auth/registro', { nombre: 'Beto', correo: correoB, contrasena: 'otraClave99' });
  const tokenB = r.datos.token;
  r = await pedir('GET', '/api/deudas', undefined, tokenB);
  afirmar(r.estado === 200 && r.datos.length === 0, 'Otro usuario no ve las deudas ajenas', r);
  r = await pedir('GET', `/api/deudas/${deudaId}`, undefined, tokenB);
  afirmar(r.estado === 404, 'Otro usuario no puede abrir una deuda ajena', r);
  r = await pedir('POST', `/api/deudas/${deudaId}/abonos`, { montoCentavos: 100 }, tokenB);
  afirmar(r.estado === 404, 'Otro usuario no puede abonar a una deuda ajena', r);
  r = await pedir('POST', '/api/deudas', { ...base, personaId }, tokenB);
  afirmar(r.estado === 404 && codigo(r) === 'PERSONA_NO_ENCONTRADA', 'Otro usuario no puede usar personas ajenas', r);

  console.log('Abonos simultáneos');
  r = await pedir('POST', '/api/deudas', { personaId, tipo: 'ME_DEBEN', concepto: 'Carrera', montoTotalCentavos: 100000 }, tokenA);
  const carreraId = r.datos.id;
  const intentos = await Promise.all(
    Array.from({ length: 10 }, () => pedir('POST', `/api/deudas/${carreraId}/abonos`, { montoCentavos: 20000 }, tokenA))
  );
  const exitosos = intentos.filter((i) => i.estado === 201).length;
  const rechazados = intentos.filter((i) => i.estado === 409).length;
  afirmar(exitosos === 5 && rechazados === 5, '10 abonos a la vez: se aceptan 5 y se rechazan 5', { exitosos, rechazados });
  r = await pedir('GET', `/api/deudas/${carreraId}`, undefined, tokenA);
  afirmar(r.datos.saldoCentavos === 0 && r.datos.abonos.length === 5, 'El saldo nunca queda negativo', r.datos);

  console.log('Eliminar');
  r = await pedir('DELETE', `/api/deudas/${deudaId}`, undefined, tokenA);
  afirmar(r.estado === 204, 'Eliminar deuda: 204', r);
  r = await pedir('GET', `/api/deudas/${deudaId}`, undefined, tokenA);
  afirmar(r.estado === 404, 'La deuda eliminada ya no existe', r);

  console.log('Editar deuda: cambiar tipo y persona');
  r = await pedir('POST', '/api/personas', { nombre: 'Dana' }, tokenA);
  const danaId = r.datos.id;
  r = await pedir('POST', '/api/deudas', { personaId, tipo: 'ME_DEBEN', concepto: 'Boletos', montoTotalCentavos: 80000 }, tokenA);
  const boletosId = r.datos.id;
  r = await pedir('PUT', `/api/deudas/${boletosId}`, { tipo: 'DEBO', personaId: danaId, concepto: 'Boletos', montoTotalCentavos: 80000 }, tokenA);
  afirmar(r.estado === 200 && r.datos.tipo === 'DEBO' && r.datos.personaId === danaId && r.datos.personaNombre === 'Dana', 'Editar cambia el tipo y la persona', r);
  r = await pedir('PUT', `/api/deudas/${boletosId}`, { concepto: 'Boletos concierto', montoTotalCentavos: 80000 }, tokenA);
  afirmar(r.estado === 200 && r.datos.tipo === 'DEBO' && r.datos.personaId === danaId, 'Sin tipo ni persona, se conservan los que tenía', r);
  r = await pedir('POST', '/api/personas', { nombre: 'Ajena' }, tokenB);
  const personaDeBId = r.datos.id;
  r = await pedir('PUT', `/api/deudas/${boletosId}`, { personaId: personaDeBId, concepto: 'Boletos', montoTotalCentavos: 80000 }, tokenA);
  afirmar(r.estado === 404 && codigo(r) === 'PERSONA_NO_ENCONTRADA', 'No se puede pasar la deuda a una persona ajena', r);
  r = await pedir('PUT', `/api/deudas/${boletosId}`, { tipo: 'OTRO', concepto: 'Boletos', montoTotalCentavos: 80000 }, tokenA);
  afirmar(r.estado === 400, 'Tipo inválido al editar: 400', r);

  console.log('Deshacer abonos');
  r = await pedir('POST', `/api/deudas/${boletosId}/abonos`, { montoCentavos: 30000, nota: 'Por error' }, tokenA);
  const abonoErrorId = r.datos.abonos[0].id;
  await pedir('POST', `/api/deudas/${boletosId}/abonos`, { montoCentavos: 10000 }, tokenA);
  r = await pedir('DELETE', `/api/deudas/${boletosId}/abonos/${abonoErrorId}`, undefined, tokenA);
  afirmar(r.estado === 200 && r.datos.abonos.length === 1 && r.datos.saldoCentavos === 70000 && r.datos.estado === 'PARCIAL', 'Deshacer un abono recalcula saldo y estado', r);
  r = await pedir('DELETE', `/api/deudas/${boletosId}/abonos/${abonoErrorId}`, undefined, tokenA);
  afirmar(r.estado === 404 && codigo(r) === 'ABONO_NO_ENCONTRADO', 'Deshacer dos veces el mismo abono: 404', r);
  r = await pedir('DELETE', `/api/deudas/${boletosId}/abonos/${abonoErrorId}`, undefined, tokenB);
  afirmar(r.estado === 404 && codigo(r) === 'DEUDA_NO_ENCONTRADA', 'Otro usuario no puede deshacer abonos ajenos', r);
  r = await pedir('GET', `/api/deudas/${carreraId}`, undefined, tokenA);
  const abonoDeOtraDeuda = r.datos.abonos[0].id;
  r = await pedir('DELETE', `/api/deudas/${boletosId}/abonos/${abonoDeOtraDeuda}`, undefined, tokenA);
  afirmar(r.estado === 404 && codigo(r) === 'ABONO_NO_ENCONTRADO', 'Un abono de otra deuda no se puede deshacer desde esta', r);
  r = await pedir('GET', `/api/deudas/${carreraId}`, undefined, tokenA);
  afirmar(r.datos.abonos.length === 5, 'La otra deuda conserva sus 5 abonos', r.datos);

  console.log('Orden estable de abonos');
  r = await pedir('POST', '/api/deudas', { personaId, tipo: 'ME_DEBEN', concepto: 'Orden', montoTotalCentavos: 100000 }, tokenA);
  const ordenId = r.datos.id;
  const montosEnviados = [1000, 2000, 3000, 4000, 5000];
  for (const monto of montosEnviados) {
    await pedir('POST', `/api/deudas/${ordenId}/abonos`, { montoCentavos: monto }, tokenA);
  }
  r = await pedir('GET', `/api/deudas/${ordenId}`, undefined, tokenA);
  afirmar(JSON.stringify(r.datos.abonos.map((a) => a.montoCentavos)) === JSON.stringify(montosEnviados), 'Los abonos salen en el orden en que se registraron', r.datos.abonos);
  afirmar(r.datos.abonos.every((a) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(a.fecha)), 'La fecha del abono sigue en ISO 8601 a segundos', r.datos.abonos[0]);

  console.log('Personas: editar y eliminar');
  r = await pedir('PUT', `/api/personas/${danaId}`, { nombre: 'Dana Ruiz', telefono: '9617654321' }, tokenA);
  afirmar(r.estado === 200 && r.datos.nombre === 'Dana Ruiz' && r.datos.telefono === '9617654321', 'Editar persona', r);
  r = await pedir('PUT', `/api/personas/${danaId}`, { nombre: 'Dana Ruiz' }, tokenA);
  afirmar(r.estado === 200 && r.datos.telefono === null, 'Editar sin teléfono lo borra', r);
  r = await pedir('PUT', `/api/personas/${danaId}`, { nombre: '   ' }, tokenA);
  afirmar(r.estado === 400, 'Editar persona con nombre vacío: 400', r);
  r = await pedir('PUT', `/api/personas/${danaId}`, { nombre: 'Intruso' }, tokenB);
  afirmar(r.estado === 404 && codigo(r) === 'PERSONA_NO_ENCONTRADA', 'Otro usuario no puede editar la persona', r);
  r = await pedir('DELETE', `/api/personas/${danaId}`, undefined, tokenB);
  afirmar(r.estado === 404, 'Otro usuario no puede eliminar la persona', r);
  r = await pedir('PUT', '/api/personas/p_inexistente', { nombre: 'X' }, tokenA);
  afirmar(r.estado === 404 && codigo(r) === 'PERSONA_NO_ENCONTRADA', 'Editar una persona inexistente: 404', r);
  r = await pedir('DELETE', `/api/personas/${danaId}`, undefined, tokenA);
  afirmar(r.estado === 204, 'Eliminar persona: 204', r);
  r = await pedir('GET', `/api/deudas/${boletosId}`, undefined, tokenA);
  afirmar(r.estado === 404, 'Al eliminar la persona se eliminan sus deudas', r);
  r = await pedir('GET', '/api/personas', undefined, tokenA);
  afirmar(!r.datos.some((p) => p.id === danaId), 'La persona eliminada ya no aparece en la lista', r.datos);

  console.log('Paginación y filtro por estado');
  r = await pedir('POST', '/api/auth/registro', { nombre: 'Cora', correo: `cora${sufijo}@correo.com`, contrasena: 'claveCora1' });
  const tokenC = r.datos.token;
  r = await pedir('POST', '/api/personas', { nombre: 'Luis' }, tokenC);
  const luisId = r.datos.id;
  const ids = {};
  for (const [concepto, tipo, monto] of [
    ['Uno', 'ME_DEBEN', 10000], ['Dos', 'DEBO', 20000], ['Tres', 'ME_DEBEN', 30000],
    ['Cuatro', 'ME_DEBEN', 40000], ['Cinco', 'DEBO', 50000],
  ]) {
    r = await pedir('POST', '/api/deudas', { personaId: luisId, tipo, concepto, montoTotalCentavos: monto }, tokenC);
    ids[concepto] = r.datos.id;
  }
  await pedir('POST', `/api/deudas/${ids.Uno}/liquidar`, undefined, tokenC); // Uno: PAGADA
  await pedir('POST', `/api/deudas/${ids.Dos}/abonos`, { montoCentavos: 5000 }, tokenC); // Dos: PARCIAL
  const conceptos = (resp) => resp.datos.map((d) => d.concepto);
  const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  r = await pedir('GET', '/api/deudas', undefined, tokenC);
  afirmar(r.estado === 200 && r.datos.length === 5 && !r.encabezados.get('x-total-count'), 'Sin page ni limit se devuelven todas y sin X-Total-Count', r.datos.length);
  r = await pedir('GET', '/api/deudas?page=1&limit=2', undefined, tokenC);
  afirmar(iguales(conceptos(r), ['Cinco', 'Cuatro']) && r.encabezados.get('x-total-count') === '5' && r.encabezados.get('x-page') === '1' && r.encabezados.get('x-limit') === '2', 'Página 1 de 2: las más recientes y total 5', { c: conceptos(r), t: r.encabezados.get('x-total-count') });
  r = await pedir('GET', '/api/deudas?page=3&limit=2', undefined, tokenC);
  afirmar(iguales(conceptos(r), ['Uno']), 'Última página con un solo elemento', conceptos(r));
  r = await pedir('GET', '/api/deudas?page=9&limit=2', undefined, tokenC);
  afirmar(r.estado === 200 && r.datos.length === 0 && r.encabezados.get('x-total-count') === '5', 'Página fuera de rango: lista vacía y total 5', r);
  r = await pedir('GET', '/api/deudas?limit=3', undefined, tokenC);
  afirmar(r.datos.length === 3 && r.encabezados.get('x-page') === '1', 'Solo limit: empieza en la página 1', r.datos.length);
  r = await pedir('GET', '/api/deudas?page=2', undefined, tokenC);
  afirmar(r.datos.length === 0 && r.encabezados.get('x-limit') === '20' && r.encabezados.get('x-total-count') === '5', 'Solo page: límite por defecto de 20', r.encabezados.get('x-limit'));
  for (const consulta of ['limit=0', 'limit=101', 'page=0', 'page=abc', 'limit=2&limit=3', 'limit=-1']) {
    r = await pedir('GET', `/api/deudas?${consulta}`, undefined, tokenC);
    afirmar(r.estado === 400 && codigo(r) === 'DATOS_INVALIDOS', `Paginación inválida (${consulta}): 400`, r);
  }
  r = await pedir('GET', '/api/deudas?estado=PAGADA', undefined, tokenC);
  afirmar(iguales(conceptos(r), ['Uno']), 'Filtro estado=PAGADA', conceptos(r));
  r = await pedir('GET', '/api/deudas?estado=PARCIAL', undefined, tokenC);
  afirmar(iguales(conceptos(r), ['Dos']), 'Filtro estado=PARCIAL', conceptos(r));
  r = await pedir('GET', '/api/deudas?estado=PENDIENTE', undefined, tokenC);
  afirmar(iguales(conceptos(r), ['Cinco', 'Cuatro', 'Tres']), 'Filtro estado=PENDIENTE', conceptos(r));
  r = await pedir('GET', '/api/deudas?estado=PENDIENTE&page=1&limit=2', undefined, tokenC);
  afirmar(iguales(conceptos(r), ['Cinco', 'Cuatro']) && r.encabezados.get('x-total-count') === '3', 'Estado + paginación: el total cuenta solo las filtradas', { c: conceptos(r), t: r.encabezados.get('x-total-count') });
  r = await pedir('GET', '/api/deudas?estado=PENDIENTE&page=2&limit=2', undefined, tokenC);
  afirmar(iguales(conceptos(r), ['Tres']), 'Estado + paginación: segunda página', conceptos(r));
  r = await pedir('GET', '/api/deudas?estado=PENDIENTE&tipo=DEBO', undefined, tokenC);
  afirmar(iguales(conceptos(r), ['Cinco']), 'Estado y tipo combinados', conceptos(r));
  r = await pedir('GET', `/api/deudas?personaId=${luisId}&estado=PARCIAL`, undefined, tokenA);
  afirmar(r.estado === 200 && r.datos.length === 0, 'Los filtros nunca muestran deudas de otro usuario', r);

  console.log('Sesiones: renovar, cerrar y revocar');
  const correoD = `dora${sufijo}@correo.com`;
  r = await pedir('POST', '/api/auth/registro', { nombre: 'Dora', correo: correoD, contrasena: 'claveDora1' });
  afirmar(r.estado === 201 && typeof r.datos.refreshToken === 'string' && r.datos.usuario.rol === 'USUARIO', 'El registro devuelve token, refreshToken y rol', r);
  const acceso1 = r.datos.token;
  const refresco1 = r.datos.refreshToken;
  r = await pedir('POST', '/api/auth/refrescar', {});
  afirmar(r.estado === 400, 'Renovar sin refreshToken: 400', r);
  r = await pedir('POST', '/api/auth/refrescar', { refreshToken: 'inventado' });
  afirmar(r.estado === 401 && codigo(r) === 'REFRESCO_INVALIDO', 'Renovar con un token inventado: 401', r);
  r = await pedir('POST', '/api/auth/refrescar', { refreshToken: refresco1 });
  afirmar(r.estado === 200 && r.datos.token && r.datos.refreshToken && r.datos.refreshToken !== refresco1, 'Renovar entrega tokens nuevos', r);
  const acceso2 = r.datos.token;
  r = await pedir('GET', '/api/auth/perfil', undefined, acceso2);
  afirmar(r.estado === 200 && r.datos.correo === correoD, 'El token nuevo funciona', r);
  r = await pedir('GET', '/api/auth/perfil', undefined, acceso1);
  afirmar(r.estado === 200, 'El token anterior sigue valiendo hasta que caduque', r);
  r = await pedir('POST', '/api/auth/refrescar', { refreshToken: refresco1 });
  afirmar(r.estado === 401 && codigo(r) === 'REFRESCO_INVALIDO', 'Un refresh token solo sirve una vez', r);
  r = await pedir('GET', '/api/auth/perfil', undefined, acceso2);
  afirmar(r.estado === 200, 'Un reintento inmediato no cierra la sesión (margen de gracia)', r);
  if (process.env.PRUEBA_LENTA === '1') {
    await dormir(11000);
    r = await pedir('POST', '/api/auth/refrescar', { refreshToken: refresco1 });
    afirmar(r.estado === 401, 'Reutilizar un refresh token viejo pasado el margen: 401', r);
    r = await pedir('GET', '/api/auth/perfil', undefined, acceso2);
    afirmar(r.estado === 401 && codigo(r) === 'SESION_CERRADA', 'Y se cierra toda la sesión (posible robo)', r);
  } else {
    console.log('  (omitida) Reutilización tardía de un refresh token: usa PRUEBA_LENTA=1');
  }

  r = await pedir('POST', '/api/auth/login', { correo: correoD, contrasena: 'claveDora1' });
  const sesion1 = r.datos;
  r = await pedir('POST', '/api/auth/logout', { refreshToken: sesion1.refreshToken });
  afirmar(r.estado === 204, 'Cerrar sesión con el refreshToken: 204', r);
  r = await pedir('GET', '/api/auth/perfil', undefined, sesion1.token);
  afirmar(r.estado === 401 && codigo(r) === 'SESION_CERRADA', 'Tras cerrar sesión, el token de acceso deja de valer al instante', r);
  r = await pedir('POST', '/api/auth/refrescar', { refreshToken: sesion1.refreshToken });
  afirmar(r.estado === 401 && codigo(r) === 'REFRESCO_INVALIDO', 'Tras cerrar sesión, el refresh token deja de valer', r);
  r = await pedir('POST', '/api/auth/logout', { refreshToken: 'desconocido' });
  afirmar(r.estado === 204, 'Cerrar sesión con un token desconocido también responde 204', r);
  r = await pedir('POST', '/api/auth/logout', {});
  afirmar(r.estado === 400, 'Cerrar sesión sin refreshToken: 400', r);

  r = await pedir('POST', '/api/auth/login', { correo: correoD, contrasena: 'claveDora1' });
  const telefono = r.datos;
  r = await pedir('POST', '/api/auth/login', { correo: correoD, contrasena: 'claveDora1' });
  const laptop = r.datos;
  r = await pedir('POST', '/api/auth/cerrar-todas', undefined, telefono.token);
  afirmar(r.estado === 204, 'Cerrar todas las sesiones: 204', r);
  r = await pedir('GET', '/api/auth/perfil', undefined, telefono.token);
  const cerradaA = codigo(r);
  r = await pedir('GET', '/api/auth/perfil', undefined, laptop.token);
  afirmar(cerradaA === 'SESION_CERRADA' && codigo(r) === 'SESION_CERRADA', 'Se cierran las sesiones de todos los dispositivos', r);
  r = await pedir('POST', '/api/auth/cerrar-todas');
  afirmar(r.estado === 401 && codigo(r) === 'NO_AUTENTICADO', 'Cerrar todas sin token: 401', r);

  console.log('Alias del contrato: /register y /login');
  const correoE = `eva${sufijo}@correo.com`;
  r = await pedir('POST', '/api/register', { nombre: 'Eva', correo: correoE, contrasena: 'claveEva123' });
  afirmar(r.estado === 201 && r.datos.token, 'POST /api/register', r);
  r = await pedir('POST', '/api/login', { correo: correoE, contrasena: 'claveEva123' });
  afirmar(r.estado === 200 && r.datos.token, 'POST /api/login', r);
  r = await pedir('GET', '/api/auth/perfil', undefined, r.datos.token);
  afirmar(r.estado === 200 && r.datos.correo === correoE, 'El token del alias funciona igual', r);

  console.log('Roles y administración');
  r = await pedir('GET', '/api/admin/usuarios', undefined, tokenA);
  afirmar(r.estado === 403 && codigo(r) === 'SIN_PERMISO', 'Un usuario normal no entra a /api/admin: 403', r);
  r = await pedir('GET', '/api/admin/usuarios');
  afirmar(r.estado === 401, 'Sin token no entra a /api/admin: 401', r);
  if (!process.env.PRUEBA_ADMIN_CORREO || !process.env.PRUEBA_ADMIN_CONTRASENA) {
    console.log('  (omitidas) Rutas de administración: define PRUEBA_ADMIN_CORREO y PRUEBA_ADMIN_CONTRASENA');
  } else {
    r = await pedir('POST', '/api/auth/login', { correo: process.env.PRUEBA_ADMIN_CORREO, contrasena: process.env.PRUEBA_ADMIN_CONTRASENA });
    const tokenAdmin = r.datos && r.datos.token;
    const adminId = r.datos && r.datos.usuario.id;
    afirmar(r.estado === 200 && r.datos.usuario.rol === 'ADMIN', 'El administrador inicia sesión con rol ADMIN', r);
    r = await pedir('GET', '/api/auth/perfil', undefined, tokenB);
    const idB = r.datos.id;
    r = await pedir('GET', '/api/admin/usuarios', undefined, tokenAdmin);
    afirmar(r.estado === 200 && r.datos.some((u) => u.id === idB) && !JSON.stringify(r.datos).includes('hash'), 'Listar usuarios (sin exponer contraseñas)', r.estado);
    r = await pedir('PATCH', `/api/admin/usuarios/${idB}/rol`, { rol: 'ADMIN' }, tokenAdmin);
    afirmar(r.estado === 200 && r.datos.rol === 'ADMIN', 'Dar rol ADMIN a otro usuario', r);
    r = await pedir('GET', '/api/admin/usuarios', undefined, tokenB);
    afirmar(r.estado === 200, 'El cambio de rol surte efecto de inmediato', r);
    r = await pedir('PATCH', `/api/admin/usuarios/${idB}/rol`, { rol: 'USUARIO' }, tokenAdmin);
    afirmar(r.estado === 200 && r.datos.rol === 'USUARIO', 'Quitar el rol ADMIN', r);
    r = await pedir('GET', '/api/admin/usuarios', undefined, tokenB);
    afirmar(r.estado === 403, 'Sin el rol, vuelve a recibir 403 al instante', r);
    r = await pedir('PATCH', `/api/admin/usuarios/${idB}/rol`, { rol: 'DIOS' }, tokenAdmin);
    afirmar(r.estado === 400, 'Rol inválido: 400', r);
    r = await pedir('PATCH', `/api/admin/usuarios/${adminId}/rol`, { rol: 'USUARIO' }, tokenAdmin);
    afirmar(r.estado === 409 && codigo(r) === 'ACCION_NO_PERMITIDA', 'No puede cambiarse su propio rol', r);
    r = await pedir('PATCH', '/api/admin/usuarios/u_inexistente/rol', { rol: 'ADMIN' }, tokenAdmin);
    afirmar(r.estado === 404 && codigo(r) === 'USUARIO_NO_ENCONTRADO', 'Cambiar el rol de un usuario inexistente: 404', r);
    r = await pedir('DELETE', `/api/admin/usuarios/${adminId}`, undefined, tokenAdmin);
    afirmar(r.estado === 409 && codigo(r) === 'ACCION_NO_PERMITIDA', 'No puede eliminarse a sí mismo', r);
    r = await pedir('DELETE', '/api/admin/usuarios/u_inexistente', undefined, tokenAdmin);
    afirmar(r.estado === 404, 'Eliminar un usuario inexistente: 404', r);
    r = await pedir('DELETE', `/api/admin/usuarios/${idB}`, undefined, tokenAdmin);
    afirmar(r.estado === 204, 'Eliminar un usuario: 204', r);
    r = await pedir('GET', '/api/auth/perfil', undefined, tokenB);
    afirmar(r.estado === 401 && codigo(r) === 'SESION_CERRADA', 'El usuario eliminado pierde la sesión al instante', r);
  }

  console.log(`\nResultado: ${aciertos} correctas, ${fallos} con falla.`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('No se pudo ejecutar la prueba:', error.message);
  process.exit(1);
});
