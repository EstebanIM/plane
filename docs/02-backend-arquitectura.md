# 02 — Arquitectura Backend

## Framework y Tecnología

El backend de Plane está construido con:

- **Django 4.2.30** — Framework web Python
- **Django REST Framework (DRF) 3.15.2** — Construcción de APIs REST
- **Gunicorn 23.0.0** + **Uvicorn 0.29.0** — Servidor ASGI/WSGI para producción
- **PostgreSQL 15.7** — Base de datos principal
- **Celery 5.4.0** + **RabbitMQ** — Procesamiento asíncrono
- **psycopg3** — Driver PostgreSQL moderno

El punto de entrada del proyecto es `apps/api/manage.py`, y la aplicación se ejecuta via ASGI (`plane.asgi:application`) con workers uvicorn embebidos en Gunicorn.

---

## Configuración (Split-Settings)

La configuración está dividida en múltiples archivos en `apps/api/plane/settings/`:

| Archivo         | Propósito                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `common.py`     | Configuración compartida: INSTALLED_APPS, middleware, DRF, base de datos, Redis, Celery, S3/MinIO, CORS, cookies |
| `production.py` | Overrides de producción: scout_apm, logging JSON, rotación de logs                                               |
| `local.py`      | Configuración para desarrollo local                                                                              |
| `redis.py`      | Fábrica de conexión Redis                                                                                        |
| `storage.py`    | Backend de almacenamiento S3 (boto3)                                                                             |
| `mongo.py`      | Configuración MongoDB (usado por analíticas)                                                                     |
| `openapi.py`    | Configuración drf-spectacular para OpenAPI/Swagger                                                               |
| `test.py`       | Configuración para tests                                                                                         |

El worker de Celery y el servidor Django usan `plane.settings.production` por defecto.

---

## Aplicaciones Django (INSTALLED_APPS)

El proyecto contiene **11 aplicaciones Django internas**, cada una con una responsabilidad clara:

### Aplicaciones de Dominio

| App                  | Módulo Python          | Responsabilidad                                                                                                                               |
| -------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Database Models**  | `plane.db`             | **Modelos de datos** — todos los modelos ORM del sistema (35 archivos de modelos). Es la fuente única de verdad del esquema de base de datos. |
| **App Principal**    | `plane.app`            | **API interna** — ViewSets, serializers y URLs para las operaciones internas de la plataforma. 20 módulos de URLs.                            |
| **API Externa v1**   | `plane.api`            | **API pública** — endpoints para integraciones de terceros (`/api/v1/`). 15 módulos de URLs con autenticación por API token.                  |
| **Space**            | `plane.space`          | **Endpoints públicos** — sirve los Deploy Boards accesibles sin autenticación (`/api/public/`).                                               |
| **Authentication**   | `plane.authentication` | **Autenticación y sesiones** — login, signup, OAuth (Google, GitHub, GitLab, Gitea), magic link, gestión de contraseñas.                      |
| **Background Tasks** | `plane.bgtasks`        | **Tareas Celery** — 33 archivos de tareas asíncronas (notificaciones, webhooks, emails, limpieza, exports).                                   |
| **Analytics**        | `plane.analytics`      | **Analíticas** — endpoints y lógica para gráficas de burndown, distribución de issues, reportes.                                              |
| **License**          | `plane.license`        | **Administración de instancia** — configuración del servidor, telemetría, endpoints `/api/instances/`.                                        |

### Aplicaciones de Soporte

| App            | Módulo Python      | Responsabilidad                                                                                        |
| -------------- | ------------------ | ------------------------------------------------------------------------------------------------------ |
| **Utils**      | `plane.utils`      | Funciones utilitarias compartidas (paginación, procesamiento HTML, manejo de excepciones, UUID, URLs). |
| **Middleware** | `plane.middleware` | Middlewares custom: límite de tamaño de request body, logging de API tokens, logging de requests.      |
| **Web**        | `plane.web`        | Catch-all que sirve el frontend (ruta raíz `""`).                                                      |

