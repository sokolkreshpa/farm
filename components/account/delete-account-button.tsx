"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { requestAccountDeletion } from "@/lib/account/actions";

export function DeleteAccountButton() {
  const t = useTranslations("AccountPage");
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="destructive"
      disabled={pending}
      onClick={() => {
        if (window.confirm(t("deleteAccountConfirm"))) {
          startTransition(() => requestAccountDeletion());
        }
      }}
    >
      {t("deleteAccountButton")}
    </Button>
  );
}
