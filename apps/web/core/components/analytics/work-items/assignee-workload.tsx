/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useTranslation } from "@plane/i18n";
import { ChartXAxisProperty, ChartYAxisMetric } from "@plane/types";
// plane web components
import AnalyticsSectionWrapper from "../analytics-section-wrapper";
import PriorityChart from "./priority-chart";

function AssigneeWorkload() {
  const { t } = useTranslation();

  return (
    <AnalyticsSectionWrapper title={t("workspace_analytics.assignee_workload")} className="col-span-1">
      <PriorityChart
        x_axis={ChartXAxisProperty.ASSIGNEES}
        y_axis={ChartYAxisMetric.WORK_ITEM_COUNT}
        group_by={ChartXAxisProperty.STATE_GROUPS}
      />
    </AnalyticsSectionWrapper>
  );
}

export default AssigneeWorkload;
