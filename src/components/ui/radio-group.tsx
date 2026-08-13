"use client";

import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

function RadioGroup<Value>({ className, ...props }: RadioGroupPrimitive.Props<Value>) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("flex flex-wrap gap-1.5", className)}
      {...props}
    />
  );
}

const radioOptionVariants = cva(
  "cursor-pointer rounded-md border border-border/60 bg-card text-left transition-colors outline-none select-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[checked]:border-primary data-[checked]:bg-primary/10 data-[checked]:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
  {
    variants: {
      variant: {
        /** 緊湊分段選項，用於目標屬性、人數這類並排短標籤。 */
        chip: "inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-sm",
        /** 區塊選項，可容納標題與補充說明，並顯示圓點。 */
        card: "flex w-full items-start gap-2.5 px-3 py-2.5 text-sm",
      },
    },
    defaultVariants: { variant: "chip" },
  },
);

function RadioOption<Value>({
  className,
  variant = "chip",
  children,
  ...props
}: RadioPrimitive.Root.Props<Value> & VariantProps<typeof radioOptionVariants>) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-option"
      className={cn(radioOptionVariants({ variant }), className)}
      {...props}
    >
      {variant === "card" && (
        <span
          aria-hidden
          className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-input bg-background in-data-[checked]:border-primary"
        >
          <RadioPrimitive.Indicator className="size-2 rounded-full bg-primary" />
        </span>
      )}
      <span className="min-w-0">{children}</span>
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioOption };
