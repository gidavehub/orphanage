import { cn } from "@/lib/cn";

/** `donat`: bordered white fields for long forms. `vu`: filled pills for quick give and subscribe. */
export type Skin = "donat" | "vu";
/** `admin`: 44px single-line controls with a 16px radius (design-system §5.3). */
export type Density = "default" | "admin";
/** `dark`: the Join style on coral, deep or photo surfaces. */
export type Surface = "light" | "dark";

export type ControlStyle = {
  skin?: Skin;
  density?: Density;
  surface?: Surface;
  invalid?: boolean;
};

/** Shared visual for single-line inputs, selects and the wrappers of inputs with adornments. */
export function controlClass({ skin = "donat", density = "default", surface = "light", invalid }: ControlStyle, kind: "input" | "textarea" | "select" = "input") {
  const multi = kind === "textarea";
  if (surface === "dark") {
    return cn(
      "w-full bg-white/15 font-grotesk text-[17px] text-white placeholder:text-white/85 transition-[background-color,box-shadow] duration-300",
      "focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60 focus-within:bg-white/20 focus-within:ring-2 focus-within:ring-white/60",
      multi ? "min-h-[140px] rounded-control px-7 py-4" : "h-[60px] rounded-full px-7",
      invalid && "ring-2 ring-white",
      "disabled:opacity-50",
    );
  }
  if (skin === "vu") {
    return cn(
      "w-full border-0 bg-field font-grotesk text-[16px] text-ink placeholder:text-body transition-[background-color,box-shadow] duration-300 hover:bg-mist",
      "focus:outline-none focus:ring-2 focus:ring-coral-800/50 focus-within:ring-2 focus-within:ring-coral-800/50",
      multi ? "min-h-[140px] rounded-control px-5 py-4" : "h-12 rounded-full px-5",
      invalid && "ring-2 ring-coral-800 focus:ring-coral-800",
      "disabled:cursor-not-allowed disabled:opacity-50",
    );
  }
  const admin = density === "admin";
  return cn(
    "w-full border-[1.5px] bg-white font-sans text-[16px] text-ink placeholder:text-body/80 transition-[border-color,box-shadow,background-color] duration-300",
    "hover:border-ink/60 focus:border-forest focus:outline-none focus:ring-4 focus:ring-forest/15",
    "focus-within:border-forest focus-within:ring-4 focus-within:ring-forest/15",
    multi ? cn("min-h-[140px] px-5 py-4", admin ? "rounded-2xl" : "rounded-control") : cn(admin ? "h-11 rounded-2xl px-4" : "h-[52px] rounded-full px-5"),
    invalid ? "border-coral-800 bg-coral-100/40 hover:border-coral-800" : "border-edge",
    "disabled:cursor-not-allowed disabled:border-mist disabled:bg-pebble disabled:text-body/70",
  );
}

/** Field label: Nunito 15/700 ink above the control (donat/admin); Inter 13/500 ink/75 (vu). */
export function labelClass(skin: Skin = "donat", surface: Surface = "light") {
  if (surface === "dark") return "block text-[15px] font-bold text-white";
  return skin === "vu" ? "block font-grotesk text-[13px] font-medium text-ink/75" : "block text-[15px] font-bold text-ink";
}

export function hintClass(surface: Surface = "light") {
  return cn("text-[14px] leading-relaxed", surface === "dark" ? "text-white/85" : "text-body");
}

export function errorClass(surface: Surface = "light") {
  return cn("flex items-start gap-1.5 text-[14px] font-semibold leading-snug", surface === "dark" ? "text-white" : "text-coral-800");
}
