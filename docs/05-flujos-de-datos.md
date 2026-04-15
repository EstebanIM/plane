# 05 — Flujos de Datos

## Flujo Crítico: Creación de un Work Item (Issue)

Este documento traza el viaje completo de la creación de un issue desde la interacción del usuario en el navegador hasta la persistencia en base de datos y la generación de notificaciones.

---

## Diagrama de Secuencia

```
Usuario → [Frontend Form]
              │
              │ React Hook Form submit
              ▼
         [MobX Store]
         BaseIssuesStore.createIssue()
              │
              │ async HTTP call
              ▼
         [Service Layer]
         IssueService.createIssue()
              │
              │ POST /api/workspaces/{slug}/projects/{id}/issues/
              ▼
         [Nginx Proxy]
              │
              │ forward to api:8000
              ▼
         [Django URL Router]
         plane/app/urls/issue.py
              │
              │ IssueViewSet.as_view({"post": "create"})
              ▼
         [IssueViewSet.create()]
         plane/app/views/issue/base.py
              │
              ├─ validate: IssueCreateSerializer
              │
              ├─ save: Issue.objects.create()
              │         Issue.save() ──► pg_advisory_lock
              │                          sequence_id cálculo
              │                          IssueSequence.create()
              │
              ├─ response: issue con annotations
              │
              └─ dispatch 3 Celery tasks:
                    │
                    ├──► issue_activity.delay()
                    │         └── IssueActivity records
                    │             └── notifications()
                    │                   └── Notification records (BD)
                    │                   └── email batch (Redis queue)
                    │
                    ├──► model_activity.delay() (webhook)
                    │         └── WebhookLog + HTTP POST a URL del webhook
                    │
                    └──► issue_description_version_task.delay()
                              └── IssueDescriptionVersion record

              HTTP 201 response
              ▼
         [Service Layer]
         Promise.resolve(issue data)
              │
              ▼
         [MobX Store]
         this.addIssue(response)
              │
              │ MobX action
              ▼
         [React UI] — Re-render reactivo
         Issue aparece en la lista
```

---

## Paso 1: El Formulario (Frontend)

**Archivo**: [apps/web/core/components/issues/issue-modal/form.tsx](../apps/web/core/components/issues/issue-modal/form.tsx)

El componente `IssueForm` usa **React Hook Form** con MobX (`observer`) para reactividad. Renderiza:

- `IssueTitleInput` — Campo de título (requerido)
- `IssueDescriptionEditor` — Editor TipTap (@plane/editor)
- `IssueDefaultProperties` — Selectores de estado, prioridad, fechas, estimación
- `IssueProjectSelect` — Selección del proyecto destino
- Sub-componentes de asignados, etiquetas, ciclo, módulo

Cuando el usuario hace submit, React Hook Form llama al handler con el objeto de datos del formulario, que llama al store.

---

## Paso 2: El Store MobX

**Archivo**: [apps/web/core/store/issue/helpers/base-issues.store.ts](../apps/web/core/store/issue/helpers/base-issues.store.ts) (línea ~526)

```typescript
async createIssue(
  workspaceSlug: string,
  projectId: string,
  data: Partial<TIssue>,
  id?: string,
  shouldUpdateList = true
) {
  // 1. Llamada al servicio (NO optimista: espera la respuesta del servidor)
  const response = await this.issueService.createIssue(workspaceSlug, projectId, data);

  // 2. Agrega el issue al store MobX local (con el ID real del servidor)
  this.addIssue(response, shouldUpdateList);

  // 3. Actualiza estadísticas del padre (count de sub-issues, etc.)
  shouldUpdateList && await this.fetchParentStats(workspaceSlug, projectId);

  return response;
}
```

Los sub-stores especializados (`CycleIssues`, `ModuleIssues`) sobrescriben `createIssue` para agregar lógica adicional:

- `CycleIssues.createIssue`: después de crear el issue, también lo agrega al ciclo activo
- `ModuleIssues.createIssue`: ídem para módulos

---

## Paso 3: El Servicio HTTP

**Archivo**: [apps/web/core/services/issue/issue.service.ts](../apps/web/core/services/issue/issue.service.ts)

