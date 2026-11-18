"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { Button, Card, Field, LoadingState, inputClass } from "@/components/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { setActiveBusinessId } from "@/lib/auth/session";

function SetupForm() {
  const router = useRouter();
  const { ready, businesses, signOut } = useAuth();
  const first = businesses.length === 0;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const v: Record<string, string> = {};
    if (!name.trim()) v.name = "Enter your business name.";
    setErrors(v);
    setFormError(null);
    if (Object.keys(v).length) return;

    setSubmitting(true);
    try {
      const biz = await api.createBusiness({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        description: description.trim() || undefined,
      });
      setActiveBusinessId(biz.id);
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setFormError(errorMessage(err));
      setSubmitting(false);
    }
  }

  if (!ready) return <LoadingState />;

  return (
    <Card className="p-6">
      <h1 className="text-xl font-semibold text-ink">{first ? "Set up your business" : "Add a business"}</h1>
      <p className="mt-1 text-sm text-muted">Customers see this name on every payment request you send.</p>

      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {formError}
          </p>
        )}
        <Field label="Business name" htmlFor="name" error={errors.name}>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
            autoComplete="organization"
            maxLength={120}
            className={inputClass}
          />
        </Field>
        <Field label="What you do (optional)" htmlFor="description">
          <input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Photography and event styling"
            maxLength={200}
            className={inputClass}
          />
        </Field>
        <Field label="Business email (optional)" htmlFor="biz-email" error={errors.email}>
          <input
            id="biz-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            className={inputClass}
          />
        </Field>
        <Field label="Phone (optional)" htmlFor="phone">
          <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </Field>
        <Button type="submit" loading={submitting} className="mt-2 w-full">
          {first ? "Continue to dashboard" : "Add business"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {first ? (
          <button type="button" onClick={signOut} className="font-medium text-brand hover:underline">
            Sign out
          </button>
        ) : (
          <Link href="/" className="font-medium text-brand hover:underline">
            Back to dashboard
          </Link>
        )}
      </p>
    </Card>
  );
}

export default function SetupPage() {
  return (
    <AuthProvider requireBusiness={false}>
      <SetupForm />
    </AuthProvider>
  );
}
