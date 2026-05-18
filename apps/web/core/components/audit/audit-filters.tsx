/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Input } from "@plane/ui";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";

export type TAuditFiltersState = {
  actor: string;
  project: string[];
  field: string;
  created_at__gte: string;
  created_at__lte: string;
};

type Props = {
  value: TAuditFiltersState;
  onChange: (next: TAuditFiltersState) => void;
  disabled?: boolean;
};

const FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todos los campos" },
  { value: "state", label: "Estado" },
  { value: "priority", label: "Prioridad" },
  { value: "assignees", label: "Asignados" },
  { value: "labels", label: "Etiquetas" },
  { value: "target_date", label: "Fecha de vencimiento" },
  { value: "start_date", label: "Fecha de inicio" },
  { value: "name", label: "Título" },
  { value: "description", label: "Descripción" },
  { value: "estimate_point", label: "Estimación" },
  { value: "cycle", label: "Ciclo" },
  { value: "module", label: "Módulo" },
  { value: "parent", label: "Padre" },
  { value: "link", label: "Enlace" },
  { value: "attachment", label: "Adjunto" },
];

export const AuditFilters = observer(function AuditFilters({ value, onChange, disabled }: Props) {
  const { workspace: workspaceMember } = useMember();
  const { workspaceProjectIds, getProjectById } = useProject();

  const memberIds = workspaceMember?.workspaceMemberIds ?? [];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
      <div className="flex flex-col gap-1">
        <label className="text-12 font-medium text-tertiary" htmlFor="audit-actor">
          Usuario
        </label>
        <select
          id="audit-actor"
          value={value.actor}
          onChange={(e) => onChange({ ...value, actor: e.target.value })}
          disabled={disabled}
          className="h-9 rounded-md border border-subtle bg-layer-1 px-2 text-13"
        >
          <option value="">Todos</option>
          {memberIds.map((id) => {
            const detail = workspaceMember?.getWorkspaceMemberDetails(id);
            const member = detail?.member;
            const label =
              [member?.first_name, member?.last_name].filter(Boolean).join(" ").trim() ||
              member?.display_name ||
              detail?.email ||
              id;
            return (
              <option key={id} value={member?.id ?? id}>
                {label}
              </option>
            );
          })}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-12 font-medium text-tertiary" htmlFor="audit-project">
          Proyecto
        </label>
        <select
          id="audit-project"
          value={value.project[0] ?? ""}
          onChange={(e) => onChange({ ...value, project: e.target.value ? [e.target.value] : [] })}
          disabled={disabled}
          className="h-9 rounded-md border border-subtle bg-layer-1 px-2 text-13"
        >
          <option value="">Todos</option>
          {(workspaceProjectIds ?? []).map((id) => {
            const project = getProjectById(id);
            return (
              <option key={id} value={id}>
                {project?.name ?? id}
              </option>
            );
          })}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-12 font-medium text-tertiary" htmlFor="audit-field">
          Campo
        </label>
        <select
          id="audit-field"
          value={value.field}
          onChange={(e) => onChange({ ...value, field: e.target.value })}
          disabled={disabled}
          className="h-9 rounded-md border border-subtle bg-layer-1 px-2 text-13"
        >
          {FIELD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-12 font-medium text-tertiary" htmlFor="audit-from">
          Desde
        </label>
        <Input
          id="audit-from"
          type="date"
          value={value.created_at__gte}
          onChange={(e) => onChange({ ...value, created_at__gte: e.target.value })}
          disabled={disabled}
          className="h-9 rounded-md border border-subtle bg-layer-1 px-2 text-13"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-12 font-medium text-tertiary" htmlFor="audit-to">
          Hasta
        </label>
        <Input
          id="audit-to"
          type="date"
          value={value.created_at__lte}
          onChange={(e) => onChange({ ...value, created_at__lte: e.target.value })}
          disabled={disabled}
          className="h-9 rounded-md border border-subtle bg-layer-1 px-2 text-13"
        />
      </div>
    </div>
  );
});
