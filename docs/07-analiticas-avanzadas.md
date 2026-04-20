# 07 — Feature: Analíticas Avanzadas de Proyectos y Elementos de Trabajo

## Resumen Ejecutivo

Este documento describe el feature de **Analíticas Avanzadas**, cuyo objetivo es extender significativamente las capacidades de visualización de datos en Plane, proporcionando gráficos más detallados y granulares sobre el estado, progreso y métricas de eficiencia de los proyectos y elementos de trabajo (work items).

**Motivación**: La sección actual de "Análisis" ofrece una visión general del workspace con métricas básicas (KPIs, Created vs Resolved, gráfico personalizable). Sin embargo, carece de:

- Visualizaciones a nivel de proyecto individual
- Métricas de eficiencia (velocity, lead time, cycle time)
- Diversidad de tipos de gráficos (solo usa 3 de los 7 disponibles)
- Gráficos de analíticas en la Home ("Tu trabajo")

---

## Estado Actual del Sistema de Analíticas

### Arquitectura del Módulo de Analytics

```
┌────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (apps/web)                          │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  core/components/analytics/                                     │  │
│  │  ├── overview/           → Tab Overview (RadarChart, KPIs)      │  │
│  │  ├── work-items/         → Tab Work Items (AreaChart, BarChart) │  │
│  │  ├── insight-table/      → DataTable con @tanstack/react-table  │  │
│  │  ├── select/             → Selectores de filtros (X, Y, etc.)   │  │
│  │  └── total-insights.tsx  → Tarjetas KPI numéricas               │  │
│  └──────────────────────────────┬──────────────────────────────────┘  │
│                                 │                                     │
│  ┌──────────────────────────────┼──────────────────────────────────┐  │
│  │  core/store/analytics.store  │  core/services/analytics.service │  │
│  │  (BaseAnalyticsStore - MobX) │  (AnalyticsService - Axios)      │  │
│  └──────────────────────────────┴──────────────────────────────────┘  │
│                                 │                                     │
│  ┌──────────────────────────────┴──────────────────────────────────┐  │
│  │  packages/propel/src/charts/              (Design System)       │  │
│  │  ├── area-chart/   ✅ En uso                                    │  │
│  │  ├── bar-chart/    ✅ En uso                                    │  │
│  │  ├── radar-chart/  ✅ En uso                                    │  │
│  │  ├── pie-chart/    ⬜ Disponible                                │  │
│  │  ├── line-chart/   ⬜ Disponible                                │  │
│  │  ├── scatter-chart/⬜ Disponible                                │  │
│  │  └── tree-map/     ⬜ Disponible                                │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │  HTTP REST API
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (apps/api)                           │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  plane/app/views/analytic/                                      │  │
│  │  ├── advance.py          → AdvanceAnalyticsEndpoint (KPIs)      │  │
│  │  │                        → AdvanceAnalyticsStatsEndpoint        │  │
│  │  │                        → AdvanceAnalyticsChartEndpoint        │  │
│  │  ├── project_analytics.py → Endpoints a nivel proyecto          │  │
│  │  └── base.py              → Analytics legacy                    │  │
│  └──────────────────────────────┬──────────────────────────────────┘  │
│                                 │                                     │
│  ┌──────────────────────────────┴──────────────────────────────────┐  │
│  │  plane/utils/                                                   │  │
│  │  ├── build_chart.py       → Motor genérico de gráficos          │  │
│  │  │   (x_axis × y_axis × group_by → data + schema)              │  │
│  │  ├── analytics_plot.py    → Funciones de plot y burndown         │  │
│  │  └── date_utils.py        → Filtros de rango de fechas          │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                 │                                     │
│  ┌──────────────────────────────┴──────────────────────────────────┐  │
│  │  PostgreSQL                                                     │  │
│  │  Issue, Cycle, Module, State, Label, Project, ProjectMember     │  │
│  │  IssueAssignee, IssueCycle, IssueModule, EstimatePoint          │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Gráficos Actuales en Detalle

#### Tab "Overview"

| #   | Gráfico          | Componente        | Tipo de Chart          | Endpoint API                                                             | Datos Mostrados                                                                                                                  |
| --- | ---------------- | ----------------- | ---------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | KPI Cards        | `TotalInsights`   | Tarjetas texto         | `GET /advance-analytics/?tab=overview`                                   | 8 métricas: total_users, total_admins, total_members, total_guests, total_projects, total_work_items, total_cycles, total_intake |
| 2   | Project Insights | `ProjectInsights` | `RadarChart`           | `GET /advance-analytics-charts/?type=projects`                           | Distribución de work_items, cycles, modules, intake, members, pages, views                                                       |
| 3   | Active Projects  | `ActiveProjects`  | Lista con progress bar | `GET /project-stats/?fields=total_work_items,total_completed_work_items` | Barra de progreso completado/total por proyecto                                                                                  |

#### Tab "Work Items"

| #   | Gráfico             | Componente              | Tipo de Chart        | Endpoint API                                                            | Datos Mostrados                                                                    |
| --- | ------------------- | ----------------------- | -------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 4   | KPI Cards           | `TotalInsights`         | Tarjetas texto       | `GET /advance-analytics/?tab=work-items`                                | 5 métricas: total, started, backlog, unstarted, completed                          |
| 5   | Created vs Resolved | `CreatedVsResolved`     | `AreaChart`          | `GET /advance-analytics-charts/?type=work-items`                        | Tendencia mensual: issues creados vs completados                                   |
| 6   | Customized Insights | `PriorityChart`         | `BarChart` (stacked) | `GET /advance-analytics-charts/?type=custom-work-items&x_axis=PRIORITY` | Configurable: cualquier combo de X-axis × Y-axis × Group-by                        |
| 7   | Insight Table       | `WorkItemsInsightTable` | `DataTable`          | `GET /advance-analytics-stats/?type=work-items`                         | Tabla: proyecto × state groups (backlog, started, unstarted, completed, cancelled) |

### Filtros Disponibles

El `BaseAnalyticsStore` mantiene el estado de los filtros compartidos en toda la sección:

| Filtro             | Tipo       | Estado                                                      |
| ------------------ | ---------- | ----------------------------------------------------------- |
| `selectedProjects` | `string[]` | Multi-select de proyectos                                   |
| `selectedDuration` | Enum       | `yesterday`, `last_7_days`, `last_30_days`, `last_3_months` |
| `selectedCycle`    | `string`   | ID de ciclo específico                                      |
| `selectedModule`   | `string`   | ID de módulo específico                                     |
| `isPeekView`       | `boolean`  | Vista de proyecto individual                                |
| `isEpic`           | `boolean`  | Filtrar solo epics                                          |

### Motor Backend de Gráficos Configurables

El archivo `build_chart.py` implementa un motor genérico que acepta cualquier combinación de ejes:

```
build_analytics_chart(queryset, x_axis, group_by) → { data: [...], schema: {...} }
```

**X-axis soportados (13):**

| Campo             | Descripción          | Tipo Django                                                        |
| ----------------- | -------------------- | ------------------------------------------------------------------ |
| `STATES`          | Estado del work item | `state__id` / `state__name`                                        |
| `STATE_GROUPS`    | Grupo de estado      | `state__group` (backlog, unstarted, started, completed, cancelled) |
| `LABELS`          | Etiquetas            | `labels__id` / `labels__name`                                      |
| `ASSIGNEES`       | Asignados            | `assignees__id` / `assignees__display_name`                        |
| `ESTIMATE_POINTS` | Puntos de estimación | `estimate_point__key` / `estimate_point__value`                    |
| `CYCLES`          | Ciclos               | `issue_cycle__cycle_id` / `issue_cycle__cycle__name`               |
| `MODULES`         | Módulos              | `issue_module__module_id` / `issue_module__module__name`           |
| `PRIORITY`        | Prioridad            | `priority` (none, low, medium, high, urgent)                       |
| `START_DATE`      | Fecha de inicio      | `start_date`                                                       |
| `TARGET_DATE`     | Fecha objetivo       | `target_date`                                                      |
| `CREATED_AT`      | Fecha de creación    | `created_at__date`                                                 |
| `COMPLETED_AT`    | Fecha de completado  | `completed_at__date`                                               |
| `CREATED_BY`      | Creado por           | `created_by_id` / `created_by__display_name`                       |

**Y-axis soportados (1):**

| Campo             | Descripción                          |
| ----------------- | ------------------------------------ |
| `WORK_ITEM_COUNT` | Conteo de work items (`Count("id")`) |

---

## Propuesta de Feature: Nuevos Gráficos

### Fase 1 — Reutilización Directa (Esfuerzo Bajo)

Estos gráficos usan componentes de chart existentes en `@plane/propel` y endpoints existentes en el backend, Solo requieren crear componentes wrapper en `core/components/analytics/`.

---

#### 1.1 PieChart — Distribución por Estado

**Descripción**: Gráfico circular que muestra la proporción de work items en cada state group (backlog, unstarted, started, completed, cancelled).

**Componentes involucrados**:

| Capa               | Componente/Archivo                                                     | Acción             |
| ------------------ | ---------------------------------------------------------------------- | ------------------ |
| Frontend Chart     | `@plane/propel/charts/pie-chart`                                       | Reusar (ya existe) |
| Frontend Component | `analytics/overview/state-distribution.tsx`                            | **NUEVO**          |
| Backend            | `advance-analytics-charts/?type=custom-work-items&x_axis=STATE_GROUPS` | Reusar (ya existe) |

**Flujo de datos**:

```
AnalyticsService.getAdvanceAnalyticsCharts("custom-work-items", { x_axis: "STATE_GROUPS" })
  → build_analytics_chart(queryset, "STATE_GROUPS")
    → [{ key: "backlog", name: "Backlog", count: 42 }, ...]
      → PieChart con colores por state group
