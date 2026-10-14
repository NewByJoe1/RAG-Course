// Minimal Resend client (https://resend.com/docs/api-reference/emails/send-email).

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  /** Resend de-duplicates sends with the same key for 24h. */
  idempotencyKey?: string;
};

export type SendResult = { ok: true; id: string } | { ok: false; status: number; error: string };

export async function sendEmail(msg: EmailMessage, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false, status: 0, error: "RESEND_API_KEY and RESEND_FROM_EMAIL must be set" };

  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(msg.idempotencyKey ? { "Idempotency-Key": msg.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      headers: msg.headers,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !body.id) return { ok: false, status: res.status, error: body.message ?? `HTTP ${res.status}` };
  return { ok: true, id: body.id };
}
