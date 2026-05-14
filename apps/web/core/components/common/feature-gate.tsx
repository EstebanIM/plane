/**
 * Componente envoltorio que oculta una ruta cuando la feature está deshabilitada.
 *
 * Uso:
 *   <FeatureGate flag="ENABLE_CYCLES">
 *     <CyclesPage />
 *   </FeatureGate>
 *
 * Si `FEATURE_FLAGS[flag]` es `false`, redirige al inicio del workspace actual.
 */

import type { ReactNode } from "react";
import { Navigate, useParams } from "react-router";
import { FEATURE_FLAGS, type TFeatureFlag } from "@/constants/feature-flags";

type FeatureGateProps = {
  flag: TFeatureFlag;
  children: ReactNode;
};

export function FeatureGate({ flag, children }: FeatureGateProps) {
  const { workspaceSlug } = useParams<{ workspaceSlug?: string }>();

  if (!FEATURE_FLAGS[flag]) {
    const redirectTo = workspaceSlug ? `/${workspaceSlug}/` : "/";
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
