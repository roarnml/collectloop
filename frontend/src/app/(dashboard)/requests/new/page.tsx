"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card, ErrorState, Field, LoadingState, PageHeader, inputClass } from "@/components/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { todayDate } from "@/lib/format/date";
import { parseAmount } from "@/lib/format/money";
import { useQuery } from "@/lib/hooks/useQuery";

import { DEFAULT_ASSET as ASSET } from "@/lib/config";
const NEW = "__new__";

export default function NewRequestPage() {
  const router = useRouter();
  const customers = useQuery(() => api.listCustomers(), []);

  const [customerId, setCustomerId] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!customerId) e.customer = "Choose a customer or add a new one.";
    if (customerId === NEW && !newName.trim()) e.new_name = "Enter the customer's name.";
    if (!description.trim()) e.description = "Describe what this payment is for.";
    const minor = parseAmount(amount, ASSET.assetScale);
    if (minor === null) e.amount = `Enter an amount like 25000 or 25,000.50 (max ${ASSET.assetScale} decimal places).`;
    else if (minor <= 0n) e.amount = "Amount must be greater than zero.";
    return { e, minor };
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (submitting) return;
    const { e, minor } = validate();
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length || minor === null) return;

    setSubmitting(true);
    try {
      const created = await api.createPaymentRequest({
        ...(customerId === NEW
          ? { new_customer: { name: newName, email: newEmail || undefined } }
          : { customer_id: customerId }),
        description,
        amount: { value: minor.toString(), ...ASSET },
        due_date: dueDate || null,
      });
      router.push(`/requests/${created.id}?created=1`);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setFormError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/requests" className="text-sm text-muted hover:text-ink">
        ← Payment requests
      </Link>
      <div className="mt-3">
        <PageHeader title="Create payment request" subtitle="You'll get a link to share with your customer." />
      </div>

      {customers.status === "loading" && <LoadingState />}
      {customers.status === "error" && <ErrorState error={customers.error} onRetry={customers.reload} />}
      {customers.status === "success" && (
        <Card className="p-5 sm:p-6">
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
            {formError && (
              <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
                {formError}
              </p>
            )}

            <Field label="Customer" htmlFor="customer" error={errors.customer}>
              <select
                id="customer"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                aria-invalid={!!errors.customer}
                aria-describedby={errors.customer ? "customer-error" : undefined}
                className={inputClass}
              >
                <option value="">Select a customer</option>
                {customers.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value={NEW}>+ Add a new customer</option>
              </select>
            </Field>

            {customerId === NEW && (
              <div className="grid gap-4 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
                <Field label="Customer name" htmlFor="new_name" error={errors.new_name}>
                  <input
                    id="new_name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    aria-invalid={!!errors.new_name}
                    autoComplete="off"
                    className={inputClass}
                  />
                </Field>
                <Field label="Email (optional)" htmlFor="new_email">
                  <input
                    id="new_email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    autoComplete="off"
                    className={inputClass}
                  />
                </Field>
              </div>
            )}

            <Field label="What is this payment for?" htmlFor="description" error={errors.description}>
              <input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Wedding photography deposit"
                aria-invalid={!!errors.description}
                maxLength={200}
                className={inputClass}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={`Amount (${ASSET.assetCode})`}
                htmlFor="amount"
                error={errors.amount}
                hint="Currency comes from your connected wallet."
              >
                <input
                  id="amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 25,000"
                  aria-invalid={!!errors.amount}
                  className={`${inputClass} tabular-nums`}
                />
              </Field>
              <Field label="Due date (optional)" htmlFor="due" error={errors.due}>
                <input id="due" type="date" min={todayDate()} value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
              </Field>
            </div>


            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => router.push("/requests")} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                Create request
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
