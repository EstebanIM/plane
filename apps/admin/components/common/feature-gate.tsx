/**
 * Wrapper que oculta una ruta del panel de administración cuando el feature
 * flag asociado está deshabilitado.
 *
 * Uso:
 *   <AdminFeatureGate flag="ENABLE_GITHUB_AUTH">
 *     <InstanceGithubAuthenticationPage />
 *   </AdminFeatureGate>
 *
 * Cuando el flag está en `false`, redirige a `/authentication` para que el
 * administrador vea solo los proveedores soportados.
 */

import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { ADMIN_FEATURE_FLAGS, type TAdminFeatureFlag } from "@/constants/feature-flags";

type Props = {
  flag: TAdminFeatureFlag;
  /** Ruta a la que redirigir cuando el flag está apagado. Default `/authentication`. */
  fallbackTo?: string;
  children: ReactNode;
};

export function AdminFeatureGate({ flag, fallbackTo = "/authentication", children }: Props) {
  if (!ADMIN_FEATURE_FLAGS[flag]) {
    return <Navigate to={fallbackTo} replace />;
  }
  return <>{children}</>;
}
