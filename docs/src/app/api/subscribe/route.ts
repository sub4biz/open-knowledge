import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_SEGMENT_ID = process.env.RESEND_SEGMENT_ID;

const subscribeSchema = z.object({
  email: z.email(),
});

export async function POST(request: Request): Promise<NextResponse> {
  if (!RESEND_API_KEY || !RESEND_SEGMENT_ID) {
    console.error('[subscribe] RESEND_API_KEY or RESEND_SEGMENT_ID is not configured');
    return NextResponse.json(
      { error: 'Subscriptions are not available right now.' },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.contacts.create({
    email: parsed.data.email,
    unsubscribed: false,
    segments: [{ id: RESEND_SEGMENT_ID }],
  });

  if (error) {
    console.error(`[subscribe] Resend create-contact failed: ${error.name} - ${error.message}`);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
