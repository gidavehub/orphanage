"use client";

import { useState } from "react";
import { COUNTRIES, countryName } from "@/lib/countries";
import { FlagDisc } from "../flag";
import { Select, type SelectProps } from "./Select";

export type CountrySelectProps = Omit<SelectProps, "options" | "groups" | "leading" | "children"> & {
  /**
   * Codes listed first (lowercase ISO), e.g. ["gm", "us", "gb"]. Beneficiary forms pass
   * PRESENCE_FIRST from lib/countries (The Gambia, then presence countries; D73).
   */
  priority?: readonly string[];
  /** Adds "Other / not listed" (value "other") at the end. Default true. */
  includeOther?: boolean;
};

/**
 * A native select of every ISO country (D73) with the priority codes first. The flag beside the
 * closed select comes from the sprite only when the sprite has it; otherwise a neutral sand disc.
 */
export function CountrySelect({
  priority = [],
  includeOther = true,
  placeholder = "Choose a country",
  value,
  defaultValue,
  onChange,
  autoComplete = "country",
  ...selectProps
}: CountrySelectProps) {
  const [inner, setInner] = useState(String(defaultValue ?? ""));
  const current = value !== undefined ? String(value) : inner;
  const first = priority.map((c) => c.toLowerCase()).filter((c, i, a) => a.indexOf(c) === i && COUNTRIES.some((x) => x.code === c));
  const others = COUNTRIES.filter((c) => !first.includes(c.code));

  return (
    <Select
      {...selectProps}
      {...(value !== undefined ? { value } : { defaultValue: defaultValue ?? "" })}
      placeholder={placeholder}
      autoComplete={autoComplete}
      onChange={(e) => {
        if (value === undefined) setInner(e.target.value);
        onChange?.(e);
      }}
      leading={<FlagDisc code={current && current !== "other" ? current : null} className="size-6" />}
    >
      {first.map((code) => (
        <option key={`p-${code}`} value={code}>
          {countryName(code)}
        </option>
      ))}
      {first.length ? (
        <option disabled value="__sep">
          ──────────
        </option>
      ) : null}
      {others.map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
      {includeOther ? <option value="other">Other / not listed</option> : null}
    </Select>
  );
}
