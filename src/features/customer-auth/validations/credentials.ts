/**
 * Customer signup / login credential schemas.
 *
 * Role is never accepted from the client. Signup password rules mirror the
 * live criteria checklist in the signup UI.
 */

import { z } from 'zod';

import { signInCredentialsSchema } from '@/features/auth/validations/credentials';
import { getUnmetPasswordCriteria } from '@/features/customer-auth/lib/password-strength';
import { emailSchema } from '@/validations';

export { signInCredentialsSchema };
export type { SignInCredentials } from '@/features/auth/validations/credentials';

export { resetPasswordRequestSchema } from '@/features/auth/validations/credentials';
export type { ResetPasswordRequest } from '@/features/auth/validations/credentials';

export const customerPasswordSchema = z
  .string()
  .max(72, 'Password must be at most 72 characters.')
  .superRefine((password, ctx) => {
    const unmet = getUnmetPasswordCriteria(password);
    if (unmet.length === 0) {
      return;
    }

    ctx.addIssue({
      code: 'custom',
      message: `Password must include: ${unmet.join(', ').toLowerCase()}.`,
    });
  });

export const customerSignUpSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Enter your full name.')
      .max(120, 'Full name must be at most 120 characters.'),
    email: emailSchema,
    password: customerPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type CustomerSignUpInput = z.infer<typeof customerSignUpSchema>;

export const customerResetPasswordSchema = z
  .object({
    password: customerPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type CustomerResetPasswordInput = z.infer<typeof customerResetPasswordSchema>;
