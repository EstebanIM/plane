# 01 — Arquitectura Frontend

## Framework Principal

Las tres apps frontend (`web`, `admin`, `space`) utilizan el mismo stack base:

- **React Router v7** (framework mode) como framework de aplicación
- **Vite 7.3.2** como bundler
- **React 18.3.1** como librería UI
- **TypeScript** como lenguaje

> **Migración desde Next.js**: El proyecto fue originalmente construido con Next.js. La migración a React Router v7 es reciente. En `apps/web` quedan shims de compatibilidad que mapean `next/link`, `next/navigation` y `next/script` a implementaciones locales (ver `vite.config.ts` en `apps/web`).

---

## Las Tres Apps Frontend

### `apps/web` — App Principal (port 3000)

La aplicación principal usada por los usuarios finales de Plane.

- **SSR**: Deshabilitado (SPA puro, client-side rendering)
- **Entry point**: `apps/web/app/root.tsx`
- **Rutas**: Definidas en `apps/web/app/routes/` (divididas en `core.ts` y `extended.ts`)
- **Estado**: ~28 sub-stores MobX
- **Dependencias clave**: Todas las librerías del stack completo (recharts, tanstack-table, atlaskit DnD, react-pdf, etc.)

### `apps/space` — Deploy Boards Públicos (port 3002)

Vistas públicas que permiten acceder a tableros sin autenticación.

- **SSR**: Habilitado (`ssr: true` en `react-router.config.ts`), servido por `react-router-serve`
- **Store**: `RootStore` simplificado con 11 sub-stores
- **Dependencias**: Subconjunto del stack (sin recharts, sin tanstack-table, sin PDF)
- **Soporte de hidratación**: Método `hydrate()` en el store para SSR

### `apps/admin` — Panel de Administración de Instancia (port 3001)

Interfaz para configurar la instancia de Plane (God Mode): autenticación, correo, integraciones.

- **SSR**: Deshabilitado (SPA)
- **Store**: `RootStore` mínimo con 4 sub-stores (Theme, Instance, User, Workspace)
- **Dependencias**: Sin `@plane/editor` ni `@plane/i18n`; incluye `@tanstack/react-virtual` para listas

---

## Estructura de Directorios: `apps/web`

Esta es la app más grande y sirve como referencia para entender los patrones del proyecto.

```
apps/web/
├── app/                        # Entry points React Router
│   ├── root.tsx                # Raíz de la aplicación (providers, theme, etc.)
│   ├── routes.ts               # Registro de rutas (core.ts + extended.ts)
│   ├── entry.client.tsx        # Hidratación client-side
│   ├── (all)/                  # Grupo de rutas con layout general
│   └── (home)/                 # Grupo de rutas para la home
│
├── core/                       # Código fuente principal
│   ├── components/             # Componentes React organizados por dominio
│   │   ├── issues/             # Formularios, modales, vistas de work items
│   │   ├── cycles/             # Componentes de ciclos/sprints
│   │   ├── modules/            # Componentes de módulos
│   │   ├── pages/              # Editor de páginas colaborativas
│   │   ├── inbox/              # Inbox / triage de issues
│   │   ├── gantt-chart/        # Vista Gantt
│   │   ├── analytics/          # Gráficas y reportes
│   │   ├── dropdowns/          # Selectores reutilizables (estado, prioridad, etc.)
│   │   ├── editor/             # Componentes de edición de texto
│   │   ├── navigation/         # Sidebar y navegación
│   │   ├── home/               # Dashboard de inicio
│   │   ├── estimates/          # Sistema de estimaciones
│   │   └── ...                 # 20+ directorios adicionales
│   │
│   ├── hooks/                  # Hooks personalizados
│   │   ├── context/            # Hooks de contexto React
│   │   ├── editor/             # Hooks para el editor de texto
│   │   ├── oauth/              # Hooks de OAuth
│   │   ├── store/              # Hooks de acceso a stores MobX
│   │   └── *.ts                # Hooks standalone por dominio
│   │
│   ├── store/                  # Estado global MobX
│   │   ├── root.store.ts       # Hub central: CoreRootStore
│   │   ├── issue/              # Stores de work items (el más complejo)
│   │   │   ├── root.store.ts   # IssueRootStore
│   │   │   ├── helpers/        # BaseIssuesStore (lógica compartida)
│   │   │   ├── project/        # ProjectIssues
│   │   │   ├── cycle/          # CycleIssues
│   │   │   ├── module/         # ModuleIssues
│   │   │   └── ...
│   │   ├── project/            # ProjectRootStore
│   │   ├── workspace/          # WorkspaceRootStore
│   │   ├── member/             # MemberRootStore
│   │   ├── pages/              # ProjectPageStore
│   │   ├── notifications/      # WorkspaceNotificationStore
│   │   └── ...                 # Un store por dominio
│   │
│   ├── services/               # Capa de servicios API
│   │   ├── api.service.ts      # Clase abstracta base (Axios)
│   │   ├── issue/              # IssueService (CRUD work items)
│   │   ├── cycle.service.ts    # CycleService
│   │   ├── module.service.ts   # ModuleService
│   │   ├── project/            # ProjectService
│   │   ├── workspace/          # WorkspaceService
│   │   ├── page.service.ts     # PageService
│   │   ├── ai.service.ts       # Integración con IA
│   │   ├── analytics/          # AnalyticsService
│   │   └── ...                 # 55+ archivos de servicios
│   │
│   ├── layouts/                # Layouts de la aplicación
│   │   ├── auth-layout/        # Layout con verificación de auth
│   │   └── default-layout/     # Layout base con sidebar
│   │
│   ├── lib/                    # Código de librería (configs, providers)
│   ├── constants/              # Constantes específicas de la app
│   └── types/                  # Tipos TypeScript específicos de la app
│
├── ce/                         # Overrides Community Edition
│   ├── components/             # Versiones CE de componentes
│   ├── hooks/                  # Hooks adicionales CE
│   ├── store/                  # Stores adicionales CE
│   └── types/                  # Tipos adicionales CE
│
├── helpers/                    # Funciones utilitarias
│   ├── authentication.helper.ts
│   ├── emoji.helper.ts
│   ├── dashboard.helper.ts
│   └── cover-image.helper.ts
│
└── styles/                     # CSS y estilos Tailwind
```

