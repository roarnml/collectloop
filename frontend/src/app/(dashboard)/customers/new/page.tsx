"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card, ErrorAlert, Field, PageHeader, inputClass } from "@/components/ui";
import { ApiError, api, errorMessage } from "@/lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NewCustomerPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const v: Record<string, string> = {};
    if (!name.trim()) v.name = "Enter the customer's name.";
    if (email.trim() && !EMAIL_RE.test(email.trim())) v.email = "Enter a valid email address, or leave it blank.";
    setErrors(v);
    setFormError(null);
    if (Object.keys(v).length) return;

    setSubmitting(true);
    try {
      const created = await api.createCustomer({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      // Next.js keeps this page alive in the background and restores its state
      // on a later visit, so clear it for the next customer.
      setName("");
      setEmail("");
      setPhone("");
      setSubmitting(false);
      router.push(`/customers/${created.id}?created=1`);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setFormError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/customers" className="text-sm text-muted hover:text-ink">
        ← Customers
      </Link>
      <div className="mt-3">
        <PageHeader title="Add customer" subtitle="Save their details once, then bill them from any payment request." />
      </div>

      <Card className="p-5 sm:p-6">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          {formError && <ErrorAlert>{formError}</ErrorAlert>}
          <Field label="Name" htmlFor="name" error={errors.name}>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
              autoComplete="off"
              maxLength={150}
              className={inputClass}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Email (optional)" htmlFor="email" error={errors.email}>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
                autoComplete="off"
                className={inputClass}
              />
            </Field>
            <Field label="Phone (optional)" htmlFor="phone" error={errors.phone}>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={!!errors.phone}
                autoComplete="off"
                maxLength={30}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => router.push("/customers")} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Add customer
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
