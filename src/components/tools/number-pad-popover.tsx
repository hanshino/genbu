"use client";

import { useState, type ReactElement } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type Props = {
  value: number | null;
  trigger: ReactElement;
  onPick: (n: number | null) => void;
};

export function NumberPadPopover({ value, trigger, onPick }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent className="w-auto p-2">
        <div className="grid grid-cols-3 gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <Button
              key={n}
              variant={value === n ? "default" : "outline"}
              size="sm"
              className="h-11 w-11 text-base"
              onClick={() => {
                onPick(n);
                setOpen(false);
              }}
            >
              {n}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="col-span-3 h-9"
            onClick={() => {
              onPick(null);
              setOpen(false);
            }}
          >
            清除
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
