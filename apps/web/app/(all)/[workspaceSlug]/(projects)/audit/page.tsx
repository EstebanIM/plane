/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// components
import { AuditRoot } from "@/components/audit/audit-root";
import { PageHead } from "@/components/core/page-title";

const AuditPage = observer(function AuditPage() {
  return (
    <>
      <PageHead title="Auditoría" />
      <AuditRoot />
    </>
  );
});

export default AuditPage;
