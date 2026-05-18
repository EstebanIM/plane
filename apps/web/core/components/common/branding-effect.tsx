/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
// hooks
import { useBranding } from "@/hooks/store/use-branding";

const HEX_COLOR_PATTERN = /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

function normalizeHex(value: string): string | null {
  if (!HEX_COLOR_PATTERN.test(value)) return null;
  return value.startsWith("#") ? value : `#${value}`;
}

/**
 * Aplica los valores de personalización al documento en runtime:
 * - El title base del navegador (cuando ninguna página lo sobreescribe).
 * - El meta `application-name` para PWAs.
 * - Una CSS custom property `--platform-accent-color` para que componentes
 *   puedan reaccionar al color configurado.
 * - El favicon, si el admin definió un logo compacto.
 *
 * Este componente no renderiza nada y se monta una sola vez bajo el
 * `InstanceWrapper`, donde el store ya cargó el config público.
 */
export const BrandingEffect = observer(function BrandingEffect() {
  const { platformName, platformAccentColor, platformCompactLogoUrl, hasCustomCompactLogo, hasCustomAccent } =
    useBranding();

  // Title y meta application-name.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const currentTitle = document.title;
    // No tocamos el title si una página específica ya lo personalizó vía
    // PageHead (esos siempre incluyen un separador como " - " o "|").
    if (!currentTitle.includes("|") && !currentTitle.includes(" - ")) {
      document.title = platformName;
    }
    const metaAppName = document.querySelector('meta[name="application-name"]');
    if (metaAppName) metaAppName.setAttribute("content", platformName);
    const metaAppleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (metaAppleTitle) metaAppleTitle.setAttribute("content", platformName);
  }, [platformName]);

  // CSS custom property con el color de acento del admin.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const normalized = hasCustomAccent ? normalizeHex(platformAccentColor) : null;
    if (normalized) {
      root.style.setProperty("--platform-accent-color", normalized);
    } else {
      root.style.removeProperty("--platform-accent-color");
    }
  }, [hasCustomAccent, platformAccentColor]);

  // Favicon dinámico cuando hay logo compacto configurado.
  useEffect(() => {
    if (typeof document === "undefined" || !hasCustomCompactLogo) return;
    const links = document.querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
    );
    const previousHrefs = new Map<HTMLLinkElement, string>();
    links.forEach((link) => {
      previousHrefs.set(link, link.href);
      link.href = platformCompactLogoUrl;
    });
    return () => {
      links.forEach((link) => {
        const prev = previousHrefs.get(link);
        if (prev) link.href = prev;
      });
    };
  }, [hasCustomCompactLogo, platformCompactLogoUrl]);

  return null;
});
