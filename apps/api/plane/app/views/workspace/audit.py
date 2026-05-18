# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db.models import Q
from django.utils.dateparse import parse_datetime

# Module imports
from plane.app.permissions import WorkspaceOwnerPermission
from plane.app.serializers import IssueActivitySerializer
from plane.app.views.base import BaseAPIView
from plane.db.models import IssueActivity


class WorkspaceAuditActivityEndpoint(BaseAPIView):
    """
    Endpoint agregado de auditoría a nivel workspace (Fase 6).

    Solo los administradores del workspace pueden ver esta vista. Devuelve los
    eventos de `IssueActivity` de todos los proyectos del workspace al que
    pertenece el usuario, con filtros opcionales por:

    - `actor`: id del usuario que generó el evento
    - `project`: id (o ids) del proyecto. Se acepta tanto `?project=<uuid>` como
      múltiples valores (`?project=<uuid1>&project=<uuid2>`).
    - `field`: campo del evento (ej. `state`, `priority`, `assignees`).
    - `created_at__gte`, `created_at__lte`: rango de fechas ISO 8601.

    Excluye eventos sintéticos (`comment`, `vote`, `reaction`, `draft`) que ya
    se exponen a través de los hilos de comentarios. La respuesta usa el
    paginador estándar (cursor).
    """

    permission_classes = [WorkspaceOwnerPermission]
    use_read_replica = True

    def get(self, request, slug):
        queryset = (
            IssueActivity.objects.filter(workspace__slug=slug)
            .filter(~Q(field__in=["comment", "vote", "reaction", "draft"]))
            .select_related("actor", "workspace", "issue", "project")
        )

        actor = request.query_params.get("actor")
        if actor:
            queryset = queryset.filter(actor_id=actor)

        projects = request.query_params.getlist("project", [])
        if projects:
            queryset = queryset.filter(project_id__in=projects)

        field = request.query_params.get("field")
        if field:
            queryset = queryset.filter(field=field)

        created_at_gte = request.query_params.get("created_at__gte")
        if created_at_gte:
            parsed_gte = parse_datetime(created_at_gte)
            if parsed_gte is not None:
                queryset = queryset.filter(created_at__gte=parsed_gte)

        created_at_lte = request.query_params.get("created_at__lte")
        if created_at_lte:
            parsed_lte = parse_datetime(created_at_lte)
            if parsed_lte is not None:
                queryset = queryset.filter(created_at__lte=parsed_lte)

        return self.paginate(
            order_by=request.GET.get("order_by", "-created_at"),
            request=request,
            queryset=queryset,
            on_results=lambda issue_activities: IssueActivitySerializer(issue_activities, many=True).data,
        )
