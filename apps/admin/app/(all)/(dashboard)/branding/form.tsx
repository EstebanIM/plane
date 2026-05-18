/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Controller, useForm } from "react-hook-form";
import { Palette } from "lucide-react";
// plane imports
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IFormattedInstanceConfiguration, TInstanceBrandingConfigurationKeys } from "@plane/types";
import { Input } from "@plane/ui";
import { cn } from "@plane/utils";
// hooks
import { useInstance } from "@/hooks/store";

type IInstanceBrandingForm = {
  config: IFormattedInstanceConfiguration;
};

type BrandingFormValues = Record<TInstanceBrandingConfigurationKeys, string>;

const HEX_COLOR_PATTERN = /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
const URL_PATTERN = /^(https?:\/\/.+|\/.+|data:image\/.+)$/i;

export function InstanceBrandingForm(props: IInstanceBrandingForm) {
  const { config } = props;
  // store
  const { updateInstanceConfigurations } = useInstance();
  // form data
  const {
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BrandingFormValues>({
    defaultValues: {
      PLATFORM_NAME: config["PLATFORM_NAME"] ?? "",
      PLATFORM_LOGO_URL: config["PLATFORM_LOGO_URL"] ?? "",
      PLATFORM_COMPACT_LOGO_URL: config["PLATFORM_COMPACT_LOGO_URL"] ?? "",
      PLATFORM_ACCENT_COLOR: config["PLATFORM_ACCENT_COLOR"] ?? "",
    },
  });

  const previewName = watch("PLATFORM_NAME");
  const previewLogoUrl = watch("PLATFORM_LOGO_URL");
  const previewAccent = watch("PLATFORM_ACCENT_COLOR");

  const onSubmit = async (formData: BrandingFormValues) => {
    const payload: Partial<BrandingFormValues> = { ...formData };

    await updateInstanceConfigurations(payload)
      .then(() =>
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "Listo",
          message: "Personalización guardada correctamente.",
        })
      )
      .catch((err) => {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "No se pudo guardar",
          message: "Revisa los valores e intenta nuevamente.",
        });
        console.error(err);
      });
  };

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div>
          <div className="pb-1 text-18 font-medium text-primary">Identidad</div>
          <div className="text-13 font-regular text-tertiary">
            El nombre se usa en el título de la pestaña del navegador, encabezados y correos. Los logos aparecen en el
            sidebar y la pantalla de inicio de sesión.
          </div>
        </div>
        <div className="grid w-full grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-2">
          <div className="flex flex-col gap-1">
            <h4 className="text-13 text-tertiary">
              Nombre de la plataforma <span className="text-rose-500">*</span>
            </h4>
            <Controller
              control={control}
              name="PLATFORM_NAME"
              rules={{
                required: "El nombre es obligatorio.",
                maxLength: { value: 80, message: "Máximo 80 caracteres." },
              }}
              render={({ field }) => (
                <Input
                  id="PLATFORM_NAME"
                  type="text"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="Plane"
                  hasError={Boolean(errors.PLATFORM_NAME)}
                  className="w-full rounded-md font-medium"
                />
              )}
            />
            {errors.PLATFORM_NAME && <p className="text-rose-500 pt-0.5 text-11">{errors.PLATFORM_NAME.message}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <h4 className="text-13 text-tertiary">Color de acento (hex)</h4>
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="PLATFORM_ACCENT_COLOR"
                rules={{
                  validate: (value) =>
                    !value || HEX_COLOR_PATTERN.test(value) || "Debe ser un color en formato hex (ej. #1f2937).",
                }}
                render={({ field }) => (
                  <Input
                    id="PLATFORM_ACCENT_COLOR"
                    type="text"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="#3b82f6"
                    hasError={Boolean(errors.PLATFORM_ACCENT_COLOR)}
                    className="w-full rounded-md font-medium"
                  />
                )}
              />
              <div
                className={cn("size-10 flex-shrink-0 rounded-md border border-subtle")}
                style={{
                  backgroundColor:
                    previewAccent && HEX_COLOR_PATTERN.test(previewAccent) ? previewAccent : "transparent",
                }}
                aria-hidden
              />
            </div>
            {errors.PLATFORM_ACCENT_COLOR ? (
              <p className="text-rose-500 pt-0.5 text-11">{errors.PLATFORM_ACCENT_COLOR.message}</p>
            ) : (
              <p className="pt-0.5 text-11 text-tertiary">
                Opcional. Se aplica como CSS custom property en la app web.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="pb-1 text-18 font-medium text-primary">Logos</div>
          <div className="text-13 font-regular text-tertiary">
            Pega la URL pública de cada imagen. Acepta URLs absolutas (https://...), rutas relativas (/static/logo.svg)
            o data URIs (data:image/svg+xml;base64,...).
          </div>
        </div>
        <div className="grid w-full grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-2">
          <div className="flex flex-col gap-1">
            <h4 className="text-13 text-tertiary">Logo principal</h4>
            <Controller
              control={control}
              name="PLATFORM_LOGO_URL"
              rules={{
                validate: (value) =>
                  !value || URL_PATTERN.test(value) || "Debe ser una URL absoluta, ruta relativa o data URI.",
              }}
              render={({ field }) => (
                <Input
                  id="PLATFORM_LOGO_URL"
                  type="text"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="https://ejemplo.com/logo.svg"
                  hasError={Boolean(errors.PLATFORM_LOGO_URL)}
                  className="w-full rounded-md font-medium"
                />
              )}
            />
            {errors.PLATFORM_LOGO_URL && (
              <p className="text-rose-500 pt-0.5 text-11">{errors.PLATFORM_LOGO_URL.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <h4 className="text-13 text-tertiary">Logo compacto / favicon</h4>
            <Controller
              control={control}
              name="PLATFORM_COMPACT_LOGO_URL"
              rules={{
                validate: (value) =>
                  !value || URL_PATTERN.test(value) || "Debe ser una URL absoluta, ruta relativa o data URI.",
              }}
              render={({ field }) => (
                <Input
                  id="PLATFORM_COMPACT_LOGO_URL"
                  type="text"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="https://ejemplo.com/favicon.png"
                  hasError={Boolean(errors.PLATFORM_COMPACT_LOGO_URL)}
                  className="w-full rounded-md font-medium"
                />
              )}
            />
            {errors.PLATFORM_COMPACT_LOGO_URL && (
              <p className="text-rose-500 pt-0.5 text-11">{errors.PLATFORM_COMPACT_LOGO_URL.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-subtle bg-layer-1 p-4">
        <div className="flex items-center gap-2">
          <Palette className="size-4 text-tertiary" />
          <span className="text-13 font-medium text-primary">Previsualización</span>
        </div>
        <div className="flex items-center gap-3">
          {previewLogoUrl && URL_PATTERN.test(previewLogoUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewLogoUrl}
              alt="Logo principal"
              className="h-10 max-w-[160px] object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-layer-2 text-12 text-tertiary">
              ?
            </div>
          )}
          <span className="text-16 font-semibold text-primary">{previewName || "Plane"}</span>
        </div>
      </div>

      <div>
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            void handleSubmit(onSubmit)();
          }}
          loading={isSubmitting}
        >
          {isSubmitting ? "Guardando" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
