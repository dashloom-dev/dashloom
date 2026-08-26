import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth/minimal';
import { env, waitUntil } from 'cloudflare:workers';
import { getDb } from '@/db';
import * as schema from '@/db/schema';
import { sendAuthEmail } from './auth-email';

function requireAuthConfiguration() {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters. See .dev.vars.example for local setup.');
  }

  return {
    secret,
    baseURL: env.BETTER_AUTH_URL || 'http://localhost:3000',
  };
}

export function createAuth() {
  const { secret, baseURL } = requireAuthConfiguration();
  const db = getDb();
  const requireEmailVerification = (env as unknown as { AUTH_REQUIRE_EMAIL_VERIFICATION?: string }).AUTH_REQUIRE_EMAIL_VERIFICATION === 'true';

  return betterAuth({
    appName: 'Dashloom',
    baseURL,
    secret,
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        waitUntil(sendAuthEmail({ to: user.email, subject: 'Reset your Dashloom password', text: `Use this one-time link within 60 minutes to reset your Dashloom password: ${url}` }).catch((error) => console.error('Password reset email failed.', error)));
      },
    },
    emailVerification: {
      sendOnSignUp: requireEmailVerification,
      sendOnSignIn: requireEmailVerification,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        waitUntil(sendAuthEmail({ to: user.email, subject: 'Verify your Dashloom email', text: `Use this one-time link within 60 minutes to verify your Dashloom email address: ${url}` }).catch((error) => console.error('Email verification delivery failed.', error)));
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },
    advanced: {
      cookiePrefix: 'dashloom',
      database: { generateId: () => crypto.randomUUID() },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (createdUser) => {
            const workspaceId = crypto.randomUUID();
            const suffix = createdUser.id.replace(/[^a-z0-9]/gi, '').slice(-8).toLowerCase();
            const baseSlug = createdUser.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';

            await db.batch([
              db.insert(schema.workspaces).values({
                id: workspaceId,
                slug: `${baseSlug}-${suffix || workspaceId.slice(0, 8)}`,
                name: `${createdUser.name}'s workspace`,
                ownerUserId: createdUser.id,
              }),
              db.insert(schema.workspaceMembers).values({
                workspaceId,
                userId: createdUser.id,
                role: 'owner',
              }),
              db.insert(schema.workspacePreferences).values({ userId: createdUser.id, activeWorkspaceId: workspaceId }),
            ]);
          },
        },
      },
    },
  });
}

export type DashloomAuth = ReturnType<typeof createAuth>;
