/** Zod schemas for auth API responses — validates /api/auth/me output. */

import { z } from 'zod';

const AuthenticatedResponseSchema = z.object({
  status: z.literal('authenticated'),
  uid: z.string().min(1),
  email: z.string().email().nullable(),
  username: z.string().nullable(),
});

const GuestResponseSchema = z.object({
  status: z.literal('guest'),
});

/** Discriminated union: /api/auth/me returns either authenticated user data or guest. */
export const AuthMeResponseSchema = z.discriminatedUnion('status', [
  AuthenticatedResponseSchema,
  GuestResponseSchema,
]);

export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;
