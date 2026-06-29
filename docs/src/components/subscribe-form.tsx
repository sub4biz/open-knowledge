'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { MarketingButton } from '@/app/(home)/marketing-button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

const subscribeSchema = z.object({
  email: z.email({ message: 'Please enter a valid email address.' }),
});

type SubscribeValues = z.infer<typeof subscribeSchema>;

export function SubscribeForm() {
  const [submitFailed, setSubmitFailed] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const form = useForm<SubscribeValues>({
    resolver: zodResolver(subscribeSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: SubscribeValues) {
    setSubmitFailed(false);
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (response.ok) {
        form.reset();
        setSubscribed(true);
      } else {
        setSubmitFailed(true);
      }
    } catch (err) {
      console.error(
        `[subscribe-form] fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      setSubmitFailed(true);
    }
  }

  if (subscribed) {
    return (
      <p className="text-sm text-slide-muted" role="status">
        Thanks for subscribing. Watch your inbox for product updates.
      </p>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full max-w-2xl flex-col gap-2">
      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel className="text-lg leading-tight tracking-tight" htmlFor={field.name}>
              Stay in the loop
            </FieldLabel>
            <div className="relative h-14 w-full">
              <Input
                {...field}
                id={field.name}
                type="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                placeholder="my@email.com"
                aria-invalid={fieldState.invalid}
                className="h-full w-full rounded-full border bg-fd-background pr-36 pl-6 text-gray-900 placeholder:text-slide-muted/60 focus-visible:ring-2 focus-visible:ring-slide-accent focus-visible:ring-offset-2 shadow-none"
              />
              <div className="absolute inset-y-0 right-2 flex items-center">
                <MarketingButton
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={form.formState.isSubmitting}
                  className="h-10"
                >
                  Subscribe
                </MarketingButton>
              </div>
            </div>
            <FieldError className="text-red-500" errors={[fieldState.error]} />
          </Field>
        )}
      />
      {submitFailed ? (
        <p className="text-sm text-red-500" role="alert">
          Something went wrong. Please try again.
        </p>
      ) : null}
    </form>
  );
}
