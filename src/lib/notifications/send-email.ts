import 'server-only';

import { isEmailNotificationsEnabled, notificationsConfig } from '@/config/notifications';

export type SendEmailInput = {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
};

export type SendEmailResult =
  | { readonly sent: true; readonly id: string }
  | { readonly sent: false; readonly reason: 'disabled' | 'failed'; readonly error?: string };

/**
 * Sends a transactional email via Resend when configured.
 * Never throws — callers treat notification as best-effort.
 */
export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !isEmailNotificationsEnabled()) {
    return { sent: false, reason: 'disabled' };
  }

  const to = input.to.trim();
  if (!to) {
    return { sent: false, reason: 'failed', error: 'Missing recipient.' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${notificationsConfig.fromName} <${notificationsConfig.fromEmail}>`,
        to: [to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(notificationsConfig.replyTo ? { reply_to: notificationsConfig.replyTo } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return {
        sent: false,
        reason: 'failed',
        error: body || `Resend HTTP ${response.status}`,
      };
    }

    const payload = (await response.json()) as { id?: string };
    return { sent: true, id: payload.id ?? 'unknown' };
  } catch (error) {
    return {
      sent: false,
      reason: 'failed',
      error: error instanceof Error ? error.message : 'Unknown send error',
    };
  }
}
