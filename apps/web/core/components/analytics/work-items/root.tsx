/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import AnalyticsWrapper from "../analytics-wrapper";
import TotalInsights from "../total-insights";
import AssigneeWorkload from "./assignee-workload";
import CreatedVsResolved from "./created-vs-resolved";
import CreationTrend from "./creation-trend";
import CustomizedInsights from "./customized-insights";
import PriorityDistribution from "./priority-distribution";
import WorkItemsInsightTable from "./workitems-insight-table";

function WorkItems() {
  return (
    <AnalyticsWrapper i18nTitle="sidebar.work_items">
      <div className="flex flex-col gap-14">
        <TotalInsights analyticsType="work-items" />
        <div className="grid grid-cols-1 gap-14 md:grid-cols-2">
          <CreatedVsResolved />
          <CreationTrend />
        </div>
        <PriorityDistribution />
        <AssigneeWorkload />
        <CustomizedInsights />
        <WorkItemsInsightTable />
      </div>
    </AnalyticsWrapper>
  );
}

export { WorkItems };
