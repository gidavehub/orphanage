"use client";

import { useState } from "react";
import { Input, type InputProps } from "@/components/ui/form/Input";

/** Parses "1,000" and "7.5"; anything else (or negative) is 0. */
export function parseAmount(s: string): number {
  const n = Number(s.replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * A number field for admin editors: it keeps what was typed ("7.", "1,000") while the parsed value
 * drives the form, so decimals can be typed naturally. Works inside Field (props pass through).
 */
export function NumberInput({ value, onValue, ...rest }: Omit<InputProps, "value" | "onChange"> & { value: number; onValue: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  const shown = parseAmount(text) === value ? text : String(value);
  return (
    <Input
      {...rest}
      inputMode="decimal"
      value={shown}
      onChange={(e) => {
        setText(e.target.value);
        onValue(parseAmount(e.target.value));
      }}
    />
  );
}