```typescript
class IssueService extends APIService {
  async createIssue(workspaceSlug: string, projectId: string, data: Partial<TIssue>): Promise<TIssue> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/`, data).then((res) => res?.data);
  }
}
```

La clase base `APIService` (en [apps/web/core/services/api.service.ts](../apps/web/core/services/api.service.ts)) configura Axios con:

- `withCredentials: true` — envía la cookie de sesión automáticamente
- Interceptor 401 — redirige al login si la sesión expiró

La request llega a **Nginx** (proxy), que la reenvía al contenedor `api:8000`.

---

## Paso 4: Enrutamiento Django

**Archivo**: [apps/api/plane/app/urls/issue.py](../apps/api/plane/app/urls/issue.py)

```python
path(
    "workspaces/<str:slug>/projects/<uuid:project_id>/issues/",
    IssueViewSet.as_view({"get": "list", "post": "create"}),
)
```

Django resuelve el URL y despacha al método `create` del `IssueViewSet`.

---

## Paso 5: El ViewSet — Validación y Persistencia

**Archivo**: [apps/api/plane/app/views/issue/base.py](../apps/api/plane/app/views/issue/base.py) (línea ~392)

```python
@allow_permission([ROLE.ADMIN, ROLE.MEMBER])  # Solo admins y members pueden crear
def create(self, request, slug, project_id):
    project = Project.objects.get(pk=project_id)

    # 1. Validación via serializer
    serializer = IssueCreateSerializer(
        data=request.data,
        context={
            "project_id": project_id,
            "workspace_id": project.workspace_id,
            "default_assignee_id": project.default_assignee_id,
        },
    )

    if serializer.is_valid():
        # 2. Persistencia en BD
        serializer.save()

        # 3. Disparar tarea de actividad + notificaciones (asíncrona)
        issue_activity.delay(
            type="issue.activity.created",
            requested_data=json.dumps(self.request.data),
            actor_id=str(request.user.id),
            issue_id=str(serializer.data.get("id")),
            project_id=str(project_id),
            notification=True,
            origin=base_host(request=request, is_app=True),
        )

        # 4. Retornar el issue con todas las annotations (cycle_id, module_ids, etc.)
        issue = queryset.filter(pk=serializer.data["id"]).values(...).first()
        return Response(issue, status=201)
```

---

## Paso 6: El Serializer — Validaciones de Negocio

**Archivo**: [apps/api/plane/app/serializers/issue.py](../apps/api/plane/app/serializers/issue.py)

`IssueCreateSerializer.validate()` aplica validaciones de negocio:

```python
def validate(self, attrs):
    # 1. Fechas: start_date no puede ser posterior a target_date
    if attrs.get("start_date") > attrs.get("target_date"):
        raise serializers.ValidationError("Start date cannot exceed target date")

    # 2. Seguridad: sanitizar HTML de la descripción (prevenir XSS)
    if "description_html" in attrs:
        is_valid, error, sanitized = validate_html_content(attrs["description_html"])
        attrs["description_html"] = sanitized  # HTML limpio

    # 3. Verificar que los assignees son miembros activos del proyecto con rol >= Member
    attrs["assignee_ids"] = ProjectMember.objects.filter(
        project_id=self.context["project_id"],
        role__gte=15,  # MEMBER o superior
        is_active=True,
        member_id__in=attrs["assignee_ids"],
    ).values_list("member_id", flat=True)

    # 4. Verificar que las labels pertenecen al proyecto
    attrs["label_ids"] = Label.objects.filter(
        project_id=self.context.get("project_id"),
        id__in=[label.id for label in attrs["label_ids"]],
    ).values_list("id", flat=True)
