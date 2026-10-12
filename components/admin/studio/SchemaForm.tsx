"use client";

import { useId, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Lock, Plus, Trash2 } from "lucide-react";
import { MediaPicker } from "@/components/admin/ui/MediaPicker";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { Input } from "@/components/ui/form/Input";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import type { MediaPickerItem } from "@/lib/model/dto";
import { cn } from "@/lib/cn";
import { countries } from "@/content/world";

// The studio's one form renderer (admin-ux §6.10 "Schema-driven editors"; PLAN D60): it draws any
// content doc or collection item from the JSON Schema generated from its zod schema, so every sheet
// looks and behaves the same. Hard character limits with live counters (marigold in the last 10%),
// list editors with ↑/↓, add and remove, pictures through the MediaPicker (consent-gated), countries
// from the world list, and fields this person can't change shown locked with the reason.

type JS = Record<string, unknown> & {
  type?: string | string[];
  properties?: Record<string, JS>;
  required?: string[];
  items?: JS | false;
  prefixItems?: JS[];
  anyOf?: JS[];
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  maxLength?: number;
  minLength?: number;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
};

type Ctx = { media: MediaPickerItem[]; errors: Record<string, string>; videoPaths: string[]; disabled: boolean };

const LABELS: Record<string, string> = {
  eyebrow: "Small line above the title",
  title: "Title",
  titleLines: "Title lines",
  headline: "Headline",
  text: "Text",
  body: "Paragraphs",
  intro: "Introduction",
  summary: "Summary",
  label: "Label",
  cta: "Button",
  ctas: "Buttons",
  primaryCta: "First button",
  secondaryCta: "Second button",
  to: "Goes to",
  media: "Picture or film",
  image: "Picture",
  film: "Film",
  filmTitle: "Film title",
  place: "Country",
  country: "Country",
  caption: "Caption",
  alt: "Description for people who can't see it",
  quote: "Quote",
  quoteName: "Quote by",
  quoteRole: "Their role",
  name: "Name",
  role: "Role",
  tone: "Colour",
  slides: "Slides",
  items: "Items",
  values: "Values",
  vision: "Vision",
  visionLabel: "Vision label",
  placeholderNote: "Note shown while figures are examples",
  show: "Show it",
  href: "Link",
  icon: "Icon",
  q: "Question",
  a: "Answer",
  placements: "Where it shows",
  seo: "Search and sharing",
  description: "Description",
  heading: "Heading",
  note: "Note",
  notices: "Notices",
  statIds: "Figures shown",
  phone: "Phone",
  email: "Email",
  offices: "Offices",
  socials: "Social links",
  address: "Address",
  mapUrl: "Map link",
  teamEmails: "Team email addresses",
  sections: "Sections",
  steps: "Steps",
  level: "Heading size",
  style: "Style",
  attribution: "Said by",
  size: "Size",
  word: "Word",
  line: "Line",
  logo: "Logo",
  permission: "Written permission",
  consent: "Consent",
  verification: "Checked",
  evidence: "Where the figure comes from",
  suffix: "After the number",
  value: "Number",
  kind: "Kind",
  featured: "Feature it",
  hidden: "Hidden",
};

const HIDDEN = new Set(["order", "$schema"]);

