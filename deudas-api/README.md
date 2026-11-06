# API de deudas (Express + MySQL)

API REST con inicio de sesión para llevar el control de personas, deudas y abonos.
Cada usuario ve únicamente sus propios datos.

## Requisitos

- Node.js 18 o superior
- MySQL 8 o MariaDB 10.5 o superior

## Instalación

```bash
npm install
cp .env.example .env      # en Windows: copy .env.example .env
```

Edita `.env` y completa, como mínimo, `DB_USER`, `DB_PASSWORD` y `JWT_SECRET`.
Para generar un secreto:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Variables de entorno

| Variable | Para qué sirve | Por defecto |
|---|---|---|
| `PORT` | Puerto de la API | `3000` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexión a MySQL | `127.0.0.1`, `3306`, `root`, vacío, `deudas_db` |
| `DB_LIMITE_CONEXIONES` | Conexiones simultáneas a MySQL | `10` |
| `JWT_SECRET` | Firma de los tokens (obligatorio, mínimo 32 caracteres) | — |
| `JWT_EXPIRA` | Duración del token de acceso | `15m` |
| `REFRESCO_DIAS` | Duración de la sesión sin actividad (refresh token) | `30` |
| `LIMITE_AUTH` | Intentos fallidos de login/registro/renovación por IP cada 15 min | `30` |
| `TRUST_PROXY` | Cuántos proxys hay delante de la API (por ejemplo `1` con Nginx). Vacío = ninguno | vacío |
| `CORS_ORIGENES` | Orígenes web permitidos, separados por comas. Vacío = CORS desactivado | vacío |
| `LOG_PETICIONES` | `false` para no registrar una línea por petición | activado |

## Base de datos

```bash
npm run db:init
```

Crea la base (`DB_NAME`), las tablas de `db/schema.sql` y **actualiza las bases creadas con
versiones anteriores** (agrega `usuarios.rol`, la tabla `sesiones` y pasa las fechas a
milisegundos). Se puede ejecutar las veces que quieras. También puedes ejecutar `db/schema.sql`
a mano en Workbench, pero entonces las bases viejas no se actualizan.

## Ejecutar

```bash
npm run dev      # desarrollo: se reinicia al guardar cambios
npm start        # producción
```

## Probar

Con la API y la base en marcha:

```bash
npm run prueba                          # contra http://localhost:PORT
API_URL=http://IP:3000 npm run prueba   # contra un servidor remoto
```

Variables opcionales de la prueba:

- `PRUEBA_LENTA=1`: añade la prueba de reutilización de un refresh token viejo (espera ~11 s).
- `PRUEBA_ADMIN_CORREO` y `PRUEBA_ADMIN_CONTRASENA`: un usuario ADMIN para probar `/api/admin`
  (créalo registrándote y luego `npm run admin -- correo@ejemplo.com`).

## Autenticación

1. `POST /api/auth/registro` o `POST /api/auth/login` (o sus alias `/api/register` y
   `/api/login`) devuelven `token` (acceso), `refreshToken` y el `usuario` (con su `rol`).
2. Todas las demás rutas (salvo `/api/salud`) exigen `Authorization: Bearer <token>`.
3. El token de acceso dura poco (`JWT_EXPIRA`, 15 minutos por defecto). Cuando vence, la app
   lo cambia por uno nuevo con `POST /api/auth/refrescar` y `{ "refreshToken": "..." }`. Cada
   refresh token **sirve una sola vez**: la respuesta trae uno nuevo que reemplaza al anterior.
4. La contraseña debe tener **al menos 8 caracteres** (máximo 72 bytes). Se guarda cifrada
   con bcrypt; nunca se devuelve en las respuestas.
5. **Cerrar sesión de verdad:** `POST /api/auth/logout` con `{ "refreshToken": "..." }` cierra
   esa sesión y su token de acceso deja de valer al instante. `POST /api/auth/cerrar-todas`
   (con token) cierra las sesiones de todos los dispositivos del usuario.
6. Si alguien reutiliza un refresh token viejo (señal de que fue copiado), la sesión completa
   se cierra. Un reintento dentro de los 10 segundos siguientes solo se rechaza, sin cerrar la
   sesión, para tolerar reintentos de la app por mala conexión.

### Qué debe hacer la app ante un 401

