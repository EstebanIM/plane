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
import { LineChart } from "@plane/propel/charts/line-chart";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import type { IChartResponse, TChartData } from "@plane/types";
import { ChartXAxisProperty, ChartYAxisMetric } from "@plane/types";
import { renderFormattedDate } from "@plane/utils";
// hooks
import { useAnalytics } from "@/hooks/store/use-analytics";
// services
import { AnalyticsService } from "@/services/analytics.service";
// plane web components
import AnalyticsSectionWrapper from "../analytics-section-wrapper";
import { ChartLoader } from "../loaders";

const analyticsService = new AnalyticsService();

const PRIORITY_LINE_CONFIG = [
  { key: "urgent", stroke: "#ef4444" },
  { key: "high", stroke: "#f97316" },
  { key: "medium", stroke: "#f59e0b" },
  { key: "low", stroke: "#3b82f6" },
  { key: "none", stroke: "#94a3b8" },
];

const CreationTrend = observer(function CreationTrend() {
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

  const { data: trendData, isLoading } = useSWR(
    `creation-trend-${workspaceSlug}-${selectedDuration}-${selectedProjects}-${selectedCycle}-${selectedModule}-${isPeekView}-${isEpic}`,
    () =>
      analyticsService.getAdvanceAnalyticsCharts<IChartResponse>(
        workspaceSlug,
        "custom-work-items",
        {
          x_axis: ChartXAxisProperty.CREATED_AT,
          y_axis: ChartYAxisMetric.WORK_ITEM_COUNT,
          group_by: ChartXAxisProperty.PRIORITY,
          ...(selectedProjects?.length > 0 && { project_ids: selectedProjects?.join(",") }),
          ...(selectedCycle ? { cycle_id: selectedCycle } : {}),
          ...(selectedModule ? { module_id: selectedModule } : {}),
          ...(isEpic ? { epic: true } : {}),
        },
        isPeekView
      )
  );

  const parsedData: TChartData<string, string>[] = useMemo(() => {
    if (!trendData?.data) return [];
    return trendData.data.map((datum) => ({
      ...datum,
      name: renderFormattedDate(datum.key as string) ?? (datum.key as string),
    }));
  }, [trendData]);

  const lines = useMemo(
    () =>
      PRIORITY_LINE_CONFIG.map(({ key, stroke }) => ({
        key,
        label: t(`priority.${key}`, { defaultValue: key.charAt(0).toUpperCase() + key.slice(1) }),
        stroke,
        fill: stroke,
        showDot: false,
        smoothCurves: true,
        dashedLine: false,
      })),
    [t]
  );

  return (
    <AnalyticsSectionWrapper
      title={t("workspace_analytics.creation_trend")}
      subtitle={selectedDurationLabel}
      className="col-span-1"
    >
      {isLoading ? (
        <ChartLoader />
      ) : parsedData.length > 0 ? (
        <LineChart
          className="h-[350px] w-full"
          data={parsedData}
          lines={lines}
          xAxis={{
            key: "name",
            label: t("date"),
          }}
          yAxis={{
            key: "count",
            label: t("common.no_of", { entity: isEpic ? t("epics") : t("work_items") }),
            offset: -60,
            dx: -24,
          }}
          legend={{
            align: "left",
            verticalAlign: "bottom",
            layout: "horizontal",
            wrapperStyles: {
              justifyContent: "start",
              alignContent: "start",
              paddingLeft: "40px",
              paddingTop: "10px",
            },
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

export default CreationTrend;