function humanize(key: string): string {
  if (LABELS[key]) return LABELS[key]!;
  const s = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const optionLabel = (v: unknown) => (typeof v === "string" ? humanize(v) : String(v));

/** Resolves anyOf with a plain string ("#" or a URL) to a string schema. */
function simplify(s: JS): JS {
  if (s.anyOf && s.anyOf.every((b) => b.type === "string")) return { ...s.anyOf.find((b) => b.const === undefined) ?? s.anyOf[0], anyOf: undefined } as JS;
  return s;
}

const typeOf = (s: JS): string | undefined => (Array.isArray(s.type) ? s.type.find((t) => t !== "null") : s.type);
const isMedia = (s: JS) => typeOf(s) === "object" && Boolean(s.properties?.$media);
const isBlocks = (s: JS) => Array.isArray(s.anyOf) && s.anyOf.length > 1 && s.anyOf.every((b) => (b.properties?.type as JS | undefined)?.const !== undefined);

function rid(prefix = "item"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A sensible empty value for a new list item. */
export function defaultFor(s0: JS, media: MediaPickerItem[], key = ""): unknown {
  const s = simplify(s0);
  if (s.default !== undefined) return structuredClone(s.default);
  if (s.const !== undefined) return s.const;
  if (isBlocks(s)) return defaultFor(s.anyOf![0]!, media);
  if (s.anyOf) return defaultFor(s.anyOf[0]!, media, key);
  const t = typeOf(s);
  if (isMedia(s)) return { $media: media.find((m) => m.kind === "image")?.id ?? "" };
  if (t === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, p] of Object.entries(s.properties ?? {})) {
      if ((s.required ?? []).includes(k) || p.default !== undefined) out[k] = k === "id" ? rid(key || "item") : defaultFor(p, media, k);
    }
    return out;
  }
  if (t === "array") {
    if (s.prefixItems) return s.prefixItems.map((p) => defaultFor(p, media));
    const n = s.minItems ?? 0;
    return Array.from({ length: n }, () => defaultFor((s.items || {}) as JS, media));
  }
  if (t === "string") {
    if (s.enum?.length) return s.enum[0];
    if (key === "id" || s.pattern === "^[a-z0-9]+(?:-[a-z0-9]+)*$") return rid(key || "item");
    return "";
  }
  if (t === "number" || t === "integer") return s.minimum ?? 0;
  if (t === "boolean") return false;
  return null;
}

function Counter({ length, max }: { length: number; max: number }) {
  const near = length > max * 0.9;
  return <span className={cn("font-grotesk text-[12px] tabular-nums", length > max ? "font-semibold text-coral-800" : near ? "font-semibold text-umber" : "text-body")}>{length} / {max}</span>;
}

function Label({ htmlFor, text, hint, right }: { htmlFor?: string; text: string; hint?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-end justify-between gap-3">
      <label htmlFor={htmlFor} className="text-[14.5px] font-bold text-ink">
        {text}
        {hint ? <span className="block text-[12.5px] font-normal text-body">{hint}</span> : null}
      </label>
      {right}
    </div>
  );
}

function ErrorLine({ text }: { text?: string }) {
  return text ? <p className="mt-1 text-[13px] font-semibold text-coral-800">{text}</p> : null;
}

type NodeProps = { schema: JS; value: unknown; onChange: (v: unknown) => void; path: string; label: string; ctx: Ctx; keyName: string };

function StringField({ schema, value, onChange, path, label, ctx, keyName }: NodeProps) {
  const id = `f-${path.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const v = typeof value === "string" ? value : value == null ? "" : String(value);
  if (schema.enum?.length) {
    return (
      <div>
        <Label htmlFor={id} text={label} />
        <Select id={id} density="admin" value={v} disabled={ctx.disabled} options={schema.enum.map((o) => ({ value: String(o), label: optionLabel(o) }))} onChange={(e) => onChange(e.target.value)} />
        <ErrorLine text={ctx.errors[path]} />
      </div>
    );
  }
  if (keyName === "place" || keyName === "country") {
    return (
      <div>
        <Label htmlFor={id} text={label} hint="Country only, never a town or village." />
        <Select
          id={id}
          density="admin"
          value={v}
          disabled={ctx.disabled}
          options={[...(schema.minLength ? [] : [{ value: "", label: "None" }]), ...[...countries].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.code, label: c.name }))]}
          onChange={(e) => onChange(e.target.value)}
        />
        <ErrorLine text={ctx.errors[path]} />
      </div>
    );
  }
  const max = schema.maxLength;
  const long = (max ?? 0) > 140;
  return (
    <div>
      <Label htmlFor={id} text={label} right={max ? <Counter length={v.length} max={max} /> : null} />
      {long ? (
        <Textarea id={id} rows={Math.min(8, Math.max(2, Math.ceil((max ?? 200) / 160)))} value={v} disabled={ctx.disabled} invalid={Boolean(ctx.errors[path])} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input id={id} density="admin" value={v} disabled={ctx.disabled} invalid={Boolean(ctx.errors[path])} onChange={(e) => onChange(e.target.value)} />
      )}
      <ErrorLine text={ctx.errors[path]} />
    </div>
  );
}

function NumberField({ schema, value, onChange, path, label, ctx }: NodeProps) {
  const id = `f-${path.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const [text, setText] = useState(value == null ? "" : String(value));
  const n = Number(text);
  const shown = Number.isFinite(n) && n === value ? text : value == null ? "" : String(value);
  return (
    <div>
      <Label htmlFor={id} text={label} />
      <Input
        id={id}
        density="admin"
        inputMode="decimal"
        value={shown}
        disabled={ctx.disabled}
        onChange={(e) => {
          setText(e.target.value);
          const x = Number(e.target.value.replace(/,/g, ""));
          if (e.target.value.trim() === "") onChange(schema.minimum ?? 0);
          else if (Number.isFinite(x)) onChange(typeOf(schema) === "integer" ? Math.round(x) : x);
        }}
      />
      <ErrorLine text={ctx.errors[path]} />
    </div>
  );
}

function MediaField({ value, onChange, path, label, ctx }: NodeProps) {
  const [open, setOpen] = useState(false);
  const current = (value as { $media?: string } | null)?.$media ?? null;
  const item = ctx.media.find((m) => m.id === current);
  const videoOnly = ctx.videoPaths.some((p) => path === p || path.endsWith(`.${p}`));
  return (
    <div>
      <Label text={label} hint={videoOnly ? "A film." : undefined} />
      <div className="flex flex-wrap items-center gap-3 rounded-[16px] border border-line p-2">
        {item ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.poster ?? item.src} alt="" className="h-16 w-24 rounded-[10px] object-cover" />
        ) : (
          <span className="grid h-16 w-24 place-items-center rounded-[10px] bg-sand text-[12px] text-body">None</span>
        )}
        <p className="min-w-0 flex-1 text-[13.5px] text-body">{item ? item.alt || item.caption || item.id : "Choose a picture"}</p>
        <button type="button" disabled={ctx.disabled} onClick={() => setOpen((x) => !x)} className="inline-flex h-10 items-center gap-1 rounded-full border border-line px-4 text-[14px] font-bold text-ink hover:border-forest disabled:opacity-50">
          {open ? "Close" : "Change"} <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open ? (
        <MediaPicker
          className="mt-3"
          items={ctx.media}
          value={current}
          kind={videoOnly ? "video" : "any"}
          requireConsentFor="child"
          uploadHref="/admin/media"
          onChange={(id) => {
            if (id) onChange({ $media: id });
            setOpen(false);
          }}
        />
      ) : null}
      <ErrorLine text={ctx.errors[path] ?? ctx.errors[`${path}.$media`]} />
    </div>
  );
}