---

## Enrutamiento de URLs

El archivo [apps/api/plane/urls.py](../apps/api/plane/urls.py) registra todas las rutas:

```python
urlpatterns = [
    path("api/",          include("plane.app.urls")),      # API interna
    path("api/public/",   include("plane.space.urls")),    # Deploy boards públicos
    path("api/instances/",include("plane.license.urls")), # Administración de instancia
    path("api/v1/",       include("plane.api.urls")),      # API externa pública
    path("auth/",         include("plane.authentication.urls")),  # Autenticación
    path("",              include("plane.web.urls")),      # Frontend (catch-all)
]
```

### Módulos de URL de la API interna (`plane.app.urls`)

La API interna está organizada en 20 módulos, uno por dominio:

`analytic`, `api`, `asset`, `cycle`, `estimate`, `external`, `intake`, `issue`, `module`, `notification`, `page`, `project`, `search`, `state`, `user`, `views`, `webhook`, `workspace`, `timezone`, `exporter`

### Módulos de URL de la API externa v1 (`plane.api.urls`)

15 módulos para integración de terceros:

`asset`, `cycle`, `estimate`, `intake`, `invite`, `label`, `member`, `module`, `project`, `schema`, `state`, `sticky`, `user`, `work_item`

---

## Arquitectura de Vistas (ViewSets y Views)

El archivo [apps/api/plane/app/views/base.py](../apps/api/plane/app/views/base.py) define las dos clases base:

### `BaseViewSet`

Extiende `ModelViewSet` + `BasePaginator` + `TimezoneMixin` + `ReadReplicaControlMixin`:

```python
class BaseViewSet(TimezoneMixin, ReadReplicaControlMixin, ModelViewSet, BasePaginator):
    model = None
    permission_classes = [IsAuthenticated]
    filter_backends = (DjangoFilterBackend, SearchFilter)
    authentication_classes = [BaseSessionAuthentication]
    use_read_replica = False
```

Características:

- **Autenticación**: Session-based (`BaseSessionAuthentication`)
- **Permisos**: `IsAuthenticated` por defecto; endpoints individuales usan `@allow_permission`
- **Filtrado**: DjangoFilterBackend + SearchFilter
- **Paginación**: `BasePaginator` con soporte de cursor
- **Timezone**: Activa el timezone del usuario en cada request
- **Read Replica**: Soporte opcional para DB de solo lectura

### `BaseAPIView`

Para endpoints personalizados que no mapean directamente a un modelo. Extiende `APIView` + `BasePaginator`.

### Mapeo de acciones (patrón estándar)

```python
# En los archivos urls.py
path(
    "workspaces/<str:slug>/projects/<uuid:project_id>/issues/",
    IssueViewSet.as_view({"get": "list", "post": "create"}),
),
path(
    "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:pk>/",
    IssueViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}),
),
```

---

## Sistema de Permisos

El sistema de permisos usa un **decorator** custom `@allow_permission`:

```python
# Definición de roles
class ROLE(IntEnum):
    ADMIN  = 20
    MEMBER = 15
    GUEST  = 5

# Uso en ViewSets
@allow_permission([ROLE.ADMIN, ROLE.MEMBER])
def create(self, request, slug, project_id):
    # Solo admins y members pueden crear issues
    ...

@allow_permission([ROLE.ADMIN])
def destroy(self, request, slug, project_id, pk):
    # Solo admins pueden eliminar
    ...
```

El decorator verifica el rol del usuario contra `WorkspaceMember` y/o `ProjectMember` según el contexto del endpoint.

---

## Modelos de Datos

Todos los modelos residen en `apps/api/plane/db/models/` (35 archivos).

### Jerarquía de Modelos Base

```
AuditModel
└── BaseModel (UUID pk, created_by, updated_by via crum)
    ├── WorkspaceBaseModel (abstract: + workspace FK)
    │   └── Label
    ├── ProjectBaseModel (abstract: + project + workspace FK, auto-linkea workspace)
    │   ├── Issue, State, Module, Cycle
    │   ├── IssueAssignee, IssueLabel, IssueComment, IssueActivity
    │   ├── Estimate, EstimatePoint
    │   └── ...
    ├── Workspace
    ├── Project
    ├── Page
    └── Notification
```

