/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
// services
import { APIService } from "./api.service";

export type TWorkspaceAuditEvent = {
  id: string;
  actor: string | null;
  actor_detail?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    display_name: string | null;
    email: string | null;
  };
  verb: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  comment: string | null;
  project: string | null;
  project_detail?: {
    id: string;
    name: string;
    identifier: string;
  };
  issue: string | null;
  issue_detail?: {
    id: string;
    name: string;
    sequence_id: number;
    priority: string;
  };
  workspace: string;
  created_at: string;
  updated_at: string;
};

export type TWorkspaceAuditFilters = {
  actor?: string;
  project?: string[];
  field?: string;
  created_at__gte?: string;
  created_at__lte?: string;
  cursor?: string;
  per_page?: number;
};

export type TPaginatedResponse<T> = {
  count: number;
  next_cursor: string | null;
  prev_cursor: string | null;
  next_page_results: boolean;
  prev_page_results: boolean;
  total_pages?: number;
  results: T[];
};

/**
 * Cliente del endpoint agregado de auditoría a nivel workspace (Fase 6).
 *
 * Solo los administradores del workspace pueden invocar este endpoint;
 * cualquier otro rol recibirá un 403.
 */
export class WorkspaceAuditService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async list(
    workspaceSlug: string,
    filters: TWorkspaceAuditFilters = {}
  ): Promise<TPaginatedResponse<TWorkspaceAuditEvent>> {
    const params: Record<string, unknown> = {};
    if (filters.actor) params.actor = filters.actor;
    if (filters.project && filters.project.length > 0) params.project = filters.project;
    if (filters.field) params.field = filters.field;
    if (filters.created_at__gte) params.created_at__gte = filters.created_at__gte;
    if (filters.created_at__lte) params.created_at__lte = filters.created_at__lte;
    if (filters.cursor) params.cursor = filters.cursor;
    if (filters.per_page) params.per_page = filters.per_page;

    return this.get(`/api/workspaces/${workspaceSlug}/audit/activities/`, {
      params,
    })
      .then((res) => res?.data)
      .catch((err) => {
        throw err?.response?.data;
      });
  }
}