function CheckGroup({ schema, value, onChange, path, label, ctx }: NodeProps) {
  const list = Array.isArray(value) ? (value as string[]) : [];
  const options = ((schema.items as JS).enum ?? []) as string[];
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-1.5 text-[14.5px] font-bold text-ink">{label}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((o) => (
          <Checkbox key={o} name={`${name}-${o}`} value={o} label={optionLabel(o)} disabled={ctx.disabled} checked={list.includes(o)} onChange={(e) => onChange(e.target.checked ? [...list, o] : list.filter((x) => x !== o))} />
        ))}
      </div>
      <ErrorLine text={ctx.errors[path]} />
    </fieldset>
  );
}

function itemTitle(v: unknown, fallback: string): string {
  if (typeof v === "string") return v.trim().slice(0, 60) || fallback;
  const o = (v ?? {}) as Record<string, unknown>;
  for (const k of ["title", "eyebrow", "label", "name", "q", "word", "headline", "text", "quote", "heading"]) {
    const x = o[k];
    if (typeof x === "string" && x.trim()) return x.trim().slice(0, 60);
    if (Array.isArray(x) && typeof x[0] === "string" && x[0]) return (x as string[]).join(" ").slice(0, 60);
  }
  if (typeof o.type === "string") return humanize(o.type);
  return fallback;
}

