# 00 — Vision General

## Propósito de la Plataforma

**Plane** es una plataforma open-source de gestión de proyectos y seguimiento de trabajo (Project Management & Issue Tracking), licenciada bajo AGPL-3.0. Está diseñada como alternativa a herramientas comerciales como Jira, Linear o Shortcut, con soporte para auto-hospedaje (self-hosted).

Sus capacidades centrales incluyen:

- **Gestión de Work Items (Issues)**: creación, priorización, estados, ciclos, módulos, etiquetas, estimaciones, dependencias y relaciones entre tareas.
- **Vistas flexibles**: Board Kanban, lista, Gantt, hoja de cálculo (spreadsheet), calendario y gráficas.
- **Ciclos y Módulos**: agrupación temporal (sprints) y lógica de work items.
- **Páginas colaborativas**: editor de texto enriquecido con colaboración en tiempo real (tipo Notion).
- **Inbox / Triage**: gestión de trabajo entrante antes de que ingrese al flujo formal.
- **Deploy Boards**: tableros públicos para exponer proyectos a usuarios externos sin autenticación.
- **Analíticas y reportes**: gráficas de burndown, distribución por estado, estimaciones.
- **Integraciones**: GitHub (sincronización de repositorios), Slack, webhooks configurables.
- **API externa pública**: para integraciones de terceros (`/api/v1/`).
- **Multi-workspace y multi-proyecto**: arquitectura multi-tenant con roles granulares.

---

## Arquitectura de Alto Nivel

El proyecto es un **monorepo** gestionado con `pnpm` workspaces + **Turborepo**, que contiene tres capas principales:

```
┌─────────────────────────────────────────────────────────────────┐
│                        REVERSE PROXY (Nginx)                    │
│                   apps/proxy — port 17080/17443                 │
└──────────┬──────────────────────┬──────────────────────────────┘
           │                      │
    ┌──────▼──────┐        ┌──────▼──────┐         ┌─────────────┐
    │  apps/web   │        │ apps/admin  │         │ apps/space  │
    │ (port 17300)│        │ (port 17301)│         │ (port 17302)│
    │  App        │        │  Panel      │         │  Deploy     │
    │  principal  │        │ de instancia│         │  boards     │
    └──────┬──────┘        └──────┬──────┘         └──────┬──────┘
           │                      │                        │
           └──────────────────────┴────────────────────────┘
                                  │  HTTP REST API
                        ┌─────────▼─────────┐
                        │    apps/api       │
                        │  Django + DRF     │
                        │ (port 17000 host) │
                        └──┬──────────┬─────┘
                           │          │  Tareas Celery
               ┌───────────▼──┐   ┌───▼──────────────┐
               │  apps/live   │   │  worker /        │
               │  Node.js +   │   │  beat-worker     │
               │  Hocuspocus  │   │  (Celery)        │
               └──────────────┘   └──────────────────┘
                       │
           ┌───────────┴───────────────────────────┐
           │         SERVICIOS DE DATOS            │
           │  PostgreSQL │ Redis/Valkey │ RabbitMQ │
           │                           │ MinIO     │
           └───────────────────────────────────────┘
```

### Descripción de cada componente

| Componente         | Tecnología                           | Rol                                                        |
| ------------------ | ------------------------------------ | ---------------------------------------------------------- |
| `apps/web`         | React + React Router v7 + Vite       | App principal para usuarios finales                        |
| `apps/admin`       | React + React Router v7 + Vite       | Panel de administración de instancia (God Mode)            |
| `apps/space`       | React + React Router v7 + Vite (SSR) | Deploy Boards públicos                                     |
| `apps/api`         | Django 4.2 + DRF + Gunicorn/Uvicorn  | API REST central (toda la lógica de negocio)               |
| `apps/live`        | Node.js + Express + Hocuspocus (Yjs) | Colaboración en tiempo real en el editor de texto          |
| `worker`           | Celery 5 (misma imagen que `api`)    | Procesamiento asíncrono de tareas en background            |
| `beat-worker`      | Celery Beat (misma imagen que `api`) | Planificador de tareas periódicas                          |
| `apps/proxy`       | Nginx                                | Reverse proxy, enrutamiento, límites de tamaño de archivos |
| `PostgreSQL 15.7`  | postgres:15.7-alpine                 | Base de datos relacional principal                         |
| `Redis/Valkey 7.2` | valkey/valkey:7.2.11-alpine          | Cache, sesiones, sincronización del live server            |
| `RabbitMQ 3.13`    | rabbitmq:3.13.6-management           | Broker de mensajes para Celery                             |
| `MinIO`            | minio/minio                          | Almacenamiento de objetos S3-compatible (assets, exports)  |

