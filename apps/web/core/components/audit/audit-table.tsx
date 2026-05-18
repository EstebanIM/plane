/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { renderFormattedDate } from "@plane/utils";
// services
import type { TWorkspaceAuditEvent } from "@/services/audit.service";

type Props = {
  events: TWorkspaceAuditEvent[];
};

function formatActor(event: TWorkspaceAuditEvent): string {
  const detail = event.actor_detail;
  if (!detail) return "Sistema";
  const fullName = [detail.first_name, detail.last_name].filter(Boolean).join(" ").trim();
  return fullName || detail.display_name || detail.email || "Usuario";
}

function formatFieldChange(event: TWorkspaceAuditEvent): string {
  if (!event.field) {
    return event.verb;
  }
  const oldValue = event.old_value?.trim();
  const newValue = event.new_value?.trim();
  if (oldValue && newValue) {
    return `${event.field}: "${oldValue}" → "${newValue}"`;
  }
  if (newValue) {
    return `${event.field}: "${newValue}"`;
  }
  if (oldValue) {
    return `${event.field}: limpió "${oldValue}"`;
  }
  return event.field;
}

function formatTarget(event: TWorkspaceAuditEvent): string {
  if (event.issue_detail && event.project_detail) {
    return `${event.project_detail.identifier}-${event.issue_detail.sequence_id} · ${event.issue_detail.name}`;
  }
  if (event.project_detail) {
    return event.project_detail.name;
  }
  return "—";
}

export const AuditTable = observer(function AuditTable({ events }: Props) {
  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-13">
        <thead className="sticky top-0 z-1 border-b border-subtle bg-layer-2 text-12 text-tertiary">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Fecha</th>
            <th className="px-3 py-2 text-left font-medium">Usuario</th>
            <th className="px-3 py-2 text-left font-medium">Acción</th>
            <th className="px-3 py-2 text-left font-medium">Objetivo</th>
            <th className="px-3 py-2 text-left font-medium">Proyecto</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-b border-subtle hover:bg-layer-2">
              <td className="px-3 py-2 whitespace-nowrap text-tertiary">{renderFormattedDate(event.created_at)}</td>
              <td className="px-3 py-2 font-medium text-primary">{formatActor(event)}</td>
              <td className="px-3 py-2 text-secondary">{formatFieldChange(event)}</td>
              <td className="px-3 py-2 text-secondary">{formatTarget(event)}</td>
              <td className="px-3 py-2 whitespace-nowrap text-tertiary">{event.project_detail?.name ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