function ListField({ schema, value, onChange, path, label, ctx }: NodeProps) {
  const list = Array.isArray(value) ? (value as unknown[]) : [];
  const itemSchema = (schema.items || {}) as JS;
  const blocks = isBlocks(itemSchema);
  const max = schema.maxItems ?? 50;
  const min = schema.minItems ?? 0;
  const simple = !blocks && typeOf(simplify(itemSchema)) !== "object" && !isMedia(itemSchema);
  const [openAt, setOpenAt] = useState<number | null>(list.length <= 1 ? 0 : null);
  const set = (i: number, v: unknown) => onChange(list.map((x, j) => (j === i ? v : x)));
  const move = (i: number, by: number) => {
    const out = [...list];
    const [x] = out.splice(i, 1);
    out.splice(i + by, 0, x);
    onChange(out);
    setOpenAt(i + by);
  };
  const add = (variant?: JS) => {
    onChange([...list, variant ? defaultFor(variant, ctx.media) : defaultFor(itemSchema, ctx.media, label.toLowerCase().split(" ")[0])]);
    setOpenAt(list.length);
  };
  const singular = label.replace(/ies$/, "y").replace(/s$/, "");
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 flex w-full items-center justify-between text-[14.5px] font-bold text-ink">
        {label} <span className="font-grotesk text-[12px] font-semibold text-body">{list.length}{schema.maxItems ? ` of up to ${schema.maxItems}` : ""}</span>
      </legend>
      {list.map((item, i) => {
        const variant = blocks ? (itemSchema.anyOf!.find((b) => (b.properties!.type as JS).const === (item as { type?: unknown })?.type) ?? itemSchema.anyOf![0]!) : itemSchema;
        const tools = (
          <span className="flex shrink-0 items-center">
            <button type="button" aria-label={`Move ${singular} ${i + 1} up`} disabled={ctx.disabled || i === 0} onClick={() => move(i, -1)} className="grid size-9 place-items-center rounded-full text-body hover:bg-sand disabled:opacity-30">
              <ArrowUp aria-hidden className="size-4" />
            </button>
            <button type="button" aria-label={`Move ${singular} ${i + 1} down`} disabled={ctx.disabled || i === list.length - 1} onClick={() => move(i, 1)} className="grid size-9 place-items-center rounded-full text-body hover:bg-sand disabled:opacity-30">
              <ArrowDown aria-hidden className="size-4" />
            </button>
            <button type="button" aria-label={`Remove ${singular} ${i + 1}`} disabled={ctx.disabled || list.length <= min} onClick={() => onChange(list.filter((_, j) => j !== i))} className="grid size-9 place-items-center rounded-full text-coral-800 hover:bg-coral/10 disabled:opacity-30">
              <Trash2 aria-hidden className="size-4" />
            </button>
          </span>
        );
        if (simple) {
          return (
            <div key={i} className="flex items-start gap-1">
              <div className="min-w-0 flex-1">
                <Node schema={itemSchema} value={item} onChange={(v) => set(i, v)} path={`${path}.${i}`} label={`${singular} ${i + 1}`} ctx={ctx} keyName="" />
              </div>
              <div className="pt-7">{tools}</div>
            </div>
          );
        }
        const open = openAt === i;
        return (
          <div key={i} className="rounded-[16px] border border-line bg-white">
            <div className="flex items-center gap-2 px-3 py-2">
              <button type="button" aria-expanded={open} onClick={() => setOpenAt(open ? null : i)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-body transition-transform", !open && "-rotate-90")} />
                <span className="truncate text-[14.5px] font-bold text-ink">{itemTitle(item, `${singular} ${i + 1}`)}</span>
                {Object.keys(ctx.errors).some((k) => k.startsWith(`${path}.${i}.`) || k === `${path}.${i}`) ? <span className="rounded-full bg-coral/10 px-2 py-0.5 text-[11.5px] font-bold text-coral-800">Check</span> : null}
              </button>
              {tools}
            </div>
            {open ? (
              <div className="border-t border-line p-3">
                {blocks ? (
                  <div className="mb-3 max-w-[260px]">
                    <Select
                      aria-label="Kind of block"
                      density="admin"
                      value={String((item as { type?: unknown })?.type ?? "")}
                      disabled={ctx.disabled}
                      options={itemSchema.anyOf!.map((b) => ({ value: String((b.properties!.type as JS).const), label: humanize(String((b.properties!.type as JS).const)) }))}
                      onChange={(e) => {
                        const b = itemSchema.anyOf!.find((x) => String((x.properties!.type as JS).const) === e.target.value)!;
                        set(i, { ...(defaultFor(b, ctx.media) as object), id: (item as { id?: string })?.id ?? rid("b") });
                      }}
                    />
                  </div>
                ) : null}
                <Node schema={variant} value={item} onChange={(v) => set(i, v)} path={`${path}.${i}`} label="" ctx={ctx} keyName="" />
              </div>
            ) : null}
          </div>
        );
      })}
      {list.length < max && !ctx.disabled ? (
        blocks ? (
          <div className="flex flex-wrap gap-2">
            {itemSchema.anyOf!.map((b) => (
              <button key={String((b.properties!.type as JS).const)} type="button" onClick={() => add(b)} className="inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-line px-3 text-[13px] font-bold text-ink hover:border-forest">
                <Plus aria-hidden className="size-3.5" /> {humanize(String((b.properties!.type as JS).const))}
              </button>
            ))}
          </div>
        ) : (
          <button type="button" onClick={() => add()} className="inline-flex h-10 w-fit items-center gap-1.5 rounded-full border border-dashed border-line px-4 text-[14px] font-bold text-ink hover:border-forest">
            <Plus aria-hidden className="size-4" /> Add {singular.toLowerCase()}
          </button>
        )
      ) : null}
      <ErrorLine text={ctx.errors[path]} />
    </fieldset>
  );
}

