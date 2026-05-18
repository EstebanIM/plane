/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TInstanceAuthenticationModes } from "@plane/types";
import { ADMIN_FEATURE_FLAGS } from "@/constants/feature-flags";
import { getCoreAuthenticationModesMap } from "./core";
import type { TGetAuthenticationModeProps } from "./types";

export const useAuthenticationModes = (props: TGetAuthenticationModeProps): TInstanceAuthenticationModes[] => {
  // derived values
  const authenticationModes = getCoreAuthenticationModesMap(props);

  // Fase 3: solo se exponen los proveedores que el fork acepta. Para reactivar
  // alguno, cambiar el flag en `apps/admin/constants/feature-flags.ts`.
  const availableAuthenticationModes: TInstanceAuthenticationModes[] = [
    ...(ADMIN_FEATURE_FLAGS.ENABLE_MAGIC_LINK_AUTH ? [authenticationModes["unique-codes"]] : []),
    ...(ADMIN_FEATURE_FLAGS.ENABLE_EMAIL_PASSWORD_AUTH ? [authenticationModes["passwords-login"]] : []),
    ...(ADMIN_FEATURE_FLAGS.ENABLE_GOOGLE_AUTH ? [authenticationModes["google"]] : []),
    ...(ADMIN_FEATURE_FLAGS.ENABLE_GITHUB_AUTH ? [authenticationModes["github"]] : []),
    ...(ADMIN_FEATURE_FLAGS.ENABLE_GITLAB_AUTH ? [authenticationModes["gitlab"]] : []),
    ...(ADMIN_FEATURE_FLAGS.ENABLE_GITEA_AUTH ? [authenticationModes["gitea"]] : []),
  ];

  return availableAuthenticationModes;
};
