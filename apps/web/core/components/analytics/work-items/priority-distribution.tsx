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
import { PieChart } from "@plane/propel/charts/pie-chart";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import type { IChartResponse } from "@plane/types";
import { ChartXAxisProperty, ChartYAxisMetric } from "@plane/types";
// hooks
import { useAnalytics } from "@/hooks/store/use-analytics";
// services
import { AnalyticsService } from "@/services/analytics.service";
// plane web components
import AnalyticsSectionWrapper from "../analytics-section-wrapper";
import { ChartLoader } from "../loaders";

const analyticsService = new AnalyticsService();

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#3b82f6",
  none: "#94a3b8",
};

const PRIORITY_CELLS = Object.entries(PRIORITY_COLORS).map(([key, fill]) => ({ key, fill }));

const PriorityDistribution = observer(function PriorityDistribution() {
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

  const { data: priorityData, isLoading } = useSWR(
    `priority-distribution-${workspaceSlug}-${selectedDuration}-${selectedProjects}-${selectedCycle}-${selectedModule}-${isPeekView}-${isEpic}`,
    () =>
      analyticsService.getAdvanceAnalyticsCharts<IChartResponse>(
        workspaceSlug,
        "custom-work-items",
        {
          x_axis: ChartXAxisProperty.PRIORITY,
          y_axis: ChartYAxisMetric.WORK_ITEM_COUNT,
          ...(selectedProjects?.length > 0 && { project_ids: selectedProjects?.join(",") }),
          ...(selectedCycle ? { cycle_id: selectedCycle } : {}),
          ...(selectedModule ? { module_id: selectedModule } : {}),
          ...(isEpic ? { epic: true } : {}),
        },
        isPeekView
      )
  );

  const chartData = useMemo(() => priorityData?.data ?? [], [priorityData]);

  const activeCells = useMemo(
    () => PRIORITY_CELLS.filter((cell) => chartData.some((d) => d.key === cell.key)),
    [chartData]
  );

  return (
    <AnalyticsSectionWrapper
      title={t("workspace_analytics.priority_distribution")}
      subtitle={selectedDurationLabel}
      className="col-span-1"
    >
      {isLoading ? (
        <ChartLoader />
      ) : chartData.length > 0 ? (
        <PieChart
          className="h-[350px] w-full"
          data={chartData}
          dataKey="count"
          cells={activeCells}
          innerRadius="40%"
          outerRadius="70%"
          paddingAngle={2}
          showLabel
          showTooltip
          tooltipLabel="Priority"
          legend={{
            align: "right",
            verticalAlign: "middle",
            layout: "vertical",
          }}
        />
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

export default PriorityDistribution;