---

## Estado Global (MobX)

Plane utiliza **MobX 6** con un patrón de **RootStore centralizado**. Todas las apps siguen el mismo patrón.

### Patrón CoreRootStore

El archivo [apps/web/core/store/root.store.ts](../apps/web/core/store/root.store.ts) define `CoreRootStore`, que instancia y conecta todos los sub-stores:

```typescript
export class CoreRootStore {
  // Navegación
  router: IRouterStore;
  theme: IThemeStore;

  // Dominio de usuario y workspace
  user: IUserStore;
  workspaceRoot: IWorkspaceRootStore;
  projectRoot: IProjectRootStore;
  memberRoot: IMemberRootStore;

  // Work Items (el más complejo — IssueRootStore contiene ~10 sub-stores)
  issue: IIssueRootStore;

  // Organización del trabajo
  cycle: ICycleStore;
  module: IModuleStore;
  state: IStateStore;
  label: ILabelStore;

  // Vistas y filtros
  globalView: IGlobalViewStore;
  projectView: IProjectViewStore;
  workItemFilter: IWorkItemFilterStore;
  cycleFilter: ICycleFilterStore;
  moduleFilter: IModuleFilterStore;

  // Features adicionales
  page: IProjectPageStore;
  dashboard: IDashboardStore;
  analytics: IAnalyticsStore;
  inbox: IProjectInboxStore;
  notification: IWorkspaceNotificationStore;
  favorite: IFavoriteStore;
  sticky: IStickyStore;
  instance: IInstanceStore;
  editorAsset: IEditorAssetStore;
  estimate: IProjectEstimateStore;
  commandPalette: ICommandPaletteStore;
  multipleSelect: IMultipleSelectStore;
  powerK: IPowerKStore;

  // ...
}
```

Cada sub-store recibe una referencia al root store para acceso cruzado. El método `resetOnSignOut()` recrea todos los stores al cerrar sesión.

### IssueRootStore (el store más complejo)

`apps/web/core/store/issue/root.store.ts` agrega todos los stores relacionados con work items:

```
IssueRootStore
├── IssueStore          — Map central de issue_id → datos del issue
├── ProjectIssues       — Issues en contexto de proyecto
├── CycleIssues         — Issues en contexto de ciclo
├── ModuleIssues        — Issues en contexto de módulo
├── ArchivedIssues      — Issues archivados
├── ProfileIssues       — Issues asignados al usuario actual
├── WorkspaceDraftIssues— Borradores de workspace
├── IssueDetail         — Detalle de un issue (comments, reactions, links, relations)
├── IssueFilterStores   — Filtros por contexto (project, cycle, module...)
└── stateMap / labelMap / memberMap / projectMap — Referencias cruzadas
```

