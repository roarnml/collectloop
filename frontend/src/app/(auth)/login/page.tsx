"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { API_MODE, ApiError, api, errorMessage } from "@/lib/api";
import { MOCK_DEMO_ACCOUNT } from "@/lib/api/mock";
import { getTokens, safeNextPath } from "@/lib/auth/session";

function LoginForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in: skip the form.
  useEffect(() => {
    if (getTokens()) router.replace(next);
  }, [router, next]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const v: Record<string, string> = {};
    if (!email.trim()) v.email = "Enter your email address.";
    if (!password) v.password = "Enter your password.";
    setErrors(v);
    setFormError(null);
    if (Object.keys(v).length) return;

    setSubmitting(true);
    try {
      await api.login({ email: email.trim(), password });
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setFormError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <h1 className="text-xl font-semibold text-ink">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Manage your payment requests and balances.</p>

      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {formError}
          </p>
        )}
        <Field label="Email" htmlFor="email" error={errors.email}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            className={inputClass}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
            className={inputClass}
          />
        </Field>
        <Button type="submit" loading={submitting} className="mt-2 w-full">
          Sign in
        </Button>
      </form>

      {API_MODE === "mock" && (
        <button
          type="button"
          onClick={() => {
            setEmail(MOCK_DEMO_ACCOUNT.email);
            setPassword(MOCK_DEMO_ACCOUNT.password);
          }}
          className="mt-3 w-full rounded-lg border border-dashed border-warn/40 px-3 py-2 text-xs text-warn hover:bg-warn-soft"
        >
          Fill in the demo account (simulated mode only)
        </button>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        New to PayTrain?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