```

`IssueCreateSerializer.create()` persiste:

1. `Issue.objects.create(...)` — Crea el issue principal
2. `IssueAssignee.objects.bulk_create(...)` — Crea registros de asignados
3. `IssueLabel.objects.bulk_create(...)` — Crea registros de etiquetas
4. Si no hay assignees, usa `default_assignee_id` del proyecto

---

## Paso 7: El Modelo — Lógica de Persistencia en BD

**Archivo**: [apps/api/plane/db/models/issue.py](../apps/api/plane/db/models/issue.py)

El método `Issue.save()` contiene lógica crítica al crear un issue nuevo (`self._state.adding == True`):

```python
def save(self, *args, **kwargs):
    if self._state.adding:
        # 1. Advisory lock de PostgreSQL para garantizar unicidad del sequence_id
        #    Evita race conditions en creaciones simultáneas en el mismo proyecto
        with transaction.atomic():
            connection.cursor().execute(
                "SELECT pg_advisory_xact_lock(%s)",
                [convert_uuid_to_integer(self.project_id)]
            )

            # 2. Calcular el siguiente sequence_id para este proyecto (ej: PROJ-42)
            last_sequence = IssueSequence.objects.filter(
                project=self.project
            ).aggregate(Max("sequence"))["sequence__max"]
            self.sequence_id = (last_sequence or 0) + 1

            # 3. Crear registro IssueSequence para tracking
            IssueSequence.objects.create(
                issue=self, project=self.project, sequence=self.sequence_id
            )

    # 4. Procesar texto plano para búsquedas (strip HTML tags)
    self.description_stripped = strip_tags(self.description_html or "")

    # 5. Calcular sort_order según el grupo del estado (para ordenación por defecto)
    #    Issues nuevos van al fondo de su grupo de estado
    self.sort_order = calculate_sort_order(self.state)

    super().save(*args, **kwargs)
```

> **Por qué advisory locks**: Sin el lock, dos requests simultáneos podrían calcular el mismo `sequence_id` y crear dos issues con la misma clave (ej: PROJ-42). El advisory lock de PostgreSQL garantiza que solo un proceso a la vez calcula el sequence_id para un proyecto dado.

---

## Paso 8: Tareas Asíncronas Post-Creación

Después de la respuesta HTTP 201, **Celery** procesa tres tareas en background:

### Tarea 1: `issue_activity` — Actividad y Notificaciones

**Archivo**: [apps/api/plane/bgtasks/issue_activities_task.py](../apps/api/plane/bgtasks/issue_activities_task.py)

```python
@shared_task
def issue_activity(type, requested_data, actor_id, issue_id, project_id, notification, origin, ...):
    # 1. Despacha al handler correspondiente via ACTIVITY_MAPPER
    activity_handler = ACTIVITY_MAPPER["issue.activity.created"]
    activity_handler(...)  # → create_issue_activity()

    # 2. create_issue_activity crea el registro IssueActivity en BD
    IssueActivity.objects.create(
        type="issue.activity.created",
        verb="created",
        actor=actor,
        issue=issue,
        project=project,
        comment="created the issue",
    )

    # 3. Genera notificaciones in-app para todos los involucrados
    if notification:
        notifications(
            type="issue.activity.created",
            issue=issue,
            actor=actor,
            issue_activities_created=[activity],
        )
```

**`notifications()`** (en `plane/bgtasks/notification_task.py`) crea registros `Notification` en BD para:

- El **default_assignee** del proyecto (si está configurado)
- Los **assignees** del issue
- Los **subscribers** (usuarios que siguen el issue)
- Los **mencionados** en la descripción

### Tarea 2: `model_activity` — Webhooks

**Archivo**: [apps/api/plane/bgtasks/webhook_task.py](../apps/api/plane/bgtasks/webhook_task.py)

```python
@shared_task
def model_activity(model_name, model_activity, model_id, workspace_id, ...):
    # 1. Obtiene todos los webhooks configurados para este workspace
    webhooks = Webhook.objects.filter(workspace_id=workspace_id, is_active=True)

    for webhook in webhooks:
        if webhook.issue:  # Si el webhook tiene habilitados los eventos de issue
            # 2. Serializa el issue completo
            issue_data = IssueSerializer(issue).data

            # 3. Construye el payload del webhook
            payload = {"event": "issue", "action": "created", "data": issue_data}

            # 4. Firma el payload con HMAC-SHA256
            signature = hmac.new(webhook.secret_key, payload_bytes, sha256).hexdigest()

            # 5. Envía HTTP POST al webhook URL
            response = requests.post(
                webhook.url,
                json=payload,
                headers={"X-Plane-Signature": signature}
            )

            # 6. Guarda el log de entrega
            WebhookLog.objects.create(webhook=webhook, response_status=response.status_code, ...)
