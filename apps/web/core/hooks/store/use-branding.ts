/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useInstance } from "@/hooks/store/use-instance";

const DEFAULT_PLATFORM_NAME = "Plane";

export type TBranding = {
  platformName: string;
  platformLogoUrl: string;
  platformCompactLogoUrl: string;
  platformAccentColor: string;
  hasCustomLogo: boolean;
  hasCustomCompactLogo: boolean;
  hasCustomAccent: boolean;
};

/**
 * Lee la configuración de personalización expuesta por `/api/instances/`
 * y aplica fallbacks razonables para que la app siempre tenga un nombre y
 * un logo aunque el admin no haya configurado nada.
 */
export function useBranding(): TBranding {
  const { config } = useInstance();

  const platformName = (config?.platform_name ?? "").trim() || DEFAULT_PLATFORM_NAME;
  const platformLogoUrl = (config?.platform_logo_url ?? "").trim();
  const platformCompactLogoUrl = (config?.platform_compact_logo_url ?? "").trim();
  const platformAccentColor = (config?.platform_accent_color ?? "").trim();

  return {
    platformName,
    platformLogoUrl,
    platformCompactLogoUrl,
    platformAccentColor,
    hasCustomLogo: platformLogoUrl.length > 0,
    hasCustomCompactLogo: platformCompactLogoUrl.length > 0,
    hasCustomAccent: platformAccentColor.length > 0,
  };
}
