import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

export const RESET_MESSAGE = "Hvis der findes en konto med denne e-mail, sender vi et link til at vælge et nyt kodeord. Tjek også din spammappe.";
export const RESET_LIFETIME_MS = 15 * 60 * 1000;
export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(email: string) {
  // Persist the cooldown in the database so it also works across serverless instances.
  const identifier = `password-reset-cooldown:${hashResetToken(email.toLowerCase())}`;
  const now = new Date();
  await prisma.verificationToken.deleteMany({ where: { identifier, expires: { lte: now } } });
  try {
    await prisma.verificationToken.create({ data: {
      identifier, token: "cooldown", expires: new Date(now.getTime() + 60_000),
    } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }

  // Registration currently preserves email casing. Prefer an exact match and only
  // use a case-insensitive match when it identifies exactly one existing account.
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const matches = await prisma.user.findMany({ where: { email: { equals: email, mode: "insensitive" } }, take: 2 });
    user = matches.length === 1 ? matches[0] : null;
  }
  if (!user?.passwordHash) return;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (!baseUrl || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    throw new Error("Password reset email configuration missing");
  }
  const url = new URL("/nulstil-kodeord", baseUrl);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")) {
    throw new Error("Password reset requires a trusted HTTPS app URL");
  }
  const token = randomBytes(32).toString("hex");
  url.searchParams.set("token", token);
  const tokenIdentifier = `password-reset:${user.id}`;
  const tokenHash = hashResetToken(token);
  await prisma.verificationToken.create({ data: {
    identifier: tokenIdentifier, token: tokenHash, expires: new Date(now.getTime() + RESET_LIFETIME_MS),
  } });
  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: user.email,
      subject: "Nulstil dit kodeord – Vorbasse Boldklub",
      text: `Du har bedt om et nyt kodeord til Vorbasse Boldklub.\n\nVælg et nyt kodeord her:\n${url.toString()}\n\nLinket kan kun bruges én gang og udløber efter 15 minutter.\n\nHvis du ikke har bedt om dette, kan du ignorere denne mail. Dit kodeord er ikke ændret.`,
    });
    if (error) throw new Error("Password reset email delivery failed");
  } catch (error) {
    await prisma.verificationToken.deleteMany({ where: { identifier: tokenIdentifier, token: tokenHash } });
    throw error;
  }
}

export async function resetPassword(token: string, password: string) {
  const tokenHash = hashResetToken(token);
  const record = await prisma.verificationToken.findFirst({ where: {
    identifier: { startsWith: "password-reset:" }, token: tokenHash, expires: { gt: new Date() },
  } });
  if (!record) return false;
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.$transaction(async (tx) => {
    // Delete and change the password atomically: only one concurrent redemption wins.
    const claimed = await tx.verificationToken.deleteMany({ where: {
      identifier: record.identifier, token: tokenHash, expires: { gt: new Date() },
    } });
    if (claimed.count !== 1) return false;
    await tx.user.update({ where: { id: record.identifier.slice("password-reset:".length) }, data: { passwordHash } });
    await tx.verificationToken.deleteMany({ where: { identifier: record.identifier } });
    return true;
  });
}
