# 03 — Servicios y Workers

## Visión General

Plane separa el procesamiento en tres capas:

1. **`apps/live`** — Servidor Node.js para colaboración en tiempo real (WebSockets, Yjs/CRDT)
2. **`worker`** — Worker Celery para procesamiento asíncrono de tareas de background
3. **`beat-worker`** — Scheduler Celery para tareas periódicas/programadas

---

## Servicio Live — Colaboración en Tiempo Real

### Propósito

El servicio `live` provee colaboración en tiempo real para los **editores de texto enriquecido** de Plane: descripciones de issues y páginas (Pages). Permite que múltiples usuarios editen el mismo documento simultáneamente sin conflictos, usando el protocolo **CRDT (Conflict-free Replicated Data Types)**.

> **Importante**: El servicio `live` **no** maneja actualizaciones en tiempo real de listas de issues ni de cambios de estado. Esas actualizaciones ocurren vía polling o refresh del store MobX en el frontend.

### Stack Tecnológico

| Tecnología        | Versión            | Rol                                                     |
| ----------------- | ------------------ | ------------------------------------------------------- |
| Node.js           | —                  | Runtime                                                 |
| TypeScript        | —                  | Lenguaje                                                |
| Express           | —                  | Servidor HTTP base                                      |
| express-ws        | —                  | Soporte WebSocket en Express                            |
| **Hocuspocus**    | @hocuspocus/server | Servidor de colaboración basado en Yjs                  |
| **Yjs**           | —                  | Librería CRDT (Conflict-free Replicated Data Types)     |
| y-prosemirror     | —                  | Integración Yjs con el editor ProseMirror/TipTap        |
| ioredis           | —                  | Cliente Redis para sincronización multi-instancia       |
| @plane/decorators | —                  | Decoradores para registro de rutas (controller pattern) |

### Arquitectura del Servidor

El punto de entrada es [apps/live/src/server.ts](../apps/live/src/server.ts). La clase `Server` orquesta:

```
Server (Express)
├── Middleware: helmet (seguridad), compression, CORS, body parsing, logging
├── HocusPocusServerManager (singleton)
│   └── Hocuspocus instance
│       ├── onAuthenticate — verifica sesión con la API Django
│       ├── onStateless — maneja mensajes sin estado (ej. exportaciones)
│       └── Extensions (ver abajo)
└── Controllers
    ├── CollaborationController → WS /live/collaboration/
    ├── DocumentController      → HTTP /live/document/
    ├── HealthController        → HTTP /live/health/
    └── PdfExportController     → HTTP /live/pdf-export/
```

### HocusPocus y el Protocolo CRDT

**Hocuspocus** es un servidor de colaboración que implementa el protocolo `y-protocols` sobre WebSocket. El flujo es:

1. El frontend (TipTap editor via `@plane/editor`) establece una conexión WebSocket a `/live/collaboration/`
2. Hocuspocus sincroniza el documento **Yjs** entre todos los clientes conectados al mismo documento
3. Los cambios se propagan en tiempo real a todos los usuarios en la misma sesión
4. Cuando no hay cambios durante 10 segundos (`debounce: 10000`), el estado se persiste en la base de datos

### Extensiones de Hocuspocus

Las extensiones están en `apps/live/src/extensions/`:

| Extensión             | Archivo                  | Función                                                                                                       |
| --------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Database**          | `database.ts`            | Carga el documento binario Yjs desde Django API al conectar; lo guarda al hacer debounce (persistencia)       |
| **Redis**             | `redis.ts`               | Sincroniza el estado Yjs entre múltiples instancias del servidor `live` via Redis pub/sub (escala horizontal) |
| **Logger**            | `logger.ts`              | Logging de eventos de conexión/desconexión/cambios                                                            |
| **TitleSync**         | `title-sync.ts`          | Sincroniza el título del documento (Page) con la base de datos cuando cambia                                  |
| **ForceCloseHandler** | `force-close-handler.ts` | Maneja el cierre forzado de conexiones en casos de error o timeout                                            |

### Autenticación en el Live Server

Cuando un cliente se conecta via WebSocket, Hocuspocus llama a `onAuthenticate` que:

1. Extrae el token/cookie de sesión del handshake WebSocket
2. Llama a la API Django para verificar que la sesión es válida
3. Autoriza o rechaza la conexión

### Comunicación con Django

El servicio `live` se comunica con `apps/api` via HTTP:

