# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import os

# Branding configurable desde el panel de administración de la instancia.
# Las claves se exponen públicamente en /api/instances/ para que cualquier
# cliente (web, admin, space) pueda aplicar el branding sin requerir login.
branding_config_variables = [
    {
        "key": "PLATFORM_NAME",
        "value": os.environ.get("PLATFORM_NAME", "Plane"),
        "category": "BRANDING",
        "is_encrypted": False,
    },
    {
        "key": "PLATFORM_LOGO_URL",
        "value": os.environ.get("PLATFORM_LOGO_URL", ""),
        "category": "BRANDING",
        "is_encrypted": False,
    },
    {
        "key": "PLATFORM_COMPACT_LOGO_URL",
        "value": os.environ.get("PLATFORM_COMPACT_LOGO_URL", ""),
        "category": "BRANDING",
        "is_encrypted": False,
    },
    {
        "key": "PLATFORM_ACCENT_COLOR",
        "value": os.environ.get("PLATFORM_ACCENT_COLOR", ""),
        "category": "BRANDING",
        "is_encrypted": False,
    },
]