**`BaseModel`** provee:

- `id`: UUID v4 (primary key)
- `created_at`, `updated_at`: timestamps automáticos
- `created_by`, `updated_by`: FK al `User` que realizó la acción (via middleware `crum`)

### Modelos Principales

#### `Workspace` (`workspace.py`)

```
Workspace
├── name, slug (unique)
├── owner → User
├── organization_size, timezone
├── logo_asset → FileAsset
└── WorkspaceMember (role: Admin=20, Member=15, Guest=5)
    WorkspaceMemberInvite
    WorkspaceTheme
    WorkspaceUserProperties
```

#### `Project` (`project.py`)

```
Project (extends ProjectBaseModel)
├── name, identifier (e.g. "PROJ")
├── workspace → Workspace
├── default_assignee → User
├── project_lead → User
├── network (Secret | Public)
├── Feature toggles:
│   ├── module_view, cycle_view, page_view
│   ├── intake_view, is_time_tracking_enabled
│   └── is_issue_type_enabled
├── estimate → Estimate
└── ProjectMember (role: Admin=20, Member=15, Guest=5)
    ProjectMemberInvite
    ProjectIdentifier
    ProjectUserProperty
```

#### `Issue` (`issue.py`) — El modelo más complejo

```
Issue (extends ProjectBaseModel + SoftDeletionMixin)
├── name (título)
├── description_html     # Contenido HTML
├── description_json     # Contenido en formato TipTap JSON
├── description_binary   # Yjs binary para colaboración
├── description_stripped # Texto plano (para búsquedas)
├── priority (urgent | high | medium | low | none)
├── state → State
├── parent → Issue (self-FK, para sub-issues)
├── type → IssueType
├── estimate_point → EstimatePoint
├── assignees (M2M via IssueAssignee)
├── labels (M2M via IssueLabel)
├── start_date, target_date (fechas)
├── sequence_id (número visible: PROJ-1, PROJ-2...)
├── sort_order (para ordenación drag-and-drop)
├── completed_at (timestamp auto al cambiar a estado "completed")
├── archived_at (soft-archive)
├── is_draft (borrador de workspace)
└── deleted_at (soft-delete via SoftDeletionManager)

Modelos relacionados:
├── IssueAssignee     — M2M con User
├── IssueLabel        — M2M con Label
├── IssueComment      — Comentarios con descripción (TipTap)
├── IssueActivity     — Log de cambios (auditoría)
├── IssueRelation     — Relaciones: duplicate | relates_to | blocked_by | start_before | finish_before | implemented_by
├── IssueLink         — URLs relacionadas
├── IssueMention      — Menciones de usuarios
├── IssueSubscriber   — Suscriptores a notificaciones
├── IssueReaction     — Reacciones emoji en el issue
├── CommentReaction   — Reacciones en comentarios
├── IssueVote         — Votos
├── IssueSequence     — Control de sequence_id por proyecto
├── IssueVersion      — Historial de versiones del issue
└── IssueDescriptionVersion — Historial de la descripción
```

**Manager custom**: `IssueManager` (accesible via `Issue.issue_objects`) excluye automáticamente issues de triage, archivados, de proyectos archivados e issues draft.

#### `State` (`state.py`)

```
State (extends ProjectBaseModel)
├── name, color
├── group: StateGroup enum
│   ├── BACKLOG    — Backlog
│   ├── UNSTARTED  — Por hacer (To Do)
│   ├── STARTED    — En progreso
│   ├── COMPLETED  — Completado
│   ├── CANCELLED  — Cancelado
│   └── TRIAGE     — Para intake/triage
├── sequence (orden)
├── is_triage (flag)
└── default (estado por defecto del proyecto)
```

