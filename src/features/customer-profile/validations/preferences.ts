import { z } from 'zod';

import { phoneSchema } from '@/validations';

export const customerNotificationPreferencesSchema = z
  .object({
    phone: z.union([z.literal(''), phoneSchema]),
    whatsappOptIn: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.whatsappOptIn && !value.phone.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Add a WhatsApp mobile number to receive booking updates.',
        path: ['phone'],
      });
    }
  });

export type CustomerNotificationPreferencesInput = z.infer<
  typeof customerNotificationPreferencesSchema
>;
