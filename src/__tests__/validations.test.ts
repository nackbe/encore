import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  signupSchema,
  profileSchema,
  passwordChangeSchema,
} from '@/lib/validations';

describe('loginSchema', () => {
  it('accepts valid email and password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'secure123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'secure123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '12345',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password over 128 chars', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'a'.repeat(129),
    });
    expect(result.success).toBe(false);
  });
});

describe('signupSchema', () => {
  it('accepts matching passwords', () => {
    const result = signupSchema.safeParse({
      email: 'user@example.com',
      password: 'secure123',
      confirmPassword: 'secure123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const result = signupSchema.safeParse({
      email: 'user@example.com',
      password: 'secure123',
      confirmPassword: 'different',
    });
    expect(result.success).toBe(false);
  });
});

describe('profileSchema', () => {
  it('accepts valid profile data', () => {
    const result = profileSchema.safeParse({
      display_name: 'John',
      city: 'Bogotá',
      country: 'CO',
      preferred_genres: ['rock', 'electronic'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts null fields', () => {
    const result = profileSchema.safeParse({
      display_name: null,
      city: null,
      country: null,
      preferred_genres: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects display_name over 100 chars', () => {
    const result = profileSchema.safeParse({
      display_name: 'a'.repeat(101),
      city: null,
      country: null,
      preferred_genres: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 30 genres', () => {
    const result = profileSchema.safeParse({
      display_name: null,
      city: null,
      country: null,
      preferred_genres: Array.from({ length: 31 }, (_, i) => `genre-${i}`),
    });
    expect(result.success).toBe(false);
  });
});

describe('passwordChangeSchema', () => {
  it('accepts matching passwords', () => {
    const result = passwordChangeSchema.safeParse({
      newPassword: 'newsecure',
      confirmNewPassword: 'newsecure',
    });
    expect(result.success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const result = passwordChangeSchema.safeParse({
      newPassword: 'newsecure',
      confirmNewPassword: 'different',
    });
    expect(result.success).toBe(false);
  });
});
