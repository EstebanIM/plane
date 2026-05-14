/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Navigate, useParams } from "react-router";
import useSWR from "swr";
// components
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
// local constants
import { FEATURE_FLAGS } from "@/constants/feature-flags";
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { SingleIntegrationCard } from "@/components/integration/single-integration-card";
import { IntegrationAndImportExportBanner } from "@/components/ui/integration-and-import-export-banner";
import { IntegrationsSettingsLoader } from "@/components/ui/loader/settings/integration";
// constants
import { APP_INTEGRATIONS } from "@/constants/fetch-keys";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions } from "@/hooks/store/user";
// services
import { IntegrationService } from "@/services/integrations";

const integrationService = new IntegrationService();

function WorkspaceIntegrationsPage() {
  // route params
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  // store hooks
  const { currentWorkspace } = useWorkspace();
  const { allowPermissions } = useUserPermissions();

  // derived values
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);
  const pageTitle = currentWorkspace?.name ? `${currentWorkspace.name} - Integrations` : undefined;
  const { data: appIntegrations } = useSWR(isAdmin ? APP_INTEGRATIONS : null, () =>
    isAdmin ? integrationService.getAppIntegrationsList() : null
  );

  if (!FEATURE_FLAGS.ENABLE_INTEGRATIONS) {
    return <Navigate to={`/${workspaceSlug ?? ""}/`} replace />;
  }

  if (!isAdmin) return <NotAuthorizedView section="settings" className="h-auto" />;

  return (
    <>
      <PageHead title={pageTitle} />
      <section className="w-full overflow-y-auto">
        <IntegrationAndImportExportBanner bannerName="Integrations" />
        <div>
          {appIntegrations ? (
            appIntegrations.map((integration) => (
              <SingleIntegrationCard key={integration.id} integration={integration} />
            ))
          ) : (
            <IntegrationsSettingsLoader />
          )}
        </div>
      </section>
    </>
  );
}

export default observer(WorkspaceIntegrationsPage);