- Al conectar: **GET** para obtener el binary del documento almacenado en BD
- Al persistir (debounce): **PUT/PATCH** para guardar el binary Yjs actualizado
- Los datos binarios se almacenan en el campo `description_binary` del modelo `Issue` y `description_binary` del modelo `Page`

### PDF Export

El controller `PdfExportController` renderiza documentos como PDF usando `@react-pdf/renderer` directamente en el servidor Node.js, sin pasar por Django.

---

## Workers Celery — Procesamiento Asíncrono

### Arquitectura

Plane usa **Celery 5.4** con dos tipos de workers:

```
RabbitMQ (Broker)
     │
     ├──► worker (celery worker)
     │    └── Consume tareas de la cola
     │        apps/api/bin/docker-entrypoint-worker.sh:
     │        celery -A plane worker -l info
     │
     └──► beat-worker (celery beat)
          └── Planificador de tareas periódicas
              apps/api/bin/docker-entrypoint-beat.sh:
              celery -A plane beat -l info
```

**Broker**: RabbitMQ 3.13 (configurado via `CELERY_BROKER_URL = amqp://...`)
**Resultado backend**: Redis (para tracking de estado de tareas)
**Scheduler**: `django_celery_beat.schedulers.DatabaseScheduler` (las tareas periódicas se almacenan en PostgreSQL)
**Serialización**: JSON

### Tareas de Background (`plane/bgtasks/`)

33 archivos de tareas organizadas por dominio:

#### Actividad e Issues

| Archivo                             | Tarea principal                  | Descripción                                                                                                                                                                                                                                          |
| ----------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `issue_activities_task.py`          | `issue_activity`                 | **La tarea más importante**. Procesa todos los eventos de cambio en issues: crea registros `IssueActivity`, genera notificaciones in-app para subscribers/assignees/mentioned users. Usa un `ACTIVITY_MAPPER` para despachar a handlers específicos. |
| `issue_version_sync.py`             | `issue_version_task`             | Crea snapshots de versión cuando un issue es modificado                                                                                                                                                                                              |
| `issue_description_version_task.py` | `issue_description_version_task` | Crea snapshots del historial de descripciones de issues                                                                                                                                                                                              |
| `issue_automation_task.py`          | `archive_and_close_old_issues`   | Archiva/cierra automáticamente issues según reglas de automatización                                                                                                                                                                                 |

#### Notificaciones y Email

| Archivo                           | Tarea principal            | Descripción                                         |
| --------------------------------- | -------------------------- | --------------------------------------------------- |
| `notification_task.py`            | `notifications`            | Crea registros `Notification` en BD para receptores |
| `email_notification_task.py`      | `stack_email_notification` | Agrupa y envía notificaciones por email en lotes    |
| `workspace_invitation_task.py`    | `workspace_invitation`     | Email de invitación a workspace                     |
| `project_invitation_task.py`      | `project_invitation`       | Email de invitación a proyecto                      |
| `forgot_password_task.py`         | `forgot_password`          | Email de recuperación de contraseña                 |
| `magic_link_code_task.py`         | `magic_link`               | Email de magic link de acceso                       |
| `user_activation_email_task.py`   | `user_activation_email`    | Email de activación de cuenta                       |
| `user_deactivation_email_task.py` | `user_deactivation_email`  | Email de desactivación de cuenta                    |
| `user_email_update_task.py`       | `user_email_update`        | Notificación de cambio de email                     |
| `project_add_user_email_task.py`  | `project_add_user_email`   | Email al agregar usuario a proyecto                 |

#### Webhooks

| Archivo           | Tarea principal  | Descripción                                                                                                             |
| ----------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `webhook_task.py` | `model_activity` | Entrega webhooks a URLs configuradas. Usa `SERIALIZER_MAPPER` para serializar el payload y firma HMAC para autenticidad |

#### Exports e Imports

| Archivo                    | Tarea principal      | Descripción                                  |
| -------------------------- | -------------------- | -------------------------------------------- |
| `export_task.py`           | `export_issues`      | Exporta issues a CSV/Excel                   |
| `exporter_expired_task.py` | `delete_old_s3_link` | Elimina links de exportación expirados de S3 |
| `analytic_plot_export.py`  | `analytic_export`    | Exporta gráficas de analíticas               |

#### Archivos y Assets

