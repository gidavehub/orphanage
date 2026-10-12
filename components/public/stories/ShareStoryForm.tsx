"use client";

import { useActionState, useCallback, useState } from "react";
import { BriefcaseMedical, HandHeart, HandHelping, Handshake, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { CountrySelect } from "@/components/ui/form/CountrySelect";
import { ErrorSummary } from "@/components/ui/form/ErrorSummary";
import { Field, fieldValue } from "@/components/ui/form/Field";
import { Fieldset } from "@/components/ui/form/Fieldset";
import { FileDrop, type UploadItem } from "@/components/ui/form/FileDrop";
import { FormSuccess } from "@/components/ui/form/FormSuccess";
import { Honeypot } from "@/components/ui/form/Honeypot";
import { Turnstile } from "@/components/ui/form/Turnstile";
import { Input } from "@/components/ui/form/Input";
import { PhoneInput } from "@/components/ui/form/PhoneInput";
import { RadioCards, type RadioCardOption } from "@/components/ui/form/RadioCards";
import { Select } from "@/components/ui/form/Select";
import { SubmitButton } from "@/components/ui/form/SubmitButton";
import { Textarea } from "@/components/ui/form/Textarea";
import type { TimelineItem } from "@/components/ui/Timeline";
import { PRESENCE_FIRST } from "@/lib/countries";
import { zodToFieldErrors, type FieldErrors, type FormState } from "@/lib/forms/types";
import { STORY_SUBMITTER_ROLES, type StorySubmitterRole } from "@/lib/model/enums";
import { STORY_FIELD_ORDER, STORY_MAX, STORY_MAX_PHOTOS, STORY_MIN, STORY_ROLE_OPTIONS, storySchema, type StoryField } from "@/lib/schemas/forms/story";
import { cn } from "@/lib/cn";

export type ShareStoryCopy = {
  /** "Please don't send photos of children…" (pages.shareStory → photos). */
  photos: string;
  /** The publish permission sentence (pages.shareStory → consents, first item). */
  publishConsent: string;
  /** The parent or guardian sentence (pages.shareStory → consents, second item). */
  guardianConsent: string;
  successTitle: string;
  successMessage: string;
  /** "What happens next" steps on the success screen. */
  next: TimelineItem[];
};

type Props = {
  action: (prev: FormState<StoryField>, fd: FormData) => Promise<FormState<StoryField>>;
  copy: ShareStoryCopy;
  /** `/api/uploads` when storage is connected (the optional adult-only photo), else null. */
  uploadUrl: string | null;
  programmes: Array<{ id: string; title: string }>;
  privacyHref: string;
  storiesHref: string;
  homeHref: string;
};

const ROLE_ICON: Record<StorySubmitterRole, RadioCardOption["icon"]> = {
  beneficiary: Users,
  donor: HandHeart,
  volunteer: HandHelping,
  partner: Handshake,
  professional: BriefcaseMedical,
};

const ROLE_OPTIONS: RadioCardOption[] = STORY_SUBMITTER_ROLES.map((r) => ({
  value: r,
  label: STORY_ROLE_OPTIONS[r].label,
  description: STORY_ROLE_OPTIONS[r].description,
  icon: ROLE_ICON[r],
}));

const INITIAL: FormState<StoryField> = { status: "idle" };

/** Errors in the order the fields appear (ErrorSummary lists them top to bottom). */
function ordered(errors: FieldErrors): FieldErrors {
  const out: FieldErrors = {};
  for (const k of STORY_FIELD_ORDER) if (errors[k]) out[k] = errors[k];
  for (const [k, v] of Object.entries(errors)) if (!(k in out) && v) out[k] = v;
  return out;
}

/**
 * The "Share your story" form (public-pages §3.14, D58). Validates with the shared zod schema on
 * submit (the Server Action re-validates), keeps every typed value after an error, and swaps itself
 * for the success screen with the HVN-SS reference.
 */
export function ShareStoryForm({ action, copy, uploadUrl, programmes, privacyHref, storiesHref, homeHref }: Props) {
  const [state, formAction] = useActionState(action, INITIAL);
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);
  const [attempt, setAttempt] = useState(0);
  const echoedChild = fieldValue(state, "aboutMyChild");
  const [aboutChild, setAboutChild] = useState(echoedChild === "on");
  const [storyLength, setStoryLength] = useState(fieldValue(state, "story")?.length ?? 0);
  const [uploading, setUploading] = useState(false);
  const onFiles = useCallback((files: UploadItem[]) => {
    setUploading(files.some((f) => f.status === "uploading" || f.status === "preparing"));
  }, []);

  if (state.status === "success") {
    return (
      <FormSuccess
        title={copy.successTitle}
        reference={state.reference}
        message={<p>{copy.successMessage}</p>}
        next={copy.next}
        actions={
          <>
            <Button href={storiesHref} variant="forest" icon="arrow">
              Read More Stories
            </Button>
            <Button href={homeHref} variant="outline" icon="none">
              Back to Home
            </Button>
          </>
        }
        className="rounded-card-lg bg-white px-5 py-12 shadow-card md:px-10"
      />
    );
  }

  const serverErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const errors: FieldErrors = ordered(clientErrors ?? serverErrors);
  const err = (k: StoryField) => errors[k];
  // The server's echo is only used until the person edits again; client errors keep the DOM values.
  const echo = (k: StoryField) => fieldValue(state, k);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget);
    const raw: Record<string, unknown> = {};
    for (const k of STORY_FIELD_ORDER) {
      const all = fd.getAll(k).filter((v): v is string => typeof v === "string");
      if (all.length) raw[k] = all.length === 1 ? all[0] : all;
    }
    const parsed = storySchema.safeParse(raw);
    setAttempt((n) => n + 1);
    if (!parsed.success || uploading) {
      e.preventDefault();
      const errs = parsed.success ? {} : zodToFieldErrors(parsed.error);
      if (uploading) errs.photo = "Please wait until your photo has finished uploading.";
      setClientErrors(errs);
      return;
    }
    setClientErrors(null);
  };

  const anonymousDefault = echo("anonymous") === "on";

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="relative grid gap-12" aria-describedby="share-story-required">
      <p id="share-story-required" className="text-[15px] leading-relaxed text-body">
        Every question is needed unless it says “optional”. Nothing you send is published until our team has checked it with you.
      </p>

      <ErrorSummary
        state={clientErrors ? undefined : state}
        errors={Object.keys(errors).length ? errors : undefined}
        focusKey={attempt}
      />

      <Fieldset legend="About you">
        <div className="grid gap-7">
          <Field name="name" label="Your name" hint="We use it to contact you. If we publish your story, we show only your first name and initial." error={err("name")} state={clientErrors ? undefined : state}>
            <Input type="text" autoComplete="name" maxLength={80} />
          </Field>

          <Checkbox
            name="anonymous"
            label="Publish my story without my name"
            hint="We'll credit it as “A volunteer”, “A parent” and so on."
            defaultChecked={anonymousDefault}
          />

          <RadioCards
            name="role"
            legend="You are a…"
            options={ROLE_OPTIONS}
            columns={2}
            error={err("role")}
            defaultValue={echo("role")}
          />

          <div className="grid gap-7 md:grid-cols-2">
            <Field name="country" label="Country" hint="Country only. We never publish towns or villages." error={err("country")} state={clientErrors ? undefined : state}>
              <CountrySelect priority={PRESENCE_FIRST} defaultValue={echo("country") ?? ""} />
            </Field>
            <Field name="programme" label="Which programme is it about?" optional hint="If you know it." error={err("programme")} state={clientErrors ? undefined : state}>
              <Select
                defaultValue={echo("programme") ?? ""}
                options={[{ value: "", label: "Not sure / not listed" }, ...programmes.map((p) => ({ value: p.id, label: p.title }))]}
              />
            </Field>
          </div>
        </div>
      </Fieldset>

      <Fieldset legend="Your story">
        <div className="grid gap-7">
          <Field
            name="story"
            label="Tell us what happened"
            hint={
              <>
                {STORY_MIN} to {STORY_MAX.toLocaleString("en")} characters. What changed for you or your family? Please leave out children’s names, school names and exact places.
              </>
            }
            counter={{ max: STORY_MAX }}
            error={err("story")}
            state={clientErrors ? undefined : state}
          >
            <Textarea rows={8} maxLength={STORY_MAX + 200} onInput={(e) => setStoryLength(e.currentTarget.value.length)} />
          </Field>
          <p aria-hidden className={cn("-mt-4 text-[13px] font-semibold transition-colors", storyLength >= STORY_MIN ? "text-forest-700" : "text-body")}>
            {storyLength >= STORY_MIN ? "That's enough to get started. Thank you." : `A few sentences is perfect (at least ${STORY_MIN} characters).`}
          </p>

          <Field
            name="photo"
            label="A photo of you"
            optional
            hint={<>Adults only. {copy.photos}</>}
            error={err("photo")}
          >
            <FileDrop
              name="photo"
              uploadUrl={uploadUrl}
              accept=".jpg,.jpeg,.png,.webp"
              maxSizeMb={4}
              maxFiles={STORY_MAX_PHOTOS}
              onFiles={onFiles}
              unavailableText="If you would like to share a photo of yourself, our team will ask for it when they contact you, and arrange written consent first."
            />
          </Field>
        </div>
      </Fieldset>

      <Fieldset legend="How we can reach you" hint="Give an email address, a phone number or both. We only use them to check your story with you. They are never published.">
        <div className="grid gap-7 md:grid-cols-2">
          <Field name="email" label="Email address" optional error={err("email")} state={clientErrors ? undefined : state}>
            <Input type="email" autoComplete="email" inputMode="email" spellCheck={false} maxLength={254} />
          </Field>
          <Field name="phone" label="Phone or WhatsApp" optional hint="With country code, like +220 …" error={err("phone")} state={clientErrors ? undefined : state}>
            <PhoneInput maxLength={24} />
          </Field>
        </div>
      </Fieldset>

      <Fieldset legend="Your permission">
        <div className="grid gap-6">
          <Checkbox
            name="aboutMyChild"
            label="My story is about my own child"
            hint="Our team will arrange written consent before anything about a child is published."
            checked={aboutChild}
            onChange={(e) => setAboutChild(e.currentTarget.checked)}
          />
          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-500 ease-out-expo motion-reduce:transition-none",
              aboutChild ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
            aria-hidden={!aboutChild}
          >
            <div className="overflow-hidden">
              <div className="rounded-control border-l-4 border-marigold bg-cream px-5 py-4">
                <Checkbox name="guardian" label={copy.guardianConsent} error={err("guardian")} disabled={!aboutChild} />
              </div>
            </div>
          </div>
          <Checkbox name="publishConsent" label={copy.publishConsent} error={err("publishConsent")} />
          <Checkbox
            name="privacy"
            label={
              <>
                I have read how Haven looks after my information in the <a href={privacyHref}>privacy notice</a>.
              </>
            }
            error={err("privacy")}
          />
        </div>
      </Fieldset>

      <Honeypot />

      <Turnstile action="story" />

      <div className="flex flex-col items-start gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-[420px] text-[14px] leading-relaxed text-body">We read every story. You will hear from us before anything is published.</p>
        <SubmitButton pendingLabel={uploading ? "Uploading your photo…" : "Sending your story…"} pending={uploading} icon="send" size="lg" className="w-full sm:w-auto">
          Share My Story
        </SubmitButton>
      </div>
    </form>
  );
}
