# 04 — Infraestructura

## Visión General

Plane utiliza **Docker Compose** para orquestar todos sus servicios, tanto en desarrollo como en producción self-hosted. El archivo principal es [docker-compose.yml](../docker-compose.yml) en la raíz del repositorio.

La infraestructura completa consta de **13 contenedores**:

- 4 aplicaciones frontend
- 4 servicios de backend/workers
- 4 servicios de datos/infraestructura
- 1 reverse proxy

---

## Diagrama de Dependencias de Servicios

```
                    ┌──────────────────────────────────┐
                    │         proxy (Nginx)             │
                    │         port 80 / 443             │
                    └──┬──────┬──────────┬─────────────┘
                       │      │          │
               ┌───────▼─┐ ┌──▼────┐ ┌──▼────┐
               │   web   │ │ admin │ │ space │
               └────┬────┘ └──┬────┘ └──┬────┘
                    │         │          │
                    └─────────┴──────────┘
                                  │ depende de
                         ┌────────▼─────────┐
                         │       api        │
                         │ (Django/Gunicorn) │
                         └──────┬───────────┘
                                │ depende de
                    ┌───────────┴──────────────┐
                    │                          │
             ┌──────▼──────┐         ┌─────────▼──────────┐
             │  plane-db   │         │    plane-redis      │
             │ (PostgreSQL)│         │   (Valkey/Redis)    │
             └─────────────┘         └────────────────────┘
                                              ▲
             ┌────────────┐                   │
             │   worker   │───────────────────┤
             │  (Celery)  │                   │
             └────────────┘                   │
             ┌─────────────┐                  │
             │ beat-worker │──────────────────┘
             │(Celery Beat)│
             └─────────────┘
             ┌─────────────┐
             │  plane-mq   │◄── worker y beat-worker usan RabbitMQ
             │ (RabbitMQ)  │    como broker de mensajes
             └─────────────┘
             ┌─────────────┐
             │ plane-minio │◄── api usa MinIO para almacenar
             │   (MinIO)   │    archivos, avatares, exports
             └─────────────┘
             ┌─────────────┐
             │   live      │◄── uses plane-redis para sync
             │  (Node.js)  │    de Hocuspocus multi-instancia
             └─────────────┘
```

---

## Servicios de Infraestructura de Datos

### PostgreSQL 15.7

```yaml
plane-db:
  image: postgres:15.7-alpine
  command: postgres -c 'max_connections=1000'
  volumes:
    - pgdata:/var/lib/postgresql/data
```

**Propósito**: Base de datos relacional principal. Almacena todos los datos de la aplicación: workspaces, proyectos, issues, usuarios, páginas, notificaciones, etc.

**Configuración destacada**:

- `max_connections=1000`: Límite alto de conexiones simultáneas para soportar múltiples workers y réplicas de la API
- Volumen persistente `pgdata` en `/var/lib/postgresql/data`
- Configurado via variables de entorno: `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD`

**Uso en la aplicación**:

- Django ORM (psycopg3) para todas las operaciones CRUD
- Celery Beat almacena la schedule de tareas periódicas en PostgreSQL (`django_celery_beat`)
- Advisory locks de PostgreSQL (`pg_advisory_xact_lock`) para garantizar sequence_ids únicos por proyecto

---

### Redis / Valkey 7.2

```yaml
plane-redis:
  image: valkey/valkey:7.2.11-alpine
  volumes:
    - redisdata:/data
```

**Propósito**: Caché en memoria, almacenamiento de sesiones, y sincronización del servidor de colaboración en tiempo real.

> **Nota**: Plane usa **Valkey** (el fork open-source de Redis por parte de la Linux Foundation) en lugar de Redis Community Edition, por razones de licenciamiento.

**Usos específicos**:

| Caso de uso                           | Descripción                                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sesiones de usuario**               | Las sesiones HTTP Django se almacenan en Redis para acceso rápido                                                                                    |
| **Cache de la API**                   | Resultados de queries costosas almacenados en cache                                                                                                  |
| **Celery Result Backend**             | Tracking del estado de las tareas asíncronas                                                                                                         |
| **Hocuspocus Redis Extension**        | Sincronización del estado Yjs entre múltiples instancias del servidor `live` (pub/sub) — permite escalar el servidor de colaboración horizontalmente |
| **Almacenamiento del request origin** | La tarea `issue_activity` guarda el origen del request en Redis para las notificaciones                                                              |

