import { Input, type InputProps } from "./Input";

/**
 * A phone number (public-pages §2.4): free text, because formats differ by country, with the tel
 * keypad and autofill. Add the international-format example in the Field hint.
 */
export function PhoneInput({ type = "tel", inputMode = "tel", autoComplete = "tel", ...rest }: InputProps) {
  return <Input type={type} inputMode={inputMode} autoComplete={autoComplete} {...rest} />;
}