Estados por defecto al crear un proyecto: `Backlog`, `Todo`, `In Progress`, `Done`, `Cancelled`, `Triage`.

#### `Module` (`module.py`)

```
Module (extends ProjectBaseModel)
├── name, description
├── start_date, target_date
├── status (backlog | planned | in-progress | paused | completed | cancelled)
├── lead → User
├── members (M2M via ModuleMember)
└── ModuleIssue — M2M bridge con Issue
```

#### `Cycle` (`cycle.py`)

```
Cycle (extends ProjectBaseModel)
├── name, description
├── start_date, end_date
├── owned_by → User
├── progress_snapshot (JSONField)
└── CycleIssue — M2M bridge con Issue
```

#### `Page` (`page.py`)

```
Page (extends BaseModel)
├── workspace → Workspace
├── name
├── description_html/json/binary/stripped
├── owned_by → User
├── access (public | private)
├── parent → Page (self-FK para jerarquía)
├── is_locked, is_global
├── labels (M2M via PageLabel)
└── projects (M2M via ProjectPage)
```

#### Otros modelos importantes

| Modelo            | Archivo           | Descripción                                                                                        |
| ----------------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| `User`            | `user.py`         | Extiende `AbstractBaseUser`. Campos: email, username, display_name, avatar, avatar_asset, timezone |
| `Label`           | `label.py`        | Etiquetas. `parent` self-FK para jerarquía. Pueden ser de workspace o de proyecto                  |
| `Webhook`         | `webhook.py`      | Webhooks por workspace con toggles por evento (project, issue, module, cycle, comments)            |
| `Intake`          | `intake.py`       | Gestión de issues entrantes (triage). `IntakeIssue` conecta intake con Issue                       |
| `FileAsset`       | `asset.py`        | Archivos almacenados en MinIO/S3                                                                   |
| `Notification`    | `notification.py` | Notificaciones in-app. Campos: receiver, data JSON, read_at, snoozed_till                          |
| `APIToken`        | `api.py`          | Tokens para la API externa v1                                                                      |
| `DeployBoard`     | `deploy_board.py` | Configuración de tableros públicos                                                                 |
| `ExporterHistory` | `exporter.py`     | Historial de exports (CSV, etc.)                                                                   |

---

## Sistema de Autenticación

Configurado en `plane.authentication`:

| Método               | Descripción                                                   |
| -------------------- | ------------------------------------------------------------- |
| **Email + Password** | Registro y login tradicional                                  |
| **Magic Link**       | Login sin contraseña via email                                |
| **OAuth — Google**   | Autenticación con cuenta Google                               |
| **OAuth — GitHub**   | Autenticación con cuenta GitHub                               |
| **OAuth — GitLab**   | Autenticación con cuenta GitLab                               |
| **OAuth — Gitea**    | Autenticación con instancia Gitea auto-hospedada              |
| **API Token**        | Para la API externa (`/api/v1/`). Tokens en modelo `APIToken` |

La autenticación es **session-based** (cookies, `withCredentials: true` en el frontend). El middleware `SessionMiddleware` de `plane.authentication` reemplaza al de Django estándar.

---

## Throttling y Seguridad

```python
REST_FRAMEWORK = {
    "DEFAULT_THROTTLE_CLASSES": ("rest_framework.throttling.AnonRateThrottle",),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "30/minute",    # 30 requests/minuto para usuarios anónimos
        "asset_id": "5/minute", # 5 requests/minuto para upload de assets
    },
}
```

**Middlewares de seguridad activos**:

- `CorsMiddleware` — CORS configurado vía `CORS_ALLOW_CREDENTIALS = True`
- `SecurityMiddleware` — Headers de seguridad Django
- `WhiteNoiseMiddleware` — Servicio de archivos estáticos
- `GZipMiddleware` — Compresión de respuestas
- `RequestBodySizeLimitMiddleware` — Limita el tamaño de los requests
- `APITokenLogMiddleware` — Registra uso de API tokens
- `RequestLoggerMiddleware` — Logging de todos los requests