| `codigo` | Significado | Acción de la app |
|---|---|---|
| `TOKEN_EXPIRADO` | El token de acceso venció | Llamar a `/auth/refrescar` una vez y repetir la petición |
| `REFRESCO_INVALIDO` | El refresh token no sirve (usado, vencido o inventado) | Borrar los tokens y volver al login |
| `SESION_CERRADA`, `TOKEN_INVALIDO`, `NO_AUTENTICADO` | Sesión cerrada o token no válido | Borrar los tokens y volver al login |
| `CREDENCIALES_INVALIDAS` | Solo en el login: correo o contraseña mal | **No** cerrar sesión; mostrar el error en el formulario |

## Endpoints

| Método y ruta | Qué hace | Éxito |
|---|---|---|
| `GET /api/salud` | Comprueba la API y la base (sin login) | 200 |
| `POST /api/auth/registro` (alias `/api/register`) | Crea una cuenta | 201 |
| `POST /api/auth/login` (alias `/api/login`) | Inicia sesión | 200 |
| `POST /api/auth/refrescar` | Cambia un refresh token por tokens nuevos | 200 |
| `POST /api/auth/logout` | Cierra la sesión del refresh token | 204 |
| `POST /api/auth/cerrar-todas` | Cierra todas las sesiones del usuario | 204 |
| `GET /api/auth/perfil` | Datos del usuario con sesión | 200 |
| `GET /api/personas` | Lista las personas | 200 |
| `POST /api/personas` | Crea una persona | 201 |
| `PUT /api/personas/:id` | Edita nombre y teléfono | 200 |
| `DELETE /api/personas/:id` | Elimina la persona **y sus deudas y abonos** | 204 |
| `GET /api/deudas` | Lista deudas (filtros `tipo`, `estado`, `personaId`; paginación `page`, `limit`) | 200 |
| `GET /api/deudas/:id` | Detalle con abonos | 200 |
| `POST /api/deudas` | Crea una deuda | 201 |
| `PUT /api/deudas/:id` | Edita concepto, monto, vencimiento y, opcionalmente, `tipo` y `personaId` | 200 |
| `DELETE /api/deudas/:id` | Elimina la deuda y sus abonos | 204 |
| `POST /api/deudas/:id/abonos` | Registra un abono | 201 |
| `DELETE /api/deudas/:id/abonos/:abonoId` | Deshace un abono; devuelve la deuda recalculada | 200 |
| `POST /api/deudas/:id/liquidar` | Paga de golpe el saldo restante | 200 |
| `GET /api/resumen` | Totales: me deben, debo, balance | 200 |
| `GET /api/admin/usuarios` | Lista los usuarios (solo ADMIN) | 200 |
| `PATCH /api/admin/usuarios/:id/rol` | Cambia el rol `USUARIO` / `ADMIN` (solo ADMIN) | 200 |
| `DELETE /api/admin/usuarios/:id` | Elimina un usuario y todo lo suyo (solo ADMIN) | 204 |

Convenciones: JSON en `camelCase`; dinero en **centavos enteros**; fechas en ISO 8601
(`vencimiento` solo `AAAA-MM-DD`); `tipo` es `ME_DEBEN` o `DEBO`; `estado` es
`PENDIENTE`, `PARCIAL` o `PAGADA`. El saldo y el estado se calculan en el servidor.

### Editar una deuda

`PUT /api/deudas/:id` reemplaza `concepto`, `montoTotalCentavos` y `vencimiento` (si no viene,
se borra). `tipo` y `personaId` son **opcionales**: si no vienen, la deuda conserva los que
tenía; si vienen, la persona debe ser del mismo usuario. Así el formulario de edición puede ser
el mismo que el de creación.

### Paginación

`GET /api/deudas` devuelve **todas** las deudas, salvo que envíes `page` y/o `limit`:

- `page` (desde 1, por defecto 1) y `limit` (1 a 100, por defecto 20).
- El cuerpo sigue siendo la lista. El total de deudas que cumplen los filtros viaja en los
  encabezados `X-Total-Count`, `X-Page` y `X-Limit`.
- Funciona junto con los filtros: `?estado=PENDIENTE&page=2&limit=10`. El filtro por `estado`
  se aplica en la base de datos, así que el total y las páginas son correctos.
- Orden: de la más reciente a la más antigua.

## Roles

Cada usuario tiene un `rol`: `USUARIO` (por defecto) o `ADMIN`. Solo los ADMIN entran a
`/api/admin`. El rol se lee de la base en cada petición, así que un cambio vale al instante.
Nadie puede cambiarse el rol ni eliminarse a sí mismo desde la API.