```

**Mockup de datos**:

```typescript
const data = [
  { key: "backlog", name: "Backlog", count: 42, fill: "#d9d9d9" },
  { key: "unstarted", name: "Unstarted", count: 28, fill: "#3a3a3a" },
  { key: "started", name: "Started", count: 65, fill: "#f59e0b" },
  { key: "completed", name: "Completed", count: 120, fill: "#16a34a" },
  { key: "cancelled", name: "Cancelled", count: 8, fill: "#ef4444" },
];
```

---

#### 1.2 PieChart — Distribución por Prioridad

**Descripción**: Gráfico circular que muestra la proporción de work items por prioridad (urgent, high, medium, low, none).

**Componentes involucrados**:

| Capa               | Componente/Archivo                                                 | Acción    |
| ------------------ | ------------------------------------------------------------------ | --------- |
| Frontend Chart     | `@plane/propel/charts/pie-chart`                                   | Reusar    |
| Frontend Component | `analytics/overview/priority-distribution.tsx`                     | **NUEVO** |
| Backend            | `advance-analytics-charts/?type=custom-work-items&x_axis=PRIORITY` | Reusar    |

---

#### 1.3 BarChart — Carga de Trabajo por Asignado

**Descripción**: Gráfico de barras horizontales o verticales mostrando cuántos work items tiene asignados cada miembro, con stacking por state group.

**Componentes involucrados**:

| Capa               | Componente/Archivo                                                                        | Acción    |
| ------------------ | ----------------------------------------------------------------------------------------- | --------- |
| Frontend Chart     | `@plane/propel/charts/bar-chart`                                                          | Reusar    |
| Frontend Component | `analytics/work-items/assignee-workload.tsx`                                              | **NUEVO** |
| Backend            | `advance-analytics-charts/?type=custom-work-items&x_axis=ASSIGNEES&group_by=STATE_GROUPS` | Reusar    |

**Dato clave**: Este gráfico ya es posible con el `CustomizedInsights` existente seleccionando X=Assignees, Group=State Groups. La diferencia es que este sería un widget dedicado y pre-configurado, siempre visible.

---

#### 1.4 TreeMap — Proporción por Módulo

**Descripción**: Mapa de árbol que muestra visualmente la distribución de work items por módulo, donde el tamaño de cada rectángulo es proporcional al número de work items.

**Componentes involucrados**:

| Capa               | Componente/Archivo                                                | Acción    |
| ------------------ | ----------------------------------------------------------------- | --------- |
| Frontend Chart     | `@plane/propel/charts/tree-map`                                   | Reusar    |
| Frontend Component | `analytics/overview/module-treemap.tsx`                           | **NUEVO** |
| Backend            | `advance-analytics-charts/?type=custom-work-items&x_axis=MODULES` | Reusar    |

---

#### 1.5 LineChart — Tendencia de Creación de Work Items

**Descripción**: Gráfico de líneas mostrando la tendencia diaria/semanal/mensual de creación de work items, como alternativa visual al AreaChart existente.

**Componentes involucrados**:

| Capa               | Componente/Archivo                          | Acción    |
| ------------------ | ------------------------------------------- | --------- |
| Frontend Chart     | `@plane/propel/charts/line-chart`           | Reusar    |
| Frontend Component | `analytics/work-items/creation-trend.tsx`   | **NUEVO** |
| Backend            | `advance-analytics-charts/?type=work-items` | Reusar    |

---

### Fase 2 — Extensiones del Backend (Esfuerzo Medio)

Estos gráficos requieren nuevos endpoints o extensiones del motor existente en el backend.

---

#### 2.1 Burndown Chart por Proyecto

**Descripción**: Gráfico clásico de burndown mostrando work items pendientes vs tiempo, con línea ideal de progreso. Disponible para cada proyecto, ciclo o módulo.

**Componentes involucrados**:

| Capa               | Componente/Archivo                               | Acción                                    |
| ------------------ | ------------------------------------------------ | ----------------------------------------- |
| Frontend Chart     | `@plane/propel/charts/area-chart` o `line-chart` | Reusar                                    |
| Frontend Component | `analytics/project/burndown-chart.tsx`           | **NUEVO**                                 |
| Backend View       | `analytic/advance.py` → nuevo método             | **MODIFICAR** — exponer `burndown_plot()` |
| Backend Util       | `analytics_plot.py` → `burndown_plot()`          | Reusar (ya existe para cycles/modules)    |

**Nota**: La función `burndown_plot()` ya existe en `analytics_plot.py` y soporta tanto conteo de issues como estimation points. Actualmente solo se usa en las vistas de ciclo y módulo individuales. Se necesita exponerla como un endpoint de analytics generalizado.

**Endpoint propuesto**:

```
GET /api/workspaces/{slug}/advance-analytics-charts/?type=burndown&project_id={id}
GET /api/workspaces/{slug}/advance-analytics-charts/?type=burndown&cycle_id={id}
GET /api/workspaces/{slug}/advance-analytics-charts/?type=burndown&module_id={id}
```

---

#### 2.2 Velocity Chart (Velocidad por Ciclo)

**Descripción**: Gráfico de barras mostrando la cantidad de work items (o story points) completados en cada ciclo/sprint, permitiendo estimar la velocidad del equipo.

**Componentes involucrados**:

| Capa               | Componente/Archivo                       | Acción    |
| ------------------ | ---------------------------------------- | --------- |
| Frontend Chart     | `@plane/propel/charts/bar-chart`         | Reusar    |
| Frontend Component | `analytics/project/velocity-chart.tsx`   | **NUEVO** |
| Backend View       | `analytic/advance.py` → nuevo método     | **NUEVO** |
| Backend Query      | Agregar completados por ciclo con fechas | **NUEVO** |

**Endpoint propuesto**:

```
GET /api/workspaces/{slug}/advance-analytics-charts/?type=velocity&project_id={id}
```

**Query backend propuesta**:

```python
# Pseudocódigo
Cycle.objects.filter(
    project_id=project_id,
    workspace__slug=slug,
).annotate(
    completed_work_items=Count(
        "issue_cycle__issue",
        filter=Q(issue_cycle__issue__state__group="completed")
    ),
    total_estimate=Sum(
        Cast("issue_cycle__issue__estimate_point__value", FloatField()),
        filter=Q(issue_cycle__issue__state__group="completed")
    ),
).values("name", "start_date", "end_date", "completed_work_items", "total_estimate")
.order_by("start_date")
```

---

#### 2.3 Distribución de Lead Time (Histograma)

**Descripción**: Histograma mostrando la distribución del tiempo que tardan los work items desde su creación hasta ser completados (lead time), agrupado en rangos (0-1 día, 1-3 días, 3-7 días, 1-2 semanas, etc.).

**Componentes involucrados**:

| Capa               | Componente/Archivo                              | Acción    |
| ------------------ | ----------------------------------------------- | --------- |
| Frontend Chart     | `@plane/propel/charts/bar-chart`                | Reusar    |
| Frontend Component | `analytics/work-items/lead-time-histogram.tsx`  | **NUEVO** |
| Backend View       | `analytic/advance.py` → nuevo método            | **NUEVO** |
| Backend Query      | `completed_at - created_at` agrupado en buckets | **NUEVO** |

**Endpoint propuesto**:

```
GET /api/workspaces/{slug}/advance-analytics-charts/?type=lead-time
```

**Query backend propuesta**:

```python
# Pseudocódigo
Issue.issue_objects.filter(
    state__group="completed",
    completed_at__isnull=False,
    **filters["base_filters"],
).annotate(
    lead_time_days=ExpressionWrapper(
        F("completed_at") - F("created_at"),
        output_field=DurationField()
    )
).annotate(
    lead_time_bucket=Case(
        When(lead_time_days__lt=timedelta(days=1), then=Value("< 1 day")),
        When(lead_time_days__lt=timedelta(days=3), then=Value("1-3 days")),
        When(lead_time_days__lt=timedelta(days=7), then=Value("3-7 days")),
        When(lead_time_days__lt=timedelta(days=14), then=Value("1-2 weeks")),
        When(lead_time_days__lt=timedelta(days=30), then=Value("2-4 weeks")),
        default=Value("> 1 month"),
    )
).values("lead_time_bucket").annotate(count=Count("id"))
```

---

#### 2.4 Work Items por Label con Tendencia

**Descripción**: Gráfico combinado (barras + línea) mostrando la distribución actual de work items por etiqueta, con una línea de tendencia mostrando cómo ha cambiado en el tiempo.

**Componentes involucrados**:

| Capa               | Componente/Archivo                                                                   | Acción           |
| ------------------ | ------------------------------------------------------------------------------------ | ---------------- |
| Frontend Chart     | `@plane/propel/charts/area-chart` (ComposedChart)                                    | Reusar           |
| Frontend Component | `analytics/work-items/label-trend.tsx`                                               | **NUEVO**        |
| Backend            | `advance-analytics-charts/?type=custom-work-items&x_axis=CREATED_AT&group_by=LABELS` | Reusar (parcial) |

---

### Fase 3 — Métricas Avanzadas (Esfuerzo Alto)

Estos gráficos requieren lógica compleja nueva en el backend, incluyendo snapshots temporales o cálculos estadísticos.

---

#### 3.1 Cumulative Flow Diagram (CFD)

**Descripción**: Gráfico de áreas apiladas mostrando la cantidad acumulada de work items en cada state group a lo largo del tiempo. Permite identificar cuellos de botella y flujo de trabajo.

**Componentes involucrados**:

| Capa               | Componente/Archivo                      | Acción                 |
| ------------------ | --------------------------------------- | ---------------------- |
| Frontend Chart     | `@plane/propel/charts/area-chart`       | Reusar (stacked areas) |
| Frontend Component | `analytics/project/cumulative-flow.tsx` | **NUEVO**              |
| Backend View       | `analytic/advance.py` → nuevo método    | **NUEVO**              |
| Backend            | Snapshot diario o cálculo retrospectivo | **NUEVO**              |

**Complejidad**: Alta. Requiere reconstruir el estado histórico de cada work item en cada punto del tiempo. Dos enfoques posibles:

1. **Snapshot (proactivo)**: Tarea Celery Beat que ejecuta diariamente un snapshot del conteo por state group por proyecto. Almacenado en una nueva tabla `AnalyticsSnapshot`.
2. **Cálculo retrospectivo (reactivo)**: Reconstruir el historial usando `IssueActivity` con tipo `state.activity`, procesando cada cambio de estado para calcular los conteos en cada punto temporal.

---

#### 3.2 Cycle Time por Prioridad

**Descripción**: Gráfico de scatter plot mostrando el cycle time (tiempo desde "started" hasta "completed") de cada work item, agrupado por prioridad, permitiendo visualizar patrones y outliers.

**Componentes involucrados**:

| Capa               | Componente/Archivo                            | Acción    |
| ------------------ | --------------------------------------------- | --------- |
| Frontend Chart     | `@plane/propel/charts/scatter-chart`          | Reusar    |
| Frontend Component | `analytics/work-items/cycle-time-scatter.tsx` | **NUEVO** |
| Backend            | Nuevo endpoint con cálculo de cycle time      | **NUEVO** |

**Complejidad**: Alta. El cycle time requiere encontrar cuándo cada issue entró al state group "started" (usando `IssueActivity`) y cuándo llegó a "completed".

---

#### 3.3 Predicción de Completado

**Descripción**: Gráfico de líneas con proyección futura basada en la velocidad histórica, mostrando cuándo se espera completar todos los work items del proyecto/ciclo/módulo al ritmo actual.

**Complejidad**: Alta. Requiere cálculo de throughput promedio y proyección lineal o exponencial.

---

## Ubicaciones Propuestas para Nuevos Gráficos

### Opción A: Extensión de la Sección Analytics Existente

Agregar nuevos tabs o expandir los tabs existentes:

```
Analytics
├── Overview (existente)
│   ├── KPI Cards (existente)
│   ├── Project Insights – RadarChart (existente)
│   ├── Active Projects (existente)
│   ├── State Distribution – PieChart (NUEVO – 1.1)
│   └── Module TreeMap (NUEVO – 1.4)
│
├── Work Items (existente)
│   ├── KPI Cards (existente)
│   ├── Created vs Resolved – AreaChart (existente)
│   ├── Customized Insights – BarChart (existente)
│   ├── Insight Table (existente)
│   ├── Priority Distribution – PieChart (NUEVO – 1.2)
│   ├── Assignee Workload – BarChart (NUEVO – 1.3)
│   ├── Creation Trend – LineChart (NUEVO – 1.5)
│   └── Lead Time Histogram (NUEVO – 2.3)
│
├── Performance (NUEVO tab)
│   ├── Velocity Chart (NUEVO – 2.2)
│   ├── Burndown Chart (NUEVO – 2.1)
│   ├── Cumulative Flow Diagram (NUEVO – 3.1)
│   └── Cycle Time Scatter (NUEVO – 3.2)
│
└── Labels & Trends (NUEVO tab)
    └── Label Trend (NUEVO – 2.4)
