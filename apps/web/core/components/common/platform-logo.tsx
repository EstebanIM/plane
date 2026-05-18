/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { PlaneLockup } from "@plane/propel/icons";
import { cn } from "@plane/utils";
// hooks
import { useBranding } from "@/hooks/store/use-branding";

type Props = {
  /** Altura nominal en px. Aplica al `<img>` cuando hay logo custom. */
  height?: number;
  /** Ancho nominal en px. Aplica al `<img>` cuando hay logo custom. */
  width?: number;
  className?: string;
  /** Si es true, se prioriza el logo compacto (favicon-style). */
  compact?: boolean;
};

/**
 * Renderiza el logo configurado por el administrador de la instancia.
 * Si no hay logo configurado, hace fallback al `PlaneLockup` original.
 */
export const PlatformLogo = observer(function PlatformLogo(props: Props) {
  const { height = 20, width = 95, className, compact = false } = props;
  const { platformName, platformLogoUrl, platformCompactLogoUrl, hasCustomLogo, hasCustomCompactLogo } = useBranding();

  const targetUrl = compact && hasCustomCompactLogo ? platformCompactLogoUrl : platformLogoUrl;
  const shouldShowCustom = compact ? hasCustomCompactLogo || hasCustomLogo : hasCustomLogo;

  if (shouldShowCustom && targetUrl) {
    return (
      <img
        src={targetUrl}
        alt={`${platformName} logo`}
        height={height}
        width={width}
        className={cn("object-contain", className)}
        style={{ height, maxWidth: width }}
      />
    );
  }

  return <PlaneLockup height={height} width={width} className={cn("text-primary", className)} />;
});
