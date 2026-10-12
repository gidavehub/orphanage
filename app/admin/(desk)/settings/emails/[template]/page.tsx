import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmailCopyEditor } from "@/components/admin/settings/EmailCopyEditor";
import { RecordSkeleton } from "@/components/admin/shell/ListSkeleton";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { isEmailTemplateId } from "@/lib/model/email";
import { EMAIL_TEMPLATE_LABEL } from "@/lib/model/labels";
import { requireStaff } from "@/lib/server/auth/session";
import { COPY_LIMITS, getEmailCopy, isSensitive, previewEmail, SENSITIVE_MAIN_LIMIT } from "@/lib/server/email/copy";
import { standardWording } from "@/lib/server/email/templates";
import { baseUrl } from "@/lib/server/url";
import { previewEmailAction, saveEmailCopyAction } from "../actions";

// One email's wording with a live preview (admin-ux "Emails Haven sends"; integrations §4.5).

export const metadata: Metadata = { title: "Email wording" };

export default function EmailTemplatePage({ params }: { params: Promise<{ template: string }> }) {
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: Promise<{ template: string }> }) {
  await requireStaff("settings.manage");
  const { template } = await params;
  if (!isEmailTemplateId(template)) notFound();
  const { copy, updatedAt } = await getEmailCopy();
  const current = copy[template] ?? {};
  const std = standardWording(template);
  const first = previewEmail(template, current, baseUrl());
  return (
    <>
      <PageHeader title={EMAIL_TEMPLATE_LABEL[template]} description={std.audience === "staff" ? "Sent to people on the team." : "Sent to the public."} back={{ label: "Emails Haven sends", href: "/admin/settings/emails" }} />
      <EmailCopyEditor
        key={`${template}:${updatedAt ?? 0}`}
        id={template}
        initial={current}
        standard={{ greeting: std.greeting, main: std.main, signOff: std.signOff }}
        sensitive={isSensitive(template)}
        mainLimit={isSensitive(template) ? SENSITIVE_MAIN_LIMIT : COPY_LIMITS.main}
        updatedAt={updatedAt}
        firstPreview={{ subject: first.subject, html: first.html }}
        preview={previewEmailAction}
        save={saveEmailCopyAction}
      />
    </>
  );
}