```

### Tarea 3: `issue_description_version_task` — Versionado

Crea un snapshot de `IssueDescriptionVersion` con el contenido inicial de la descripción, iniciando el historial de versiones del issue.

---

## Paso 9: Actualización del Store y Re-render

Una vez que la API responde con `HTTP 201`:

```typescript
// BaseIssuesStore
const response = await this.issueService.createIssue(...);  // ← respuesta del servidor

// addIssue: MobX action
runInAction(() => {
  // Agrega el issue al Map central: issueId → issueData
  this.rootIssueStore.issues.addIssue(response);

  // Si shouldUpdateList, agrega el ID a la lista visible del contexto actual
  this.issueIds.push(response.id);
});
```

MobX notifica automáticamente a todos los componentes que observan (`observer`) el store de issues, provocando el re-render reactivo. El nuevo issue aparece en la lista/board sin necesidad de recargar la página.

---

## Paso 10: Colaboración en Tiempo Real (Editor de Descripción)

Si el usuario escribe contenido en el editor de descripción **mientras otro usuario también tiene el mismo issue abierto**, entra en juego el servidor `live`:

```
Usuario A edita descripción → TipTap Editor (Yjs) → WebSocket → live:3000
                                                                       │
                                                                       │ Hocuspocus sincroniza
                                                                       ▼
Usuario B ve los cambios ← TipTap Editor (Yjs) ← WebSocket ← live:3000
```

1. `@plane/editor` establece una conexión WebSocket a `/live/collaboration/`
2. **Hocuspocus** recibe los cambios como operaciones Yjs (CRDT)
3. Las operaciones se sincronizan con todos los clientes conectados al mismo documento
4. Cada 10 segundos (`debounce: 10000ms`), la extensión **Database** persiste el estado Yjs en Django via HTTP PATCH al campo `description_binary` del issue
5. La extensión **Redis** sincroniza el estado entre múltiples instancias del servidor `live` (para escala horizontal)

> **Importante**: La colaboración en tiempo real del editor es **independiente** de la creación del issue. Ocurre solo cuando el issue ya existe y múltiples usuarios tienen el editor de descripción abierto simultáneamente.

---

## Resumen del Flujo

| #   | Capa                   | Archivo clave                                       | Acción                                        |
| --- | ---------------------- | --------------------------------------------------- | --------------------------------------------- |
| 1   | UI React               | `core/components/issues/issue-modal/form.tsx`       | Formulario con React Hook Form                |
| 2   | Store MobX             | `core/store/issue/helpers/base-issues.store.ts:526` | `createIssue()` — orquestación                |
| 3   | Service                | `core/services/issue/issue.service.ts`              | POST HTTP via Axios                           |
| 4   | Proxy                  | Nginx                                               | Enruta a `api:8000`                           |
| 5   | URL Router             | `plane/app/urls/issue.py`                           | `IssueViewSet` → `create`                     |
| 6   | ViewSet                | `plane/app/views/issue/base.py:392`                 | `@allow_permission`, serializer, save, Celery |
| 7   | Serializer             | `plane/app/serializers/issue.py:82`                 | Validaciones de negocio, bulk create M2M      |
| 8   | Model                  | `plane/db/models/issue.py`                          | Advisory lock, sequence_id, sort_order        |
| 9   | Celery (async)         | `plane/bgtasks/issue_activities_task.py`            | IssueActivity + Notifications                 |
| 10  | Celery (async)         | `plane/bgtasks/webhook_task.py`                     | Webhook delivery con HMAC                     |
| 11  | Celery (async)         | `plane/bgtasks/issue_description_version_task.py`   | Snapshot de versión                           |
| 12  | Store MobX             | `this.addIssue(response)`                           | Actualización reactiva de la UI               |
| 13  | Live Server (opcional) | `apps/live` (Hocuspocus)                            | Colaboración en tiempo real en el editor      |