---

### RabbitMQ 3.13

```yaml
plane-mq:
  image: rabbitmq:3.13.6-management-alpine
  environment:
    RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
    RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    RABBITMQ_DEFAULT_VHOST: ${RABBITMQ_VHOST}
  volumes:
    - rabbitmq_data:/var/lib/rabbitmq
```

**Propósito**: Broker de mensajes para el sistema de tareas asíncronas Celery.

**Funcionamiento**:

1. Cuando la API Django necesita ejecutar una tarea asíncrona (ej. enviar email, disparar webhook), llama `.delay()` en la tarea Celery
2. Celery publica el mensaje de la tarea en una cola de RabbitMQ
3. El `worker` consume el mensaje de la cola y ejecuta la tarea
4. El `beat-worker` publica mensajes en la cola según el schedule periódico configurado

**Por qué RabbitMQ y no Redis como broker**: RabbitMQ ofrece mejor garantía de entrega (durabilidad de mensajes, confirmaciones), routing flexible con exchanges y routing keys, y mejor manejo de colas con alta carga.

**Imagen `management-alpine`**: Incluye la interfaz web de administración de RabbitMQ accesible en el puerto 15672 (solo en red interna).

---

### MinIO

```yaml
plane-minio:
  image: minio/minio
  command: server /export --console-address ":9090"
  volumes:
    - uploads:/export
  environment:
    MINIO_ROOT_USER: ${AWS_ACCESS_KEY_ID}
    MINIO_ROOT_PASSWORD: ${AWS_SECRET_ACCESS_KEY}
```

**Propósito**: Almacenamiento de objetos S3-compatible para todos los archivos binarios de la plataforma.

**API compatible con S3**: El backend de Django usa `boto3` (el SDK de AWS) configurado para apuntar a MinIO, por lo que es transparente para el código. En producción en la nube, se puede reemplazar MinIO por AWS S3 real.

**Archivos almacenados**:

| Tipo de archivo            | Descripción                                 |
| -------------------------- | ------------------------------------------- |
| **Avatares de usuario**    | Fotos de perfil, vía `avatar_asset` FK      |
| **Logos de workspace**     | Logos de organización, vía `logo_asset` FK  |
| **Adjuntos de issues**     | Archivos adjuntados a issues y comentarios  |
| **Assets de páginas**      | Imágenes y archivos embebidos en Pages      |
| **Exports**                | Archivos CSV/Excel de exportación de issues |
| **Reportes de analíticas** | Gráficas exportadas                         |

**Puertos**:

- `9000`: API S3 (usada por la aplicación)
- `9090`: Consola web de MinIO (administración)

---

## Servicios de Aplicación

### `api` — Django API Server

```yaml
api:
  build: ./apps/api/Dockerfile.api
  command: ./bin/docker-entrypoint-api.sh
  env_file: ./apps/api/.env
  depends_on: [plane-db, plane-redis]
```

**Comando de inicio**: `gunicorn -w $GUNICORN_WORKERS -k uvicorn.workers.UvicornWorker plane.asgi:application`

- Usa **Gunicorn** como gestor de procesos con **Uvicorn** como worker class para soporte ASGI
- El número de workers se configura con `GUNICORN_WORKERS` (típicamente 2× número de CPUs)
- Expone el puerto 8000 internamente (accesible solo en la red Docker)

### `worker` — Celery Worker

```yaml
worker:
  build: ./apps/api/Dockerfile.api # Misma imagen que la API
  command: ./bin/docker-entrypoint-worker.sh
  depends_on: [api, plane-db, plane-redis]
```

**Comando**: `celery -A plane worker -l info`

Mismo código Python que el API server, pero ejecutando solo el worker de Celery. Procesa las tareas de la cola de RabbitMQ.

### `beat-worker` — Celery Beat

```yaml
beat-worker:
  build: ./apps/api/Dockerfile.api # Misma imagen
  command: ./bin/docker-entrypoint-beat.sh
  depends_on: [api, plane-db, plane-redis]
```

**Comando**: `celery -A plane beat -l info`

