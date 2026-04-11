import { Metadata } from "next";
import { AdminSetupForm } from "@/components/auth/AdminSetupForm";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Opret admin-konto" };

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function AdminSetupPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) redirect("/login");

  const invite = await prisma.adminInviteToken.findUnique({ where: { token } });

  if (!invite || invite.expiresAt < new Date()) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2">Ugyldigt link</h1>
          <p className="text-gray-500">
            Dette invitationslink er enten udløbet eller ugyldigt. Bed en admin om at sende en ny invitation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Opret admin-konto</h1>
          <p className="text-gray-500 mt-2">Vælg et navn og en adgangskode til din konto.</p>
        </div>
        <AdminSetupForm token={token} email={invite.email} />
      </div>
    </div>
  );
}