```

### Opción B: Dashboard de Proyecto Individual

Crear una nueva vista accesible desde cada proyecto que muestre sus analíticas específicas:

```
Proyecto > Analytics (nueva sección en sidebar)
├── KPI Cards del proyecto
├── State Distribution – PieChart
├── Priority Distribution – PieChart
├── Burndown Chart
├── Velocity Chart (por ciclos del proyecto)
├── Assignee Workload
├── Creation Trend
└── Lead Time Histogram
```

**Nota**: Los endpoints a nivel proyecto ya existen (`/projects/{id}/advance-analytics*`), lo que facilita esta opción.

### Opción C: Widgets en la Home

Agregar widgets de analytics al sistema de widgets de la Home:

```typescript
// Extensión de HOME_WIDGETS_LIST
export const HOME_WIDGETS_LIST = {
  // ... widgets existentes ...
  project_analytics: {
    component: ProjectAnalyticsWidget,
    fullWidth: true,
    title: "home.project_analytics.title",
  },
  my_work_stats: {
    component: MyWorkStatsWidget,
    fullWidth: false,
    title: "home.my_work_stats.title",
  },
};
```

---

## Cambios Requeridos por Capa

### Frontend — `apps/web`

| Archivo/Directorio                              | Cambio                                                                                                        | Fase |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---- |
| `core/components/analytics/overview/`           | Nuevos componentes: `state-distribution.tsx`, `module-treemap.tsx`                                            | 1    |
| `core/components/analytics/work-items/`         | Nuevos componentes: `assignee-workload.tsx`, `creation-trend.tsx`, `lead-time-histogram.tsx`                  | 1-2  |
| `core/components/analytics/performance/`        | Nuevo directorio: `burndown-chart.tsx`, `velocity-chart.tsx`, `cumulative-flow.tsx`, `cycle-time-scatter.tsx` | 2-3  |
| `core/components/analytics/overview/root.tsx`   | Agregar nuevos componentes al layout                                                                          | 1    |
| `core/components/analytics/work-items/root.tsx` | Agregar nuevos componentes al layout                                                                          | 1-2  |
| `core/services/analytics.service.ts`            | Nuevos métodos para endpoints de Fase 2-3                                                                     | 2-3  |
| `core/store/analytics.store.ts`                 | Posibles nuevos observables (tab Performance)                                                                 | 2    |

### Frontend — `packages/propel`

| Archivo/Directorio     | Cambio                           | Fase |
| ---------------------- | -------------------------------- | ---- |
| Sin cambios necesarios | Los 7 tipos de charts ya existen | —    |

### Frontend — `packages/constants`

| Archivo/Directorio        | Cambio                                                                  | Fase |
| ------------------------- | ----------------------------------------------------------------------- | ---- |
| `src/analytics/common.ts` | Nuevos tabs en `TAnalyticsTabsBase`, nuevos `ANALYTICS_INSIGHTS_FIELDS` | 2    |

### Frontend — `packages/types`

| Archivo/Directorio | Cambio                                                            | Fase |
| ------------------ | ----------------------------------------------------------------- | ---- |
| Tipos de analytics | Nuevos tipos para responses de burndown, velocity, lead-time, CFD | 2-3  |

### Backend — `apps/api`

| Archivo/Directorio                    | Cambio                                                                      | Fase |
| ------------------------------------- | --------------------------------------------------------------------------- | ---- |
| `plane/app/views/analytic/advance.py` | Nuevos métodos: `burndown_chart()`, `velocity_chart()`, `lead_time_chart()` | 2-3  |
| `plane/app/urls/analytic.py`          | Nuevas rutas (si se crean endpoints separados)                              | 2-3  |
| `plane/utils/build_chart.py`          | Extensión del Y-axis (agregar `ESTIMATE_POINT_SUM`)                         | 2    |
| `plane/db/models/`                    | Nueva tabla `AnalyticsSnapshot` (solo si se implementa CFD con snapshots)   | 3    |
| `plane/bgtasks/`                      | Nueva tarea periódica para snapshots (solo para CFD)                        | 3    |

---

## Permisos y Seguridad

Según el sistema de roles existente (documentado en `06-roles-y-permisos.md`):

| Rol        | Acceso a Analytics                                                                          |
| ---------- | ------------------------------------------------------------------------------------------- |
| **Admin**  | ✅ Todos los gráficos, todos los proyectos                                                  |
| **Member** | ✅ Todos los gráficos, todos los proyectos donde es miembro                                 |
| **Guest**  | ❌ Sin acceso a Analytics (nivel workspace: `@allow_permission([ROLE.ADMIN, ROLE.MEMBER])`) |

**No se requieren cambios** en el sistema de permisos para este feature. Los decoradores `@allow_permission` existentes aplican correctamente.

---

## Internacionalización (i18n)

Todas las nuevas etiquetas, títulos y textos deben agregarse al sistema de traducciones en `packages/i18n/`. Claves propuestas:

```json
{
  "workspace_analytics.state_distribution": "State Distribution",
  "workspace_analytics.priority_distribution": "Priority Distribution",
  "workspace_analytics.assignee_workload": "Assignee Workload",
  "workspace_analytics.module_treemap": "Module Distribution",
  "workspace_analytics.creation_trend": "Creation Trend",
  "workspace_analytics.burndown_chart": "Burndown Chart",
  "workspace_analytics.velocity_chart": "Velocity",
  "workspace_analytics.lead_time": "Lead Time Distribution",
  "workspace_analytics.cumulative_flow": "Cumulative Flow Diagram",
  "workspace_analytics.cycle_time": "Cycle Time",
  "workspace_analytics.performance": "Performance"
}
```

---

## Estimación de Esfuerzo

| Fase       | Gráficos               | Frontend   | Backend         | Total Estimado  |
| ---------- | ---------------------- | ---------- | --------------- | --------------- |
| **Fase 1** | 5 gráficos (1.1 - 1.5) | ~2-3 días  | 0 días (reusar) | **2-3 días**    |
| **Fase 2** | 4 gráficos (2.1 - 2.4) | ~3-4 días  | ~3-4 días       | **6-8 días**    |
| **Fase 3** | 3 gráficos (3.1 - 3.3) | ~3-4 días  | ~5-7 días       | **8-11 días**   |
| **Total**  | **12 gráficos**        | ~8-11 días | ~8-11 días      | **~16-22 días** |

---

## Riesgos y Consideraciones

| Riesgo                     | Impacto                                                          | Mitigación                                                                    |
| -------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Performance de queries** | Las queries de analíticas pueden ser lentas en proyectos grandes | Implementar caché Redis para resultados de analytics con TTL configurable     |
| **Volumen de datos**       | El CFD y las tendencias históricas pueden generar mucha data     | Agrupar por semana/mes en lugar de día para proyectos con mucho historial     |
| **Complejidad del UI**     | Demasiados gráficos pueden abrumar al usuario                    | Hacer gráficos colapsables y/o permitir configurar qué gráficos mostrar       |
| **Consistencia de datos**  | El cálculo retrospectivo de cycle time depende de IssueActivity  | Validar que IssueActivity registra todos los cambios de estado correctamente  |
| **Impacto en bundle size** | recharts y 7 tipos de charts aumentan el JS bundle               | Los charts ya usan lazy loading (`lazy()` + `Suspense`), mantener este patrón |

---

## Dependencias del Feature

```
Fase 1 → Sin dependencias (puede empezar inmediatamente)
Fase 2 → Fase 1 completada (para reusar patrones)
       → Nuevos endpoints backend
Fase 3 → Fase 2 completada
       → Posible nueva tabla en DB (AnalyticsSnapshot)
       → Nueva tarea Celery Beat
```
