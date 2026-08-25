import 'server-only';

import {
  getWhatsAppAccessToken,
  isWhatsAppDryRun,
  isWhatsAppNotificationsEnabled,
  isWhatsAppTextFallbackEnabled,
  notificationsConfig,
} from '@/config/notifications';

export type SendWhatsAppResult =
  | { readonly sent: true; readonly id: string; readonly dryRun?: boolean }
  | { readonly sent: false; readonly reason: 'disabled' | 'failed'; readonly error?: string };

type TemplateInput = {
  readonly to: string;
  readonly templateName: string;
  readonly bodyParams: readonly string[];
  readonly text: string;
};

function graphUrl(): string {
  const { whatsappGraphVersion, whatsappPhoneNumberId } = notificationsConfig;
  return `https://graph.facebook.com/${whatsappGraphVersion}/${whatsappPhoneNumberId}/messages`;
}

function templatePayload(input: TemplateInput) {
  return {
    messaging_product: 'whatsapp',
    to: input.to,
    type: 'template',
    template: {
      name: input.templateName,
      language: { code: notificationsConfig.whatsappTemplateLanguage },
      components: [
        {
          type: 'body',
          parameters: input.bodyParams.map((text) => ({
            type: 'text' as const,
            text: text.slice(0, 1024) || '—',
          })),
        },
      ],
    },
  };
}

function textPayload(input: TemplateInput) {
  return {
    messaging_product: 'whatsapp',
    to: input.to,
    type: 'text',
    text: { body: input.text.slice(0, 4096) },
  };
}

/**
 * Sends a WhatsApp Cloud API template (or session text in fallback mode).
 * Never throws — callers treat notification as best-effort.
 */
export async function sendWhatsAppTemplate(input: TemplateInput): Promise<SendWhatsAppResult> {
  const to = input.to.trim();
  if (!to) {
    return { sent: false, reason: 'failed', error: 'Missing WhatsApp recipient.' };
  }

  if (isWhatsAppDryRun()) {
    console.info('[whatsapp] dry-run', {
      to,
      template: input.templateName,
      params: input.bodyParams,
    });
    return { sent: true, id: 'dry-run', dryRun: true };
  }

  const token = getWhatsAppAccessToken();
  if (!token || !isWhatsAppNotificationsEnabled()) {
    return { sent: false, reason: 'disabled' };
  }

  const body = isWhatsAppTextFallbackEnabled() ? textPayload(input) : templatePayload(input);

  try {
    const response = await fetch(graphUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const raw = await response.text().catch(() => '');
    if (!response.ok) {
      return {
        sent: false,
        reason: 'failed',
        error: raw || `WhatsApp HTTP ${response.status}`,
      };
    }

    let messageId = 'unknown';
    try {
      const payload = JSON.parse(raw) as {
        messages?: ReadonlyArray<{ id?: string }>;
      };
      messageId = payload.messages?.[0]?.id ?? 'unknown';
    } catch {
      // Provider returned a non-JSON success body.
    }

    return { sent: true, id: messageId };
  } catch (error) {
    return {
      sent: false,
      reason: 'failed',
      error: error instanceof Error ? error.message : 'Unknown WhatsApp send error',
    };
  }
}
