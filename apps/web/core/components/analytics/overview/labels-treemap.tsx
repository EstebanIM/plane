/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// plane package imports
import { useTranslation } from "@plane/i18n";
import { TreeMapChart } from "@plane/propel/charts/tree-map";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import type { IChartResponse, TreeMapItem } from "@plane/types";
import { ChartXAxisProperty, ChartYAxisMetric } from "@plane/types";
// hooks
import { useAnalytics } from "@/hooks/store/use-analytics";
// services
import { AnalyticsService } from "@/services/analytics.service";
// plane web components
import AnalyticsSectionWrapper from "../analytics-section-wrapper";
import { ChartLoader } from "../loaders";

const analyticsService = new AnalyticsService();

const LABEL_FILL_COLORS = [
  "#1192E8",
  "#198038",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#f97316",
  "#14b8a6",
  "#6366f1",
];

const LabelsTreeMap = observer(function LabelsTreeMap() {
  const params = useParams();
  const { t } = useTranslation();
  const workspaceSlug = params.workspaceSlug.toString();
  const {
    selectedDuration,
    selectedDurationLabel,
    selectedProjects,
    selectedCycle,
    selectedModule,
    isPeekView,
    isEpic,
  } = useAnalytics();

  const { data: labelData, isLoading } = useSWR(
    `labels-treemap-${workspaceSlug}-${selectedDuration}-${selectedProjects}-${selectedCycle}-${selectedModule}-${isPeekView}-${isEpic}`,
    () =>
      analyticsService.getAdvanceAnalyticsCharts<IChartResponse>(
        workspaceSlug,
        "custom-work-items",
        {
          x_axis: ChartXAxisProperty.LABELS,
          y_axis: ChartYAxisMetric.WORK_ITEM_COUNT,
          ...(selectedProjects?.length > 0 && { project_ids: selectedProjects?.join(",") }),
          ...(selectedCycle ? { cycle_id: selectedCycle } : {}),
          ...(selectedModule ? { module_id: selectedModule } : {}),
          ...(isEpic ? { epic: true } : {}),
        },
        isPeekView
      )
  );

  const treeMapData: TreeMapItem[] = useMemo(
    () =>
      (labelData?.data ?? []).map((item, index) => ({
        name: item.name as string,
        value: item.count as number,
        fillColor: LABEL_FILL_COLORS[index % LABEL_FILL_COLORS.length],
        label: `${item.count}`,
      })),
    [labelData]
  );

  return (
    <AnalyticsSectionWrapper
      title={t("workspace_analytics.labels_treemap")}
      subtitle={selectedDurationLabel}
      className="col-span-1"
    >
      {isLoading ? (
        <ChartLoader />
      ) : treeMapData.length > 0 ? (
        <TreeMapChart className="h-[350px] w-full" data={treeMapData} showTooltip />
      ) : (
        <EmptyStateCompact
          assetKey="unknown"
          assetClassName="size-20"
          rootClassName="border border-subtle px-5 py-10 md:py-20 md:px-20"
          title={t("workspace_empty_state.analytics_work_items.title")}
        />
      )}
    </AnalyticsSectionWrapper>
  );
});

export default LabelsTreeMap;
