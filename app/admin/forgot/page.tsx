import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame, AuthHeading } from "@/components/admin/auth/AuthFrame";
import { ForgotForm } from "@/components/admin/auth/ForgotForm";
import { forgotAction } from "./actions";

// /admin/forgot (PLAN D88): ask for a password reset link.

export const metadata: Metadata = { title: "Forgot your password?", robots: { index: false } };

export default function ForgotPage() {
  return (
    <AuthFrame>
      <AuthHeading title="Forgot your password?" lead="Enter the email you use for Haven and we’ll send you a link to choose a new one." />
      <ForgotForm action={forgotAction} />
      <Link href="/admin/login" className="mt-5 inline-flex text-[15px] font-bold text-forest underline-offset-4 hover:underline">
        Back to sign in
      </Link>
    </AuthFrame>
  );
}
