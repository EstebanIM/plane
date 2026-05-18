/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Loader } from "@plane/ui";
import { cn } from "@plane/utils";
// components
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { AuditFilters, type TAuditFiltersState } from "@/components/audit/audit-filters";
import { AuditTable } from "@/components/audit/audit-table";
// hooks
import { useUserPermissions } from "@/hooks/store/user";
// services
import { WorkspaceAuditService, type TWorkspaceAuditEvent } from "@/services/audit.service";

const auditService = new WorkspaceAuditService();

export const AuditRoot = observer(function AuditRoot() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { allowPermissions } = useUserPermissions();
  const canView = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);

  const [filters, setFilters] = useState<TAuditFiltersState>({
    actor: "",
    project: [],
    field: "",
    created_at__gte: "",
    created_at__lte: "",
  });

  const swrKey = useMemo(
    () => (canView && workspaceSlug ? ["WORKSPACE_AUDIT_ACTIVITIES", workspaceSlug, filters] : null),
    [canView, workspaceSlug, filters]
  );

  const { data, isLoading, error } = useSWR(
    swrKey,
    () =>
      auditService.list(workspaceSlug as string, {
        ...(filters.actor ? { actor: filters.actor } : {}),
        ...(filters.project.length > 0 ? { project: filters.project } : {}),
        ...(filters.field ? { field: filters.field } : {}),
        ...(filters.created_at__gte ? { created_at__gte: new Date(filters.created_at__gte).toISOString() } : {}),
        ...(filters.created_at__lte ? { created_at__lte: new Date(filters.created_at__lte).toISOString() } : {}),
        per_page: 50,
      }),
    { revalidateOnFocus: false }
  );

  if (!canView) {
    return <NotAuthorizedView section="general" />;
  }

  const results: TWorkspaceAuditEvent[] = data?.results ?? [];

  return (
    <div className="flex h-full w-full flex-col gap-4 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-20 font-semibold text-primary">Auditoría del workspace</h1>
        <p className="text-13 text-tertiary">
          Eventos registrados de todos los proyectos. Solo los administradores acceden a esta vista. La lista se
          actualiza al cambiar los filtros.
        </p>
      </header>

      <AuditFilters value={filters} onChange={setFilters} disabled={isLoading} />

      <div className={cn("flex-1 overflow-hidden rounded-md border border-subtle bg-layer-1")}>
        {isLoading ? (
          <Loader className="space-y-3 p-4">
            <Loader.Item height="40px" />
            <Loader.Item height="40px" />
            <Loader.Item height="40px" />
            <Loader.Item height="40px" />
            <Loader.Item height="40px" />
          </Loader>
        ) : error ? (
          <div className="text-rose-500 flex h-full items-center justify-center p-8 text-13">
            No se pudo cargar la auditoría. Verifica tu conexión e intenta nuevamente.
          </div>
        ) : results.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-13 text-tertiary">
            No hay eventos que coincidan con los filtros aplicados.
          </div>
        ) : (
          <AuditTable events={results} />
        )}
      </div>
    </div>
  );
});
