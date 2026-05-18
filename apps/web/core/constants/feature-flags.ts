/**
 * Banderas globales que ocultan módulos no usados en este despliegue.
 *
 * Solo afectan la UI: los endpoints y modelos del backend siguen activos para
 * no romper merges con upstream `makeplane/plane`. Para reactivar un módulo,
 * cambiar el valor a `true` y rebuild de `apps/web`.
 */
export const FEATURE_FLAGS = {
  ENABLE_CYCLES: false,
  ENABLE_MODULES: false,
  ENABLE_INTEGRATIONS: false,
  ENABLE_WEBHOOKS: false,
  ENABLE_LICENSE_PROMOTION: false,
  // Fase 4: las notificaciones por email están deshabilitadas a nivel de
  // instancia. La sección de preferencias en el perfil muestra solo un
  // mensaje informativo en lugar del formulario de toggles.
  ENABLE_EMAIL_NOTIFICATIONS: false,
} as const;

export type TFeatureFlag = keyof typeof FEATURE_FLAGS;
