import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user
    ? // @ts-expect-error custom field
      (req.auth.user.role as string)
    : null;

  // Admin routes require ADMIN role
  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn || role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // Protected customer routes
  if (pathname.startsWith("/mine-ordrer") || pathname.startsWith("/konto")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url),
      );
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/mine-ordrer/:path*", "/konto/:path*"],
};
