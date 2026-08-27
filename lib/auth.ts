import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth/minimal';
import { env, waitUntil } from 'cloudflare:workers';
import { getDb } from '@/db';
import { databaseProvider } from '@/db/runtime';
import * as schema from '@/db/schema';
import { sendAuthEmail } from './auth-email';
import { getDeploymentLocale } from './deployment-locale';

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
  const defaultLocale = getDeploymentLocale();
  const chinese = defaultLocale === 'zh';
  const requireEmailVerification = (env as unknown as { AUTH_REQUIRE_EMAIL_VERIFICATION?: string }).AUTH_REQUIRE_EMAIL_VERIFICATION === 'true';

  return betterAuth({
    appName: 'Dashloom',
    baseURL,
    secret,
    database: drizzleAdapter(db, {
      provider: databaseProvider,
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
        waitUntil(sendAuthEmail({ to: user.email, subject: chinese ? '重置你的 Dashloom 密码' : 'Reset your Dashloom password', text: chinese ? `请在 60 分钟内使用此一次性链接重置 Dashloom 密码：${url}` : `Use this one-time link within 60 minutes to reset your Dashloom password: ${url}` }).catch((error) => console.error('Password reset email failed.', error)));
      },
    },
    emailVerification: {
      sendOnSignUp: requireEmailVerification,
      sendOnSignIn: requireEmailVerification,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        waitUntil(sendAuthEmail({ to: user.email, subject: chinese ? '验证你的 Dashloom 邮箱' : 'Verify your Dashloom email', text: chinese ? `请在 60 分钟内使用此一次性链接验证 Dashloom 邮箱：${url}` : `Use this one-time link within 60 minutes to verify your Dashloom email address: ${url}` }).catch((error) => console.error('Email verification delivery failed.', error)));
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
                name: chinese ? `${createdUser.name}的工作空间` : `${createdUser.name}'s workspace`,
                ownerUserId: createdUser.id,
                locale: defaultLocale,
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
