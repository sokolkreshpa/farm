"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createFarm, type AdminFormState } from "@/lib/admin/actions";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function NewFarmForm() {
  const t = useTranslations("Admin");
  const tErr = useTranslations("Errors");
  const [state, action, pending] = useActionState<AdminFormState, FormData>(
    createFarm,
    {},
  );
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const err = (key: string) =>
    state.fields?.[key] ? tErr(state.fields[key]) : undefined;

  return (
    <form action={action} className="grid gap-5" noValidate>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{tErr(state.error)}</AlertDescription>
        </Alert>
      )}
      <FormField
        name="name"
        label={t("farmName")}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (!slugEdited) setSlug(slugify(e.target.value));
        }}
        error={err("name")}
      />
      <FormField
        name="slug"
        label={t("slug")}
        value={slug}
        onChange={(e) => {
          setSlug(e.target.value);
          setSlugEdited(true);
        }}
        hint={t("slugHint")}
        error={err("slug")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          name="phone"
          type="tel"
          label={t("phone")}
          error={err("phone")}
        />
        <FormField
          name="email"
          type="email"
          label={t("email")}
          error={err("email")}
        />
      </div>

      <fieldset className="grid gap-4 rounded-2xl border border-border p-4">
        <legend className="px-1 font-heading text-lg font-semibold">
          {t("farmer")}
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            name="farmerFirstName"
            label={t("farmerFirstName")}
            error={err("farmerFirstName")}
          />
          <FormField
            name="farmerLastName"
            label={t("farmerLastName")}
            error={err("farmerLastName")}
          />
        </div>
        <FormField
          name="farmerEmail"
          type="email"
          label={t("farmerEmail")}
          hint={t("farmerHint")}
          error={err("farmerEmail")}
        />
      </fieldset>

      <Button
        type="submit"
        size="lg"
        className="h-12 w-fit text-base"
        disabled={pending}
      >
        {t("create")}
      </Button>
    </form>
  );
}