| Archivo                    | Tarea principal                | Descripción                                                  |
| -------------------------- | ------------------------------ | ------------------------------------------------------------ |
| `file_asset_task.py`       | `delete_unuploaded_file_asset` | Limpia assets de archivos no completados (uploads abortados) |
| `storage_metadata_task.py` | `update_storage_metadata`      | Actualiza metadatos de almacenamiento en S3                  |
| `copy_s3_object.py`        | `copy_s3_object`               | Copia objetos entre buckets S3                               |

#### Limpieza (Cleanup)

| Archivo            | Tarea principal                                                                                                                         | Descripción                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `deletion_task.py` | `hard_delete`                                                                                                                           | Elimina permanentemente registros en soft-delete          |
| `cleanup_task.py`  | `delete_api_logs`, `delete_email_notification_logs`, `delete_page_versions`, `delete_issue_description_versions`, `delete_webhook_logs` | Múltiples tareas de limpieza de logs y versiones antiguas |

#### Páginas

| Archivo                    | Tarea principal    | Descripción                          |
| -------------------------- | ------------------ | ------------------------------------ |
| `page_transaction_task.py` | `page_transaction` | Procesa transacciones de páginas     |
| `page_version_task.py`     | `page_version`     | Crea snapshots de versión de páginas |

#### Misceláneos

| Archivo                  | Tarea principal           | Descripción                                   |
| ------------------------ | ------------------------- | --------------------------------------------- |
| `dummy_data_task.py`     | `load_dummy_data`         | Carga datos de ejemplo para demo/testing      |
| `workspace_seed_task.py` | `seed_workspace`          | Siembra datos iniciales en un workspace nuevo |
| `work_item_link_task.py` | `process_work_item_links` | Procesa links embebidos en work items         |
| `recent_visited_task.py` | `track_recent_visit`      | Registra visitas recientes de usuarios        |
| `event_tracking_task.py` | `track_event`             | Telemetría de eventos de uso                  |
| `logger_task.py`         | `log_api_activity`        | Logging asíncrono de actividad API            |

---

## Tareas Periódicas (Celery Beat)

Configuradas en [apps/api/plane/celery.py](../apps/api/plane/celery.py) con `crontab` de Celery:

| Frecuencia   | Hora UTC | Tarea                               | Descripción                                                       |
| ------------ | -------- | ----------------------------------- | ----------------------------------------------------------------- |
| Cada 5 min   | —        | `stack_email_notification`          | Agrupa y envía notificaciones por email pendientes                |
| Cada 6 horas | :00      | `instance_traces`                   | Telemetría de instancia (solo para instancias que lo permiten)    |
| Diaria       | 00:00    | `hard_delete`                       | Elimina permanentemente registros con soft-delete                 |
| Diaria       | 01:00    | `archive_and_close_old_issues`      | Archiva/cierra issues según reglas de automatización del proyecto |
| Diaria       | 01:30    | `delete_old_s3_link`                | Elimina links de exportación expirados de S3                      |
| Diaria       | 02:00    | `delete_unuploaded_file_asset`      | Limpia assets de archivos no completados                          |
| Diaria       | 02:30    | `delete_api_logs`                   | Purga logs de actividad de API tokens                             |
| Diaria       | 02:45    | `delete_email_notification_logs`    | Purga logs de notificaciones por email                            |
| Diaria       | 03:00    | `delete_page_versions`              | Elimina versiones antiguas de páginas                             |
| Diaria       | 03:15    | `delete_issue_description_versions` | Elimina versiones antiguas de descripciones de issues             |
| Diaria       | 03:30    | `delete_webhook_logs`               | Purga logs de webhooks                                            |
| Diaria       | 03:45    | `delete_old_s3_link`                | Segunda ejecución de limpieza de exports de S3                    |

Las tareas están escalonadas (staggered) entre las 00:00 y las 04:00 UTC para distribuir la carga en el servidor de base de datos.

---

## Módulo Intake (Triage)

El módulo **Intake** no es un servicio separado. Está implementado como módulos Django dentro de `apps/api`:

- **Modelos**: `Intake`, `IntakeIssue` en `plane/db/models/intake.py`
- **API endpoints**: `plane/app/urls/intake.py` → ViewSets de intake
- **Acceso**: `/api/workspaces/{slug}/projects/{project_id}/intake/`

Intake permite capturar issues desde fuentes externas o de usuarios sin acceso al proyecto, para que el equipo los revise y convierta en issues formales.
