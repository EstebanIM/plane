# 06 — Sistema de Roles y Permisos

## Introducción

Plane implementa un sistema de autorización con **tres roles** aplicados en dos niveles independientes: **workspace** y **proyecto**. El mismo usuario puede tener roles distintos en diferentes workspaces o proyectos.

Los roles son jerárquicos y se representan internamente con un entero:

| Rol    | Valor numérico | Significado                                     |
| ------ | -------------- | ----------------------------------------------- |
| Admin  | `20`           | Control total del workspace o del proyecto      |
| Member | `15`           | Colaboración completa — crear, editar y asignar |
| Guest  | `5`            | Lectura con contribuciones limitadas            |

La jerarquía numérica es importante: las consultas filtran con `role__gte=15` ("Member o superior") para excluir Guests eficientemente. El valor por defecto al crear una membresía (workspace o proyecto) es siempre `5` (Guest).

---

## Dónde están definidos los roles en el código

### Backend

| Archivo                                                                                         | Líneas | Qué declara                                                                                          |
| ----------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| [apps/api/plane/app/permissions/base.py](../apps/api/plane/app/permissions/base.py#L13-L16)     | 13 –16 | `class ROLE(Enum)`: enum canónico usado por el decorador `@allow_permission` en la API interna       |
| [apps/api/plane/utils/permissions/base.py](../apps/api/plane/utils/permissions/base.py#L13-L16) | 13 –16 | Segunda copia de `class ROLE(Enum)` usada por la API pública (`plane.api.views`)                     |
| [apps/api/plane/db/models/project.py](../apps/api/plane/db/models/project.py#L19-L27)           | 19 –27 | `ROLE_CHOICES = ((20, "Admin"), (15, "Member"), (5, "Guest"))` + `class ROLE(Enum)` para los modelos |
| [apps/api/plane/db/models/workspace.py](../apps/api/plane/db/models/workspace.py#L19)           | 19     | `ROLE_CHOICES` idéntico al de proyecto, para `WorkspaceMember`                                       |

> **Nota de mantenimiento**: el enum `ROLE` está duplicado en tres lugares del backend. Todos coinciden en valores, pero un cambio en uno no se propaga automáticamente a los otros.

### Frontend

| Archivo                                                                                     | Líneas | Qué declara                                                                                                    |
| ------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| [packages/constants/src/user.ts](../packages/constants/src/user.ts#L29-L40)                 | 29 –40 | `enum EUserPermissions { ADMIN=20, MEMBER=15, GUEST=5 }` y `enum EUserPermissionsLevel { WORKSPACE, PROJECT }` |
| [packages/types/src/enums.ts](../packages/types/src/enums.ts#L7-L13)                        | 7 –13  | Segunda copia de `enum EUserPermissions` con los mismos valores                                                |
| [packages/types/src/workspace.ts](../packages/types/src/workspace.ts#L15-L19)               | 15 –19 | `enum EUserWorkspaceRoles { ADMIN=20, MEMBER=15, GUEST=5 }`                                                    |
| [packages/types/src/project/projects.ts](../packages/types/src/project/projects.ts#L13-L17) | 13 –17 | `enum EUserProjectRoles { ADMIN=20, MEMBER=15, GUEST=5 }`                                                      |
| [packages/constants/src/workspace.ts](../packages/constants/src/workspace.ts#L80-L99)       | 80 –99 | Diccionario `ROLE` con etiquetas i18 n para la UI                                                              |
| [packages/utils/src/permission/role.ts](../packages/utils/src/permission/role.ts#L11-L32)   | 11 –32 | `getUserRole(role)` → `"GUEST" \| "MEMBER" \| "ADMIN"` y `getHighestRole(roles[])`                             |

> El frontend también triplicó los enums. `EUserPermissions`, `EUserWorkspaceRoles` y `EUserProjectRoles` son intercambiables gracias al mismo valor numérico.

---

## Modelos de datos

Los roles de los usuarios se almacenan en cuatro modelos ORM, todos en [apps/api/plane/db/models/](../apps/api/plane/db/models/):

### Workspace

| Modelo                  | Archivo                                                                    | Campo clave                           | Default     |
| ----------------------- | -------------------------------------------------------------------------- | ------------------------------------- | ----------- |
| `WorkspaceMember`       | [workspace.py:198-231](../apps/api/plane/db/models/workspace.py#L198-L231) | `role` (IntegerField, `ROLE_CHOICES`) | `5` (Guest) |
| `WorkspaceMemberInvite` | [workspace.py:234-258](../apps/api/plane/db/models/workspace.py#L234-L258) | `role`                                | `5` (Guest) |

Campos adicionales relevantes de `WorkspaceMember`: `is_active`, `company_role`, `view_props`, `default_props`, `issue_props`.

### Proyecto

| Modelo                | Archivo                                                                | Campo clave                           | Default     |
| --------------------- | ---------------------------------------------------------------------- | ------------------------------------- | ----------- |
| `ProjectMember`       | [project.py:210-224](../apps/api/plane/db/models/project.py#L210-L224) | `role` (IntegerField, `ROLE_CHOICES`) | `5` (Guest) |
| `ProjectMemberInvite` | [project.py:192-207](../apps/api/plane/db/models/project.py#L192-L207) | `role`                                | `5` (Guest) |

Campos adicionales de `ProjectMember`: `is_active`, `view_props`, `default_props`, `sort_order`, `preferences`.

**Interacción entre niveles:**

- Al crear un workspace, el creador es forzado a `role=20` (Admin) en `WorkspaceMember` — [workspace/base.py:129](../apps/api/plane/app/views/workspace/base.py#L129).
- Al crear un proyecto, el creador y el `project_lead` (si existe) son añadidos como `ProjectMember(role=ADMIN)` — [project/base.py:261-274](../apps/api/plane/app/views/project/base.py#L261-L274).
- Si un usuario es degradado a Guest en el workspace, su rol en todos los proyectos de ese workspace también se fuerza a `5` — [workspace/member.py:88-89](../apps/api/plane/app/views/workspace/member.py#L88-L89).

---

## Clases de permisos (backend)

Todas están en [apps/api/plane/app/permissions/](../apps/api/plane/app/permissions/). Las vistas de la API pública usan copias equivalentes en [apps/api/plane/utils/permissions/](../apps/api/plane/utils/permissions/).

### Clases de workspace — [permissions/workspace.py](../apps/api/plane/app/permissions/workspace.py)

| Clase                       | Líneas   | GET / métodos seguros    | POST                  | PUT / PATCH    | DELETE         |
| --------------------------- | -------- | ------------------------ | --------------------- | -------------- | -------------- |
| `WorkSpaceBasePermission`   | 19 –48   | cualquier autenticado    | cualquier autenticado | Admin o Member | Admin          |
| `WorkspaceOwnerPermission`  | 51 –58   | Admin                    | Admin                 | Admin          | Admin          |
| `WorkSpaceAdminPermission`  | 61 –71   | Admin o Member           | Admin o Member        | Admin o Member | Admin o Member |
| `WorkspaceEntityPermission` | 74 –90   | cualquier miembro activo | —                     | Admin o Member | Admin o Member |
| `WorkspaceViewerPermission` | 93 –100  | cualquier miembro activo | —                     | —              | —              |
| `WorkspaceUserPermission`   | 103 –110 | cualquier miembro activo | —                     | —              | —              |

> **Atención**: `WorkSpaceAdminPermission` permite tanto Admin **como Member**, a pesar de su nombre. Se usa en `WorkspaceInvitationsViewset`, lo que significa que los Members también pueden invitar usuarios al workspace.

### Clases de proyecto — [permissions/project.py](../apps/api/plane/app/permissions/project.py)

| Clase                     | Líneas   | GET                             | POST                         | PUT / PATCH / DELETE                     |
| ------------------------- | -------- | ------------------------------- | ---------------------------- | ---------------------------------------- |
| `ProjectBasePermission`   | 13 –53   | cualquier miembro del workspace | Admin o Member del workspace | Admin del proyecto o Admin del workspace |
| `ProjectMemberPermission` | 56 –82   | cualquier miembro del proyecto  | Admin o Member del workspace | Admin o Member del proyecto              |
| `ProjectEntityPermission` | 85 –116  | cualquier miembro del proyecto  | —                            | Admin o Member del proyecto              |
| `ProjectAdminPermission`  | 119 –130 | Admin del proyecto              | Admin                        | Admin                                    |
| `ProjectLitePermission`   | 133 –143 | cualquier miembro del proyecto  | cualquier miembro            | cualquier miembro                        |

### Clase de páginas — [permissions/page.py](../apps/api/plane/app/permissions/page.py)

`ProjectPagePermission` (líneas 18 –125) añade lógica especial:

- `GET`: Admin, Member o Guest del proyecto.
- `POST` (crear página): Admin o Member — [línea 91-94](../apps/api/plane/app/permissions/page.py#L91-L94).
- `PUT / PATCH`: Admin o Member.
- `DELETE`: Admin únicamente — [línea 108-112](../apps/api/plane/app/permissions/page.py#L108-L112).
- Páginas privadas: solo el `owned_by` puede acceder, sin importar el rol — [línea 84-85](../apps/api/plane/app/permissions/page.py#L84-L85).

---

## El decorador `@allow_permission`

Es el mecanismo moderno preferido para restringir endpoints individuales. Definido en [apps/api/plane/app/permissions/base.py:19-88](../apps/api/plane/app/permissions/base.py#L19-L88).

**Firma:**

```python
@allow_permission(
    allowed_roles: list[ROLE],
    level: str = "PROJECT",   # "PROJECT" o "WORKSPACE"
    creator: bool = False,    # si True, el creador del objeto puede pasar aunque su rol no esté en allowed_roles
    model: Model = None,      # modelo a consultar para verificar quién creó el objeto
)
```

**Comportamiento con `creator=True`** (líneas 24 –38): el decorador recupera el objeto por `kwargs["pk"]` y compara `obj.created_by` con el usuario de la petición. Si coinciden, el acceso se concede sin importar el rol. Solo aplica a endpoints de detalle (retrieve / update / destroy).

**Elevación cruzada workspace → proyecto** (líneas 62 –78): si el nivel es `"PROJECT"` y el rol del usuario en el **proyecto** no está en `allowed_roles`, el decorador comprueba si el usuario es **Admin del workspace**. Si lo es y además es miembro del proyecto, la petición es aprobada. Esta regla otorga a los workspace Admins el equivalente a project Admin en cualquier proyecto al que pertenezcan.

---

## Gating en el frontend

### Hook principal

`useUserPermissions()` — [apps/web/core/hooks/store/user/user-permissions.ts:13-18](../apps/web/core/hooks/store/user/user-permissions.ts#L13-L18)

Retorna el store `UserPermissionStore` ([apps/web/ce/store/user/permission.store.ts:15-34](../apps/web/ce/store/user/permission.store.ts#L15-L34)), que extiende `BaseUserPermissionStore` en [apps/web/core/store/user/base-permissions.store.ts](../apps/web/core/store/user/base-permissions.store.ts).

Métodos clave:

| Método                                                | Ubicación                         | Propósito                                                                                                                   |
| ----------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `getWorkspaceRoleByWorkspaceSlug(slug)`               | base-permissions.store.ts:109-114 | Rol del usuario en un workspace                                                                                             |
| `getProjectRoleByWorkspaceSlugAndProjectId(slug, id)` | ce/permission.store.ts:26-29      | Rol del usuario en un proyecto                                                                                              |
| `getProjectRole()` (internal)                         | base-permissions.store.ts:122-129 | **Aplica la misma regla de elevación**: si el rol del workspace es Admin, retorna `EUserPermissions.ADMIN` para el proyecto |
| `allowPermissions(roles[], level, slug?, projectId?)` | base-permissions.store.ts:191-229 | **La función central de gating** — retorna `true`/`false` y ejecuta callback opcional                                       |

### Layouts de autorización

- `WorkspaceAuthWrapper` — [apps/web/core/layouts/auth-layout/workspace-wrapper.tsx:49](../apps/web/core/layouts/auth-layout/workspace-wrapper.tsx#L49): calcula `canPerformWorkspaceMemberActions` (Admin o Member) en la línea 66-69.
- `ProjectAuthWrapper` — [apps/web/core/layouts/auth-layout/project-wrapper.tsx:48](../apps/web/core/layouts/auth-layout/project-wrapper.tsx#L48): verifica rol de proyecto en línea 68-73 e `isWorkspaceAdmin` en línea 75.
- Settings wrapper — [apps/web/app/(all)/[workspaceSlug]/(settings)/settings/(workspace)/layout.tsx:35-48](../apps/web/app/%28 all%29/%5 BworkspaceSlug%5 D/%28 settings%29/settings/%28 workspace%29/layout.tsx#L35-L48): Guests reciben `<NotAuthorizedView />` directamente.

### Tablas ACL de settings

**Workspace settings** — [packages/constants/src/settings/workspace.ts:23-74](../packages/constants/src/settings/workspace.ts#L23-L74):

| Sección                   | Roles permitidos    |
| ------------------------- | ------------------- |
| General, Members, Export  | Admin y Member      |
| Billing & Plans, Webhooks | Admin únicamente    |
| Cualquier sección         | Guests — sin acceso |

**Project settings** — [packages/constants/src/settings/project.ts:25-103](../packages/constants/src/settings/project.ts#L25-L103):

| Sección                          | Roles permitidos                                |
| -------------------------------- | ----------------------------------------------- |
| General, Members                 | Admin, Member y Guest (solo lectura para Guest) |
| States, Labels                   | Admin y Member                                  |
| Features, Estimates, Automations | Admin únicamente                                |

**Sidebar del workspace** — [packages/constants/src/workspace.ts:201-274](../packages/constants/src/workspace.ts#L201-L274):

| Item de navegación                       | Roles con acceso          |
| ---------------------------------------- | ------------------------- |
| Home, Projects, Views, Inbox, Stickies   | Admin, Member, Guest      |
| Analytics, Archives, "Your work", Drafts | Admin y Member únicamente |

**Proyecto** — [apps/web/ce/components/navigations/use-navigation-items.ts](../apps/web/ce/components/navigations/use-navigation-items.ts#L41-L108):

| Tab de navegación                | Roles con acceso          |
| -------------------------------- | ------------------------- |
| Work Items, Views, Pages, Intake | Admin, Member, Guest      |
| Cycles, Modules                  | Admin y Member únicamente |

### Sitios de gating representativos en UI

| Acción en la UI                         | Archivo                                                                                                                      | Roles requeridos                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Botón "Crear proyecto" (header)         | [project/header.tsx:35-38](../apps/web/core/components/project/header.tsx#L35-L38)                                           | Admin, Member @ workspace                       |
| "Crear workspace" (sidebar)             | [workspace-menu-root.tsx:191](../apps/web/core/components/workspace/sidebar/workspace-menu-root.tsx#L191)                    | Sin guard — cualquier autenticado               |
| Quick action "Crear issue" (sidebar)    | [quick-actions.tsx:42-44](../apps/web/core/components/workspace/sidebar/quick-actions.tsx#L42-L44)                           | Admin, Member @ workspace                       |
| Menú de acciones sobre work item        | [project-issue.tsx:63-64](../apps/web/core/components/issues/issue-layouts/quick-action-dropdowns/project-issue.tsx#L63-L64) | Admin, Member @ proyecto                        |
| Selector de roles al invitar a proyecto | [send-project-invitation-modal.tsx:255-257](../apps/web/core/components/project/send-project-invitation-modal.tsx#L255-L257) | Filtra roles por el workspace role del invitado |

---

## Matriz de permisos completa

`A(W)` = Admin del workspace, `M(W)` = Member del workspace, `G(W)` = Guest del workspace.
`A(P)` = Admin del proyecto, `M(P)` = Member del proyecto, `G(P)` = Guest del proyecto.

### Workspace

| Operación                                                   | Roles permitidos                                      | Referencia                                                                                                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crear workspace                                             | Cualquier usuario autenticado (se convierte en Admin) | [permissions/workspace.py:25-26](../apps/api/plane/app/permissions/workspace.py#L25-L26)                                                                   |
| Actualizar workspace                                        | A(W)                                                  | [workspace/base.py:172](../apps/api/plane/app/views/workspace/base.py#L172)                                                                                |
| Eliminar workspace                                          | A(W)                                                  | [workspace/base.py:183](../apps/api/plane/app/views/workspace/base.py#L183)                                                                                |
| Invitar miembros al workspace                               | A(W), M(W)                                            | [workspace/invite.py:43](../apps/api/plane/app/views/workspace/invite.py#L43)                                                                              |
| Actualizar rol de miembro                                   | A(W)                                                  | [workspace/member.py:76](../apps/api/plane/app/views/workspace/member.py#L76)                                                                              |
| Eliminar miembro del workspace                              | A(W)                                                  | [workspace/member.py:98](../apps/api/plane/app/views/workspace/member.py#L98)                                                                              |
| Abandonar workspace                                         | Cualquier miembro                                     | [workspace/member.py:160](../apps/api/plane/app/views/workspace/member.py#L160)                                                                            |
| Ver ciclos / módulos a nivel workspace                      | A(W), M(W), G(W)                                      | [workspace/cycle.py:20](../apps/api/plane/app/views/workspace/cycle.py#L20), [workspace/module.py:20](../apps/api/plane/app/views/workspace/module.py#L20) |
| Gestionar estados / estimaciones / labels a nivel workspace | A(W), M(W)                                            | [workspace/state.py:18](../apps/api/plane/app/views/workspace/state.py#L18)                                                                                |

### Proyecto

| Operación                              | Roles permitidos                                  | Referencia                                                                           |
| -------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Crear proyecto                         | A(W), M(W) — Guests **no**                        | [project/base.py:252](../apps/api/plane/app/views/project/base.py#L252)              |
| Actualizar proyecto (settings)         | A(W) o A(P)                                       | [project/base.py:311-332](../apps/api/plane/app/views/project/base.py#L311-L332)     |
| Eliminar proyecto                      | A(W) o A(P)                                       | [project/base.py:377-419](../apps/api/plane/app/views/project/base.py#L377-L419)     |
| Archivar / desarchivar proyecto        | A(P), M(P)                                        | [project/base.py:423](../apps/api/plane/app/views/project/base.py#L423)              |
| Añadir miembro al proyecto             | A(P)                                              | [project/member.py:46](../apps/api/plane/app/views/project/member.py#L46)            |
| Actualizar rol de miembro del proyecto | A(P) o A(W) (con reglas de jerarquía adicionales) | [project/member.py:205-258](../apps/api/plane/app/views/project/member.py#L205-L258) |
| Eliminar miembro del proyecto          | A(P)                                              | [project/member.py:267](../apps/api/plane/app/views/project/member.py#L267)          |
| Abandonar proyecto                     | Cualquier miembro                                 | [project/member.py:300](../apps/api/plane/app/views/project/member.py#L300)          |

### Work Items (Issues)

| Operación                            | Roles permitidos                                                                              | Referencia                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Listar / ver work items              | A(P), M(P), G(P) (Guests ven solo los propios si `guest_view_all_features=False`)             | [issue/base.py:252, 300-308](../apps/api/plane/app/views/issue/base.py#L252)                 |
| Crear work item                      | A(P), M(P) — Guests **no**                                                                    | [issue/base.py:391](../apps/api/plane/app/views/issue/base.py#L391)                          |
| Editar / actualizar work item        | A(P), M(P) **o** creador original (cualquier rol)                                             | [issue/base.py:614](../apps/api/plane/app/views/issue/base.py#L614)                          |
| Eliminar work item                   | A(P) **o** creador original                                                                   | [issue/base.py:703](../apps/api/plane/app/views/issue/base.py#L703)                          |
| Eliminar múltiples work items (bulk) | A(P)                                                                                          | [issue/base.py:761](../apps/api/plane/app/views/issue/base.py#L761)                          |
| **Asignar work item a un usuario**   | El asignado debe tener `role >= 15` (Member o Admin) — Guests son descartados silenciosamente | [serializers/issue.py:148-155](../apps/api/plane/app/serializers/issue.py#L148-L155)         |
| Crear sub-issue                      | A(P), M(P) (Guest: solo lectura)                                                              | [issue/sub_issue.py:34](../apps/api/plane/app/views/issue/sub_issue.py#L34)                  |
| Crear comentario                     | Todos los miembros (Guest limitado a issues propias si `guest_view_all_features=False`)       | [issue/comment.py:63-81](../apps/api/plane/app/views/issue/comment.py#L63-L81)               |
| Editar / eliminar comentario propio  | Creador original (cualquier rol)                                                              | [issue/comment.py:109, 144](../apps/api/plane/app/views/issue/comment.py#L109)               |
| Subir adjunto                        | Todos los miembros del proyecto                                                               | [issue/attachment.py:36, 98](../apps/api/plane/app/views/issue/attachment.py#L36)            |
| Eliminar adjunto                     | A(P) **o** quien lo subió                                                                     | [issue/attachment.py:61, 148](../apps/api/plane/app/views/issue/attachment.py#L61)           |
| Reaccionar a comentario / issue      | Todos los miembros                                                                            | issue/reaction.py, [issue/comment.py:183](../apps/api/plane/app/views/issue/comment.py#L183) |
| Crear issue en Intake                | Todos los miembros del proyecto                                                               | [intake/base.py:221, 498](../apps/api/plane/app/views/intake/base.py#L221)                   |

### Ciclos, Módulos, Páginas, States y Labels

| Operación                           | Roles permitidos                                   | Referencia                                                                         |
| ----------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Crear / editar ciclo                | A(P), M(P)                                         | [cycle/base.py:270, 335](../apps/api/plane/app/views/cycle/base.py#L270)           |
| Eliminar ciclo                      | A(P) **o** creador                                 | [cycle/base.py:477](../apps/api/plane/app/views/cycle/base.py#L477)                |
| Crear / editar módulo               | A(P), M(P)                                         | [module/base.py:294](../apps/api/plane/app/views/module/base.py#L294)              |
| Eliminar módulo                     | A(P) **o** creador                                 | [module/base.py:723](../apps/api/plane/app/views/module/base.py#L723)              |
| Crear / editar página               | A(P), M(P)                                         | [permissions/page.py:91-94](../apps/api/plane/app/permissions/page.py#L91-L94)     |
| Eliminar página                     | A(P)                                               | [permissions/page.py:108-112](../apps/api/plane/app/permissions/page.py#L108-L112) |
| Crear estado                        | A(P)                                               | [state/base.py:46](../apps/api/plane/app/views/state/base.py#L46)                  |
| Actualizar / eliminar estado        | A(P)                                               | [state/base.py:105, 113](../apps/api/plane/app/views/state/base.py#L105)           |
| Crear / actualizar / eliminar label | A(P)                                               | [issue/label.py:43, 58, 85](../apps/api/plane/app/views/issue/label.py#L43)        |
| Crear / eliminar vista de proyecto  | Crear: cualquier miembro; Eliminar: A(P) o creador | [view/base.py:343, 365](../apps/api/plane/app/views/view/base.py#L343)             |

---

## Comportamientos específicos del rol Guest

Los Guests son miembros de primera clase del workspace y el proyecto, pero con capacidades reducidas:

1. **Sin acceso a settings del workspace** — La constante `WORKSPACE_SETTINGS_ACCESS` excluye a Guests en todas sus entradas ([packages/constants/src/settings/workspace.ts:23-59](../packages/constants/src/settings/workspace.ts#L23-L59)). El layout renderiza `<NotAuthorizedView />`.

2. **Sidebar del workspace recortada** — Las secciones de Analytics, Archives, "Your work" y Drafts no aparecen para Guests ([packages/constants/src/workspace.ts:213, 221, 250, 264](../packages/constants/src/workspace.ts#L213)).

3. **Sin acceso a Cycles ni Modules en el proyecto** — Las pestañas de navegación no se muestran ([use-navigation-items.ts:51, 61](../apps/web/ce/components/navigations/use-navigation-items.ts#L51)).

4. **No pueden ser asignados a work items** — El serializer filtra silenciosamente los Guests de `assignee_ids` con `role__gte=15` ([serializers/issue.py:148-155](../apps/api/plane/app/serializers/issue.py#L148-L155)). La petición tiene éxito pero el Guest simplemente no queda asignado.

5. **Visibilidad de work items limitada por defecto** — Los Guests solo ven las issues que ellos mismos crearon, a menos que el Admin del proyecto habilite `guest_view_all_features = True` en el modelo `Project` ([issue/base.py:300-308](../apps/api/plane/app/views/issue/base.py#L300)).

6. **No pueden crear work items** — Requiere Member o Admin ([issue/base.py:391](../apps/api/plane/app/views/issue/base.py#L391)).

7. **No pueden crear ciclos, módulos ni páginas** — Todas estas operaciones requieren Admin o Member.

8. **No pueden ver el directorio de miembros con detalle** — Los endpoints de `ProjectMemberViewSet` retornan un serializer reducido (`ProjectMemberRoleSerializer`) para peticiones de Guests ([project/member.py:168, 201](../apps/api/plane/app/views/project/member.py#L168)).

9. **No pueden invitar miembros al workspace ni al proyecto** — Workspace invitations requieren Admin/Member ([workspace/invite.py:43](../apps/api/plane/app/views/workspace/invite.py#L43)); añadir miembros a un proyecto requiere Admin ([project/member.py:46](../apps/api/plane/app/views/project/member.py#L46)).

10. **No pueden crear labels ni estados** — Requieren Admin del proyecto.

11. **Lista de proyectos restringida** — Los Guests solo ven proyectos donde son miembros explícitos. Los Members ven adicionalmente proyectos públicos (`network=2`) sin unirse. Los Admins ven todos — [project/base.py:104-217](../apps/api/plane/app/views/project/base.py#L104-L217).

**Excepción — bypass por creador**: aunque un Guest no puede crear work items nuevos, si ya tiene uno creado (por ejemplo porque su rol era Member antes de ser degradado), puede **editarlo y eliminarlo** gracias al parámetro `creator=True` del decorador `@allow_permission`.

---

## Quién puede invitar, cambiar roles y eliminar

| Operación                           | Roles habilitados | Restricciones adicionales                                                                                            | Referencia                                                                                                                         |
| ----------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Invitar usuarios al workspace       | A(W), M(W)        | No puedes invitar a alguien con un rol mayor al tuyo                                                                 | [workspace/invite.py:63-67](../apps/api/plane/app/views/workspace/invite.py#L63-L67)                                               |
| Eliminar invitación de workspace    | A(W), M(W)        | —                                                                                                                    | [workspace/invite.py:43](../apps/api/plane/app/views/workspace/invite.py#L43)                                                      |
| Cambiar rol de miembro en workspace | A(W)              | —                                                                                                                    | [workspace/member.py:76](../apps/api/plane/app/views/workspace/member.py#L76)                                                      |
| Expulsar miembro del workspace      | A(W)              | —                                                                                                                    | [workspace/member.py:98](../apps/api/plane/app/views/workspace/member.py#L98)                                                      |
| Añadir miembro al proyecto          | A(P)              | No puedes asignar un Workspace Guest como Member/Admin del proyecto, ni viceversa                                    | [project/member.py:46, 69-83](../apps/api/plane/app/views/project/member.py#L46)                                                   |
| Cambiar rol de miembro en proyecto  | A(P) o A(W)       | Jerarquía de roles y cross-level checks                                                                              | [project/member.py:205-258](../apps/api/plane/app/views/project/member.py#L205-L258)                                               |
| Expulsar miembro del proyecto       | A(P)              | —                                                                                                                    | [project/member.py:267](../apps/api/plane/app/views/project/member.py#L267)                                                        |
| Eliminar proyecto                   | A(W) o A(P)       | —                                                                                                                    | [project/base.py:377-391](../apps/api/plane/app/views/project/base.py#L377-L391)                                                   |
| Eliminar workspace                  | A(W)              | —                                                                                                                    | [workspace/base.py:183](../apps/api/plane/app/views/workspace/base.py#L183)                                                        |
| Gestionar webhooks y billing        | A(W)              | Solo en workspace settings (UI: [settings/workspace.ts:42, 56](../packages/constants/src/settings/workspace.ts#L42)) | —                                                                                                                                  |
| Activar `guest_view_all_features`   | A(P)              | Toggle en project settings de miembros                                                                               | [project-settings-member-defaults.tsx:188-195](../apps/web/core/components/project/project-settings-member-defaults.tsx#L188-L195) |

---

## Gotchas e inconsistencias

1. **`WorkSpaceAdminPermission` es engañoso**: a pesar del nombre, permite tanto Admin como Member ([permissions/workspace.py:61-71](../apps/api/plane/app/permissions/workspace.py#L61-L71)). Esto hace que `WorkspaceInvitationsViewset` permita a los Members invitar usuarios.

2. **Enum `ROLE` triplicado en backend** ([app/permissions/base.py:13](../apps/api/plane/app/permissions/base.py#L13), [utils/permissions/base.py:13](../apps/api/plane/utils/permissions/base.py#L13), [db/models/project.py:24](../apps/api/plane/db/models/project.py#L24)). En frontend hay tres enums equivalentes más. Todos coinciden hoy, pero son un riesgo de divergencia.

3. **Descarte silencioso de Guests como assignees**: si un Guest es incluido en `assignee_ids`, el servidor no retorna error — simplemente lo elimina de la lista. Esto puede ser confuso en integraciones API directas si no se verifica el `role` antes ([serializers/issue.py:148-155](../apps/api/plane/app/serializers/issue.py#L148-L155)).

4. **Dos copias del decorador `@allow_permission`**: `app/permissions/base.py` (API interna) y `utils/permissions/base.py` (API pública). La versión de `utils` omite la pre-verificación de membresía al workspace en el path `creator=True`. En la práctica raramente diverge, pero es una inconsistencia.

5. **Asimetría en `WorkSpaceBasePermission` para PUT/PATCH**: la clase base permite Admin o Member para métodos de escritura (líneas 33-39), pero el `partial_update` de `WorkSpaceViewSet` agrega un decorador `@allow_permission([ROLE.ADMIN])` (línea 172) que sobreescribe esa permisividad. En la práctica solo Admin puede actualizar el workspace, aunque la clase parezca más permisiva.

6. **La elevación cruzada workspace → proyecto es implícita**: los workspace Admins que sean miembros de un proyecto actúan como project Admin automáticamente. Los workspace Admins que **no** son miembros de un proyecto no tienen derechos dentro de él — deben unirse primero.

7. **El bypass por creador solo funciona en endpoints de detalle** con `pk` en la URL. No aplica a endpoints de lista o creación — [permissions/base.py:36](../apps/api/plane/app/permissions/base.py#L36).

8. **`guest_view_all_features` es un flag por-proyecto, no por-Guest**: afecta a **todos** los Guests de un proyecto a la vez. No se puede personalizar por usuario individual.

9. **`USER_ALLOWED_PERMISSIONS` en el frontend está casi vacío en Community Edition** ([packages/constants/src/user.ts:58-65](../packages/constants/src/user.ts#L58-L65)). Sugiere un sistema de permisos orientado a datos que no está activado en CE — hoy la lógica real vive en cada componente con llamadas a `allowPermissions(...)`.

10. **Degradación de workspace a Guest propaga automáticamente**: cambiar a un usuario a Guest en el workspace fuerza su rol a Guest en todos los proyectos del workspace — [workspace/member.py:88-89](../apps/api/plane/app/views/workspace/member.py#L88-L89). No es reversible automáticamente; hay que restaurar el rol por proyecto manualmente.

11. **Crear workspace no requiere ningún rol previo**: cualquier usuario autenticado puede crear un workspace y se convierte en Admin de este. El flag de instancia `DISABLE_WORKSPACE_CREATION` puede bloquear esto — [workspace/base.py:85-98](../apps/api/plane/app/views/workspace/base.py#L85-L98).

---

## Verificación de las suposiciones iniciales

| Suposición                                        | Estado                    | Detalle                                                                                                                                                                                                                                                          |
| ------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Los 3 roles pueden crear workspaces               | **Correcto**              | Cualquier usuario autenticado puede crear un workspace ([permissions/workspace.py:25-26](../apps/api/plane/app/permissions/workspace.py#L25-L26)). "Guest" es un rol de membresía, no un estado global — un Guest en workspace A puede ser Admin en workspace B. |
| Member y Admin pueden crear proyectos             | **Correcto**              | Requiere ser Member o Admin **del workspace** ([project/base.py:252](../apps/api/plane/app/views/project/base.py#L252)).                                                                                                                                         |
| Solo Member y Admin pueden ser asignados a tareas | **Correcto**              | El serializer filtra con `role__gte=15` ([serializers/issue.py:148-155](../apps/api/plane/app/serializers/issue.py#L148-L155)). El filtro aplica al **proyecto** (no al workspace).                                                                              |
| Member y Admin pueden crear work items            | **Correcto**              | Requiere Member o Admin del **proyecto** ([issue/base.py:391](../apps/api/plane/app/views/issue/base.py#L391)).                                                                                                                                                  |
| Guest no puede hacer nada                         | **Incompleto**            | Guests pueden: comentar (con restricciones), subir adjuntos, crear intake issues, ver issues (con `guest_view_all_features`), editar/eliminar sus propios items (bypass de creador), agregar reacciones y ver project settings en modo lectura.                  |
| Solo Admin puede eliminar cosas                   | **Parcialmente correcto** | Admins pueden eliminar casi todo. Sin embargo el bypass de creador permite que cualquier rol elimine sus propios comentarios, adjuntos y (en proyectos con `creator=True`) sus propios work items y ciclos.                                                      |
