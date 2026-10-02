import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormFieldProps = ComponentProps<typeof Input> & {
  name: string;
  label: string;
  /** Already-translated error message. */
  error?: string;
  hint?: string;
};

export function FormField({
  name,
  label,
  error,
  hint,
  id,
  ...inputProps
}: FormFieldProps) {
  const fieldId = id ?? name;
  const describedBy = error
    ? `${fieldId}-error`
    : hint
      ? `${fieldId}-hint`
      : undefined;

  return (
    <div className="grid gap-2">
      <Label htmlFor={fieldId}>{label}</Label>
      <Input
        id={fieldId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="h-11 text-base"
        {...inputProps}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
