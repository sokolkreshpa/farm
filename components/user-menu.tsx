"use client";

import { CircleUserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { signOut } from "@/lib/auth/actions";

type UserMenuProps = {
  name: string;
  role: "CUSTOMER" | "FARMER" | "PLATFORM_ADMIN";
};

export function UserMenu({ name, role }: UserMenuProps) {
  const t = useTranslations("Nav");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <CircleUserRound className="size-5" aria-hidden />
          <span className="max-w-28 truncate">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {role === "FARMER" && (
          <DropdownMenuItem asChild>
            <Link href="/farm">{t("farmDashboard")}</Link>
          </DropdownMenuItem>
        )}
        {role === "PLATFORM_ADMIN" && (
          <DropdownMenuItem asChild>
            <Link href="/admin">{t("admin")}</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/account/orders">{t("myOrders")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account">{t("myAccount")}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              {t("logout")}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
