import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createHash } from "node:crypto";

function passwordVersion(hash: string | null) {
  return createHash("sha256").update(hash ?? "").digest("hex");
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          passwordVersion: passwordVersion(user.passwordHash),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // @ts-expect-error custom field
        token.role = user.role;
        token.passwordVersion = (user as typeof user & { passwordVersion: string }).passwordVersion;
      }
      // Always refresh clubRole and subscriptionStatus so changes take effect without re-login
      if (token.id) {
        try {
          const [dbUser, subscription] = await Promise.all([
            prisma.user.findUnique({
              where: { id: token.id as string },
              select: { clubRole: true, passwordHash: true },
            }),
            prisma.subscription.findUnique({
              where: { userId: token.id as string },
              select: { status: true },
            }),
          ]);
          // Password resets revoke previously issued sessions on their next check.
          if (!dbUser || token.passwordVersion !== passwordVersion(dbUser.passwordHash)) return null;
          token.clubRole = dbUser.clubRole ?? "NONE";
          token.subscriptionStatus = subscription?.status ?? null;
        } catch {
          // DB temporarily unavailable — keep existing token values
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // @ts-expect-error custom field
        session.user.role = token.role;
        // @ts-expect-error custom field
        session.user.clubRole = token.clubRole;
        // @ts-expect-error custom field
        session.user.subscriptionStatus = token.subscriptionStatus;
      }
      return session;
    },
  },
});
