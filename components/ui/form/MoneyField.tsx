"use client";

import { useState } from "react";
import { CURRENCIES, type Currency } from "@/lib/model/enums";
import { fromMinor, toMinor } from "@/lib/money";
import { Input } from "./Input";
import { Segmented } from "./Segmented";
import type { ControlStyle } from "./styles";

export type MoneyFieldProps = ControlStyle & {
  /** Submits the amount as integer minor units under this name. */
  name: string;
  /** Submits the currency under this name (default `${name}Currency`). */
  currencyName?: string;
  /** Offered currencies; more than one shows a Segmented picker above the amount. */
  currencies?: readonly Currency[];
  currency?: Currency;
  defaultCurrency?: Currency;
  onCurrencyChange?: (currency: Currency) => void;
  /** Amount in minor units (controlled). `null` = empty. */
  valueMinor?: number | null;
  defaultValueMinor?: number | null;
  onChange?: (minor: number | null, currency: Currency) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean | "true" | "false";
  className?: string;
};

const display = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

function parseMajor(text: string): number | null {
  const clean = text.replace(/[^\d.]/g, "");
  if (!clean || clean === ".") return null;
  const n = Number.parseFloat(clean);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * An amount in a chosen currency (admin-ux §9.2): a currency Segmented plus a numeric input with the
 * ISO code inside it. Shows grouped digits once you leave the field and submits integer minor units,
 * never a float (lib/money `toMinor`).
 */
export function MoneyField({
  name,
  currencyName,
  currencies = CURRENCIES,
  currency,
  defaultCurrency,
  onCurrencyChange,
  valueMinor,
  defaultValueMinor = null,
  onChange,
  placeholder = "0",
  disabled,
  id,
  skin,
  density,
  surface,
  invalid,
  className,
  ...aria
}: MoneyFieldProps) {
  const [innerCurrency, setInnerCurrency] = useState<Currency>(defaultCurrency ?? currencies[0] ?? "GMD");
  const cur = currency ?? innerCurrency;
  const [innerMinor, setInnerMinor] = useState<number | null>(defaultValueMinor);
  const minor = valueMinor !== undefined ? valueMinor : innerMinor;
  const [text, setText] = useState<string | null>(null); // raw text while editing
  const shown = text ?? (minor == null ? "" : display.format(fromMinor(minor, cur)));

  const setCurrency = (c: Currency) => {
    if (currency === undefined) setInnerCurrency(c);
    onCurrencyChange?.(c);
    onChange?.(minor, c);
  };

  return (
    <div className={className}>
      {currencies.length > 1 ? (
        <Segmented
          label="Currency"
          options={currencies.map((c) => ({ value: c, label: c }))}
          value={cur}
          onChange={setCurrency}
          skin={density === "admin" ? "donat" : "vu"}
          density={density}
          className="mb-2.5"
        />
      ) : null}
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={shown}
        placeholder={placeholder}
        disabled={disabled}
        skin={skin}
        density={density}
        surface={surface}
        invalid={invalid}
        leading={<span className="font-grotesk text-[14px] font-semibold text-ink/80">{cur}</span>}
        onFocus={() => setText(minor == null ? "" : String(fromMinor(minor, cur)))}
        onBlur={() => setText(null)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.,]/g, "");
          setText(raw);
          const major = parseMajor(raw);
          const next = major == null ? null : toMinor(major, cur);
          if (valueMinor === undefined) setInnerMinor(next);
          onChange?.(next, cur);
        }}
        {...aria}
      />
      <input type="hidden" name={name} value={minor == null ? "" : String(minor)} />
      <input type="hidden" name={currencyName ?? `${name}Currency`} value={cur} />
    </div>
  );
}