---

## Stack Tecnológico Principal

### Frontend

| Categoría           | Tecnología                        | Versión |
| ------------------- | --------------------------------- | ------- |
| Framework UI        | React                             | 18.3.1  |
| Routing / Framework | React Router                      | 7.12.0  |
| Bundler             | Vite                              | 7.3.2   |
| Estado global       | MobX                              | 6.12.0  |
| Data fetching       | SWR                               | 2.2.4   |
| HTTP client         | Axios                             | 1.15.0  |
| Estilos             | Tailwind CSS                      | —       |
| Editor de texto     | TipTap (ProseMirror)              | —       |
| Colaboracion (CRDT) | Yjs + Hocuspocus client           | —       |
| Formularios         | React Hook Form                   | —       |
| Drag & Drop         | @atlaskit/pragmatic-drag-and-drop | —       |
| Tablas              | @tanstack/react-table             | —       |
| Lenguaje            | TypeScript                        | —       |

### Backend

| Categoría              | Tecnología                                      | Versión         |
| ---------------------- | ----------------------------------------------- | --------------- |
| Framework Web          | Django                                          | 4.2.30          |
| API REST               | Django REST Framework (DRF)                     | 3.15.2          |
| Servidor ASGI/WSGI     | Gunicorn + Uvicorn workers                      | 23.0.0 / 0.29.0 |
| Tareas asíncronas      | Celery                                          | 5.4.0           |
| ORM                    | Django ORM + psycopg3                           | —               |
| Base de datos          | PostgreSQL                                      | 15.7            |
| Cache / Sesiones       | Redis (Valkey)                                  | 7.2.11          |
| Broker de mensajes     | RabbitMQ                                        | 3.13.6          |
| Almacenamiento objetos | MinIO / S3 via boto3                            | —               |
| Autenticación          | Session + OAuth (Google, GitHub, GitLab, Gitea) | —               |
| IA                     | OpenAI SDK                                      | 1.63.2          |
| Documentación API      | drf-spectacular (OpenAPI)                       | 0.28.0          |
| Lenguaje               | Python                                          | 3.x             |

### Servidor Real-time (Live)

| Categoría            | Tecnología        |
| -------------------- | ----------------- |
| Runtime              | Node.js           |
| Framework HTTP       | Express           |
| WebSockets           | express-ws        |
| Colaboración CRDT    | Hocuspocus (Yjs)  |
| Sync multi-instancia | Redis via ioredis |
| Lenguaje             | TypeScript        |

---

## Monorepo: Herramientas y Paquetes Compartidos

### Tooling del Monorepo

| Herramienta         | Versión | Propósito                         |
| ------------------- | ------- | --------------------------------- |
| pnpm                | 10.32.1 | Gestor de paquetes con workspaces |
| Turborepo           | 2.9.4   | Orquestador de builds y tareas    |
| oxlint              | 1.51.0  | Linting (reemplaza ESLint)        |
| oxfmt               | 0.35.0  | Formateo de código                |
| husky + lint-staged | —       | Hooks de pre-commit               |

El archivo `pnpm-workspace.yaml` declara `apps/*` y `packages/*` como workspaces. Las apps `apps/api` y `apps/proxy` están **excluidas** del workspace JS (son Python/Nginx).

### Paquetes Internos (`/packages/`)

| Paquete                    | Propósito                                                                |
| -------------------------- | ------------------------------------------------------------------------ |
| `@plane/types`             | Definiciones TypeScript compartidas entre todas las apps                 |
| `@plane/constants`         | Constantes compartidas                                                   |
| `@plane/services`          | Capa de servicios API compartida (Axios, organizada por dominio)         |
| `@plane/ui`                | Librería de componentes UI legacy (Headless UI, Blueprint, Radix)        |
| `@plane/propel`            | Nuevo design system (40+ componentes, base-ui-components, framer-motion) |
| `@plane/editor`            | Editor de texto enriquecido (TipTap + Yjs + Hocuspocus client)           |
| `@plane/hooks`             | Hooks React compartidos                                                  |
| `@plane/shared-state`      | Stores MobX compartidos entre apps (ej. WorkItemFilterStore)             |
| `@plane/utils`             | Funciones utilitarias compartidas                                        |
| `@plane/i18n`              | Internacionalización                                                     |
| `@plane/logger`            | Utilidades de logging                                                    |
| `@plane/decorators`        | Decoradores TypeScript (usado por el live server)                        |
| `@plane/tailwind-config`   | Configuración Tailwind CSS compartida                                    |
| `@plane/typescript-config` | Presets tsconfig compartidos                                             |