Ejecuta el scheduler de Celery. Lee la schedule de tareas periódicas almacenada en PostgreSQL (via `django_celery_beat`) y publica mensajes en RabbitMQ a los tiempos programados.

### `migrator` — Migraciones de Base de Datos

```yaml
migrator:
  restart: no # Solo se ejecuta una vez
  command: ./bin/docker-entrypoint-migrator.sh
  depends_on: [plane-db, plane-redis]
```

**Comportamiento**: `restart: no` — se ejecuta solo al arrancar el stack y aplica las migraciones Django pendientes. Termina cuando completa. Garantiza que el schema de la BD esté actualizado antes de que arranque la API.

### `live` — Servidor de Colaboración

```yaml
live:
  build: ./apps/live/Dockerfile.live
  restart: always
```

Servidor Node.js con Hocuspocus. Se conecta a Redis para sincronización multi-instancia y llama a la API Django via HTTP para persistencia de documentos.

### `proxy` — Reverse Proxy Nginx

```yaml
proxy:
  build: ./apps/proxy/Dockerfile.ce
  ports:
    - ${LISTEN_HTTP_PORT}:80
    - ${LISTEN_HTTPS_PORT}:443
  environment:
    FILE_SIZE_LIMIT: ${FILE_SIZE_LIMIT:-5242880} # 5MB por defecto
    BUCKET_NAME: ${AWS_S3_BUCKET_NAME:-uploads}
  depends_on: [web, api, space, admin]
```

**El único servicio con puertos expuestos hacia el exterior** (80 y 443). Nginx actúa como punto de entrada único y enruta:

| Path                  | Destino                           |
| --------------------- | --------------------------------- |
| `/`                   | `web` (app principal React)       |
| `/admin/`             | `admin` (panel de administración) |
| `/spaces/`            | `space` (deploy boards públicos)  |
| `/api/`               | `api` (Django backend)            |
| `/auth/`              | `api` (auth endpoints)            |
| `/live/`              | `live` (servidor Hocuspocus)      |
| `/uploads/` ó `/cdn/` | `plane-minio` (proxy de assets)   |

---

## Volúmenes Docker

| Volumen         | Montado en                 | Datos almacenados                             |
| --------------- | -------------------------- | --------------------------------------------- |
| `pgdata`        | `/var/lib/postgresql/data` | Datos completos de PostgreSQL                 |
| `redisdata`     | `/data`                    | Datos persistidos de Redis/Valkey             |
| `uploads`       | `/export` (MinIO)          | Todos los archivos binarios (assets, exports) |
| `rabbitmq_data` | `/var/lib/rabbitmq`        | Colas y mensajes persistidos de RabbitMQ      |

---

## Configuración de Variables de Entorno

El stack se configura via archivos `.env`. Variables clave:

| Variable                                      | Uso                                           |
| --------------------------------------------- | --------------------------------------------- |
| `SECRET_KEY`                                  | Django secret key (criptografía de sesiones)  |
| `DATABASE_URL`                                | URL de conexión a PostgreSQL                  |
| `REDIS_URL`                                   | URL de conexión a Redis                       |
| `CELERY_BROKER_URL`                           | URL de conexión a RabbitMQ (`amqp://...`)     |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Credenciales MinIO/S3                         |
| `AWS_S3_ENDPOINT_URL`                         | URL de MinIO (para self-hosted)               |
| `AWS_S3_BUCKET_NAME`                          | Nombre del bucket de archivos                 |
| `GUNICORN_WORKERS`                            | Número de workers del servidor API            |
| `LISTEN_HTTP_PORT` / `LISTEN_HTTPS_PORT`      | Puertos del proxy Nginx                       |
| `FILE_SIZE_LIMIT`                             | Límite de tamaño de uploads (por defecto 5MB) |

---

## Deploy Comunitario (Community Edition)

Para producción, existe un segundo docker-compose en `deployments/cli/community/docker-compose.yml` que usa **imágenes pre-built** en lugar de construir localmente:

```yaml
services:
  web:
    image: makeplane/plane-frontend:latest
  api:
    image: makeplane/plane-backend:latest
  # ...
```

Este es el método recomendado para usuarios finales que auto-hospedan Plane, ya que no requiere clonar el código fuente ni tener las herramientas de build instaladas.