function ObjectFields({ schema, value, onChange, path, label, ctx }: NodeProps) {
  const o = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const props = Object.entries(schema.properties ?? {}).filter(([k]) => !HIDDEN.has(k) && !(k === "id" && path !== ""));
  const inner = (
    <div className="grid gap-4">
      {props.map(([k, s]) => (
        <Node key={k} schema={s} value={o[k]} onChange={(v) => onChange({ ...o, [k]: v })} path={path ? `${path}.${k}` : k} label={humanize(k)} ctx={ctx} keyName={k} />
      ))}
    </div>
  );
  if (!label) return inner;
  return (
    <fieldset className="rounded-[16px] border border-line p-3">
      <legend className="px-1 text-[14.5px] font-bold text-ink">{label}</legend>
      {inner}
    </fieldset>
  );
}

function Node(props: NodeProps) {
  const schema = simplify(props.schema);
  const p = { ...props, schema };
  if (isMedia(schema)) return <MediaField {...p} />;
  const t = typeOf(schema);
  if (schema.anyOf && !isBlocks(schema)) return <Node {...p} schema={schema.anyOf.find((b) => typeOf(b) !== "null") ?? schema.anyOf[0]!} />;
  if (t === "object") return <ObjectFields {...p} />;
  if (t === "array") {
    if (schema.prefixItems) {
      const list = Array.isArray(props.value) ? (props.value as unknown[]) : [];
      return (
        <fieldset className="grid gap-3">
          <legend className="mb-1 text-[14.5px] font-bold text-ink">{props.label}</legend>
          {schema.prefixItems.map((s, i) => (
            <Node key={i} schema={s} value={list[i]} onChange={(v) => props.onChange(schema.prefixItems!.map((_, j) => (j === i ? v : list[j])))} path={`${props.path}.${i}`} label={`${props.label} · part ${i + 1}`} ctx={props.ctx} keyName="" />
          ))}
        </fieldset>
      );
    }
    if ((schema.items as JS | undefined)?.enum) return <CheckGroup {...p} />;
    return <ListField {...p} />;
  }
  if (t === "string") return <StringField {...p} />;
  if (t === "number" || t === "integer") return <NumberField {...p} />;
  if (t === "boolean") {
    return <Checkbox name={`f-${props.path}`} label={props.label} disabled={props.ctx.disabled} checked={props.value === true} onChange={(e) => props.onChange(e.target.checked)} />;
  }
  return null;
}

/**
 * Renders a whole doc or item. `locked` names top-level fields this person can't change (shown
 * greyed with the reason); `errors` are the save's validation messages by dotted path.
 */
export function SchemaForm({
  schema,
  value,
  onChange,
  locked = {},
  media,
  errors = {},
  videoPaths = [],
  disabled = false,
}: {
  schema: Record<string, unknown>;
  value: unknown;
  onChange: (v: unknown) => void;
  locked?: Record<string, string>;
  media: MediaPickerItem[];
  errors?: Record<string, string>;
  videoPaths?: string[];
  disabled?: boolean;
}) {
  const s = schema as JS;
  const o = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const props = Object.entries(s.properties ?? {}).filter(([k]) => !HIDDEN.has(k));
  return (
    <div className="grid gap-5">
      {props.map(([k, ks]) => {
        const lock = locked[k];
        const ctx: Ctx = { media, errors, videoPaths, disabled: disabled || Boolean(lock) };
        return (
          <div key={k} className={cn(lock && "rounded-[16px] bg-pebble/40 p-3")}>
            {lock ? (
              <p className="mb-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-body">
                <Lock aria-hidden className="size-3.5" /> {lock}
              </p>
            ) : null}
            <Node schema={ks} value={o[k]} onChange={(v) => onChange({ ...o, [k]: v })} path={k} label={humanize(k)} ctx={ctx} keyName={k} />
          </div>
        );
      })}
    </div>
  );
}