Todos los sub-stores de issues extienden `BaseIssuesStore` (en `core/store/issue/helpers/`), que implementa la lógica CRUD compartida: `createIssue`, `updateIssue`, `deleteIssue`, `addIssue`, `fetchParentStats`.

---

## Llamadas a la API: Patrón Service Layer

### Clase Base: `APIService`

El archivo [apps/web/core/services/api.service.ts](../apps/web/core/services/api.service.ts) define la clase abstracta que envuelve Axios:

```typescript
export abstract class APIService {
  protected baseURL: string;
  private axiosInstance: AxiosInstance;

  constructor(baseURL: string) {
    this.axiosInstance = axios.create({
      baseURL,
      withCredentials: true, // Envía cookies de sesión automáticamente
    });

    // Interceptor: redirige a login en 401
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          window.location.replace(`/?next_path=${currentPath}`);
        }
        return Promise.reject(error);
      }
    );
  }

  // Métodos: get, post, put, patch, delete, request
}
```

### Servicios por Dominio

Cada dominio tiene su propio servicio que extiende `APIService`:

```typescript
// Ejemplo: IssueService
class IssueService extends APIService {
  async createIssue(workspaceSlug, projectId, data) {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/`, data)
      .then(res => res?.data);
  }

  async getIssues(workspaceSlug, projectId, queries) { ... }
  async updateIssue(workspaceSlug, projectId, issueId, data) { ... }
  async deleteIssue(workspaceSlug, projectId, issueId) { ... }
  // ... 20+ métodos
}
```

### Integración Store → Servicio

Los stores MobX instancian los servicios e invocan sus métodos. El patrón estándar en `BaseIssuesStore`:

```typescript
class BaseIssuesStore {
  issueService = new IssueService();

  async createIssue(workspaceSlug, projectId, data) {
    // 1. Llamada API (no optimista en creación)
    const response = await this.issueService.createIssue(workspaceSlug, projectId, data);
    // 2. Actualizar el store MobX con el nuevo issue
    this.addIssue(response, shouldUpdateList);
    // 3. Actualizar estadísticas del padre (si aplica)
    this.fetchParentStats(workspaceSlug, projectId);
    return response;
  }

  async updateIssue(workspaceSlug, projectId, issueId, data) {
    // Actualización OPTIMISTA: actualiza el store primero, luego la API
    this.updateIssueInStore(issueId, data);
    try {
      await this.issueService.updateIssue(workspaceSlug, projectId, issueId, data);
    } catch {
      // Revertir en caso de error
      this.revertIssueInStore(issueId, previousData);
    }
  }
}
```

> **Nota sobre actualizaciones**: La **creación** de issues es no-optimista (espera respuesta del servidor). Las **actualizaciones** son optimistas (actualiza el store inmediatamente para mejor UX).

### SWR para Caching

Además del patrón de store, el proyecto utiliza **SWR** en hooks específicos para caching y revalidación automática en el cliente:

```typescript
// Ejemplo de hook con SWR
const { data: issues } = useSWR(`WORKSPACE_ISSUES_${workspaceSlug}`, () =>
  issueService.getWorkspaceIssues(workspaceSlug)
);
```

---

## Librerías de Componentes UI

### `@plane/ui` (Legacy)

Librería original, construida sobre Headless UI, Blueprint y Radix UI. Incluye componentes básicos como botones, inputs, modales, spinners, tooltips.

### `@plane/propel` (Nuevo Design System)

Librería de componentes moderna con 40+ componentes, exportados individualmente para tree-shaking:

- **Base**: Button, Badge, Avatar, Input, Textarea, Select
- **Datos**: Table, Calendar, Charts (recharts), Combobox, Command
- **Overlay**: Dialog, Popover, Tooltip, Toast
- **Contenido**: Accordion, Tabs, EmojiPicker, ColorSwatch

Construida sobre `@base-ui-components/react`, `class-variance-authority` (variantes CSS), y `framer-motion` (animaciones).

---

## Editor de Texto (`@plane/editor`)

El paquete `@plane/editor` es una capa sobre **TipTap** (que a su vez usa ProseMirror):

- Soporta colaboración en tiempo real vía **Yjs** + cliente de **Hocuspocus**
- Extensiones custom: menciones de usuarios/issues, listas de tareas, emojis, imágenes con upload a MinIO, tablas
- Usado tanto en issues (descripción) como en páginas (Pages)
- El editor se conecta al servidor `apps/live` para la colaboración multi-usuario
