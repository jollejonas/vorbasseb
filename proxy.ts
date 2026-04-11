import { auth } from "@/auth";
import { NextResponse } from "next/server";

// In-memory sliding window rate limiter: 5 requests per 60 seconds per IP.
// Works for self-hosted Next.js where module state persists within the process.
// For multi-instance deployments, replace with @upstash/ratelimit backed by Redis.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

const ipWindows = new Map<string, number[]>();

function getIp(req: { headers: { get: (k: string) => string | null } }): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function checkRateLimit(ip: string): { limited: boolean; retryAfterSecs: number } {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const timestamps = (ipWindows.get(ip) ?? []).filter((t) => t > cutoff);

  if (timestamps.length >= MAX_REQUESTS) {
    const retryAfterSecs = Math.ceil((timestamps[0] + WINDOW_MS - now) / 1000);
    return { limited: true, retryAfterSecs };
  }

  timestamps.push(now);
  ipWindows.set(ip, timestamps);
  return { limited: false, retryAfterSecs: 0 };
}

const RATE_LIMITED_PATHS = new Set([
  "/api/auth/callback/credentials",
  "/api/auth/register",
]);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Rate limit brute-force sensitive endpoints
  if (RATE_LIMITED_PATHS.has(pathname)) {
    const ip = getIp(req);
    const { limited, retryAfterSecs } = checkRateLimit(ip);
    if (limited) {
      return new NextResponse(
        JSON.stringify({ error: "For mange forsøg. Prøv igen om lidt." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSecs),
          },
        },
      );
    }
  }

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
  matcher: [
    "/admin/:path*",
    "/mine-ordrer/:path*",
    "/konto/:path*",
    "/api/auth/callback/credentials",
    "/api/auth/register",
  ],
};
