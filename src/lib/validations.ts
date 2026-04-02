import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
});

export const signupSchema = z
  .object({
    email: z.string().email().max(255),
    password: z.string().min(6).max(128),
    confirmPassword: z.string().min(6).max(128),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
  });

export const profileSchema = z.object({
  display_name: z.string().max(100).nullable(),
  city: z.string().max(100).nullable(),
  country: z.string().max(100).nullable(),
  preferred_genres: z.array(z.string().max(50)).max(30),
});

export const passwordChangeSchema = z
  .object({
    newPassword: z.string().min(6).max(128),
    confirmNewPassword: z.string().min(6).max(128),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    path: ['confirmNewPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