El primer administrador se crea desde la terminal (la persona debe haberse registrado antes):

```bash
npm run admin -- correo@ejemplo.com             # dar el rol ADMIN
npm run admin -- correo@ejemplo.com USUARIO     # quitarlo
```

## Errores

Todas las fallas tienen el mismo formato:

```json
{ "error": { "codigo": "ABONO_EXCEDE_SALDO", "mensaje": "El abono supera el saldo pendiente." } }
```

| HTTP | Códigos |
|---|---|
| 400 | `DATOS_INVALIDOS` |
| 401 | `NO_AUTENTICADO`, `TOKEN_INVALIDO`, `TOKEN_EXPIRADO`, `SESION_CERRADA`, `REFRESCO_INVALIDO`, `CREDENCIALES_INVALIDAS` |
| 403 | `SIN_PERMISO` |
| 404 | `PERSONA_NO_ENCONTRADA`, `DEUDA_NO_ENCONTRADA`, `ABONO_NO_ENCONTRADO`, `USUARIO_NO_ENCONTRADO`, `RUTA_NO_ENCONTRADA` |
| 409 | `CORREO_EN_USO`, `ABONO_EXCEDE_SALDO`, `DEUDA_YA_PAGADA`, `MONTO_MENOR_A_ABONOS`, `ACCION_NO_PERMITIDA` |
| 429 | `DEMASIADOS_INTENTOS` (login, registro y renovación fallidos repetidos) |
| 500 | `ERROR_INTERNO` |

## Estructura

```
routes → controllers → services → repositories → MySQL
```

- `routes/`: URLs y métodos.
- `controllers/`: leen la petición, validan los datos y responden.
- `services/`: reglas de negocio (saldo, abonos, sesiones, administración).
- `repositories/`: único lugar con consultas SQL (siempre con parámetros).
- `middlewares/`: autenticación, roles, límite de intentos, registro de peticiones y errores.
- `db/schema.sql`: tablas. `scripts/`: inicializar la base, prueba de humo y `promoverAdmin.js`.

## Despliegue en un servidor (por ejemplo, EC2)

1. Instala Node.js y MySQL o MariaDB en la instancia, y clona este repositorio.
2. `npm install --omit=dev`, crea `.env` con valores reales y ejecuta `npm run db:init`.
3. Ejecútala con PM2 para que se reinicie sola:
   ```bash
   npm install -g pm2
   pm2 start src/server.js --name deudas-api
   pm2 save
   pm2 startup        # ejecuta el comando que imprime
   ```
4. En el grupo de seguridad abre el puerto de la API (`PORT`) y SSH solo desde tu IP.
   **No abras el puerto 3306 de MySQL a internet.**
5. Comprueba con `GET /api/salud` y con `npm run prueba`.
6. Si pones la API detrás de Nginx o un balanceador (por ejemplo para HTTPS), define
   `TRUST_PROXY=1`. Sin eso, todos los clientes parecen tener la IP del proxy y el límite de
   intentos bloquearía a todos a la vez.

Al actualizar una instalación existente: `git pull`, `npm install`, `npm run db:init` y
reiniciar con `pm2 restart deudas-api`.

## Seguridad

- Sin HTTPS, el correo, la contraseña y los tokens viajan sin cifrar. Para pruebas está bien,
  pero no uses contraseñas reales; para uso real pon la API detrás de HTTPS.
- Nunca subas `.env` a GitHub (ya está en `.gitignore`).
- Cambiar `JWT_SECRET` invalida todos los tokens de acceso.
- Del refresh token solo se guarda su hash en la base de datos.
- El registro de peticiones no escribe cuerpos, encabezados ni parámetros de la URL.
- La API envía los encabezados de seguridad de `helmet`.

## Cambios respecto a la versión anterior

- **Los tokens emitidos antes de esta versión dejan de valer**: hay que iniciar sesión de nuevo
  (una sola vez).
- `JWT_EXPIRA` ahora es `15m` por defecto y la app debe renovar con `/auth/refrescar`.
  Si prefieres sesiones largas sin renovar, pon `JWT_EXPIRA=7d`; el cierre de sesión y la
  revocación siguen funcionando igual.
- Las respuestas de sesión incluyen `refreshToken`, y el `usuario` incluye `rol`.
- Cada petición autenticada consulta la sesión en la base de datos (una búsqueda por clave).
