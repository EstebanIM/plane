/**
 * Banderas globales que controlan qué proveedores de autenticación expone
 * el panel de administración.
 *
 * Las claves correspondientes en el backend (`IS_GITHUB_ENABLED`,
 * `IS_GITLAB_ENABLED`, `IS_GITEA_ENABLED`, `ENABLE_MAGIC_LINK_LOGIN`) se
 * actualizan en la BD para que la pantalla de login de `apps/web` tampoco
 * muestre los botones.
 *
 * Para reactivar un proveedor, cambiar el valor a `true`, configurar las
 * credenciales correspondientes y poner la clave del backend en `"1"`.
 */
export const ADMIN_FEATURE_FLAGS = {
  ENABLE_EMAIL_PASSWORD_AUTH: true,
  ENABLE_GOOGLE_AUTH: true,
  ENABLE_GITHUB_AUTH: false,
  ENABLE_GITLAB_AUTH: false,
  ENABLE_GITEA_AUTH: false,
  ENABLE_MAGIC_LINK_AUTH: false,
} as const;

export type TAdminFeatureFlag = keyof typeof ADMIN_FEATURE_FLAGS;
