"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateCustomer, type FarmFormState } from "@/lib/farm/actions";

type CustomerFormProps = {
  customerId: string;
  farmerNotes: string;
  active: boolean;
};

export function CustomerForm({
  customerId,
  farmerNotes,
  active,
}: CustomerFormProps) {
  const t = useTranslations("FarmCustomers");
  const tErr = useTranslations("Errors");
  const [state, action, pending] = useActionState<FarmFormState, FormData>(
    updateCustomer,
    {},
  );

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="customerId" value={customerId} />
      <div className="grid gap-2">
        <Label htmlFor="farmerNotes">{t("notes")}</Label>
        <Textarea
          id="farmerNotes"
          name="farmerNotes"
          defaultValue={farmerNotes}
          maxLength={2000}
        />
        <p className="text-sm text-muted-foreground">{t("notesHint")}</p>
      </div>
      <Label className="flex items-center gap-3 font-normal">
        <Checkbox name="active" defaultChecked={active} className="size-5" />
        {t("active")}
      </Label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        {state.success && (
          <span role="status" className="text-sm text-primary">
            {t("saved")}
          </span>
        )}
        {state.error && (
          <span role="alert" className="text-sm text-destructive">
            {tErr(state.error)}
          </span>
        )}
      </div>
    </form>
  );
}
