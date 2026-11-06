-- Esquema de la base de datos de la API de deudas.
-- Con "npm run db:init" se crea la base, se ejecuta este archivo y se aplican las
-- migraciones de scripts/inicializarBd.js a las bases que ya existían (es repetible).
-- Si lo ejecutas a mano en Workbench, primero crea la base y selecciónala:
--   CREATE DATABASE deudas_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--   USE deudas_db;
--
-- Las fechas con hora usan DATETIME(3) (milisegundos) para que el orden de los registros
-- creados en el mismo segundo sea estable. La API las entrega a segundos en ISO 8601.

CREATE TABLE IF NOT EXISTS usuarios (
  id               VARCHAR(20)  NOT NULL,
  nombre           VARCHAR(50)  NOT NULL,
  correo           VARCHAR(100) NOT NULL,
  contrasena_hash  VARCHAR(100) NOT NULL,
  rol              ENUM('USUARIO', 'ADMIN') NOT NULL DEFAULT 'USUARIO',
  creado_en        DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_correo (correo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Una fila por inicio de sesión (por dispositivo). Guarda solo el hash del refresh token.
CREATE TABLE IF NOT EXISTS sesiones (
  id                     VARCHAR(20)  NOT NULL,
  usuario_id             VARCHAR(20)  NOT NULL,
  refresh_hash           CHAR(64)     NOT NULL,
  refresh_anterior_hash  CHAR(64)     NULL,
  creada_en              DATETIME(3)  NOT NULL,
  rotada_en              DATETIME(3)  NOT NULL,
  expira_en              DATETIME(3)  NOT NULL,
  revocada_en            DATETIME(3)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sesiones_refresh (refresh_hash),
  KEY idx_sesiones_anterior (refresh_anterior_hash),
  KEY idx_sesiones_usuario (usuario_id),
  CONSTRAINT fk_sesiones_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS personas (
  id          VARCHAR(20) NOT NULL,
  usuario_id  VARCHAR(20) NOT NULL,
  nombre      VARCHAR(50) NOT NULL,
  telefono    VARCHAR(20) NULL,
  PRIMARY KEY (id),
  KEY idx_personas_usuario (usuario_id),
  CONSTRAINT fk_personas_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deudas (
  id                    VARCHAR(20)  NOT NULL,
  usuario_id            VARCHAR(20)  NOT NULL,
  persona_id            VARCHAR(20)  NOT NULL,
  tipo                  ENUM('ME_DEBEN', 'DEBO') NOT NULL,
  concepto              VARCHAR(100) NOT NULL,
  monto_total_centavos  INT UNSIGNED NOT NULL,
  vencimiento           DATE         NULL,
  creada_en             DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_deudas_usuario (usuario_id),
  KEY idx_deudas_persona (persona_id),
  CONSTRAINT fk_deudas_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_deudas_persona
    FOREIGN KEY (persona_id) REFERENCES personas (id) ON DELETE CASCADE,
  CONSTRAINT ck_deudas_monto CHECK (monto_total_centavos > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS abonos (
  id              VARCHAR(20)  NOT NULL,
  deuda_id        VARCHAR(20)  NOT NULL,
  monto_centavos  INT UNSIGNED NOT NULL,
  nota            VARCHAR(100) NULL,
  fecha           DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_abonos_deuda (deuda_id),
  CONSTRAINT fk_abonos_deuda
    FOREIGN KEY (deuda_id) REFERENCES deudas (id) ON DELETE CASCADE,
  CONSTRAINT ck_abonos_monto CHECK (monto_centavos > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
