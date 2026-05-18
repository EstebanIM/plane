/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { BellOff } from "lucide-react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { useTranslation } from "@plane/i18n";
// components
import { ProfileSettingsHeading } from "@/components/settings/profile/heading";
import { EmailSettingsLoader } from "@/components/ui/loader/settings/email";
// constants
import { FEATURE_FLAGS } from "@/constants/feature-flags";
// services
import { UserService } from "@/services/user.service";
// local imports
import { NotificationsProfileSettingsForm } from "./email-notification-form";

const userService = new UserService();

export const NotificationsProfileSettings = observer(function NotificationsProfileSettings() {
  const { t } = useTranslation();

  // Fase 4: si las notificaciones por email están deshabilitadas a nivel
  // de instancia, el key de SWR es null y SWR no hace la llamada.
  const emailNotificationsEnabled = FEATURE_FLAGS.ENABLE_EMAIL_NOTIFICATIONS;
  const { data, isLoading } = useSWR(
    emailNotificationsEnabled ? "CURRENT_USER_EMAIL_NOTIFICATION_SETTINGS" : null,
    () => userService.currentUserEmailNotificationSettings()
  );

  if (!emailNotificationsEnabled) {
    return (
      <div className="size-full">
        <ProfileSettingsHeading
          title={t("account_settings.notifications.heading")}
          description={t("account_settings.notifications.description")}
        />
        <div className="mt-7 flex items-start gap-3 rounded-md border border-subtle bg-layer-1 p-4">
          <BellOff className="mt-0.5 size-5 flex-shrink-0 text-tertiary" />
          <div className="flex flex-col gap-1">
            <p className="text-13 font-medium text-primary">
              Las notificaciones por correo electrónico están deshabilitadas en esta instancia.
            </p>
            <p className="text-12 leading-5 text-tertiary">
              Recibirás todos los avisos en el centro de notificaciones de la aplicación (icono de campana). Para
              reactivar el envío por correo se debe coordinar con el administrador.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || isLoading) {
    return <EmailSettingsLoader />;
  }

  return (
    <div className="size-full">
      <ProfileSettingsHeading
        title={t("account_settings.notifications.heading")}
        description={t("account_settings.notifications.description")}
      />
      <div className="mt-7">
        <NotificationsProfileSettingsForm data={data} />
      </div>
    </div>
  );
});
