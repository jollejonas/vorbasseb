// Enable again when the fanclub is ready to open publicly.
export const FANCLUB_ENABLED = false;

export function isFanclubLink(href: string | null | undefined): boolean {
  if (!href) return false;
  try {
    const path = new URL(href, "https://vorbasseboldklub.dk").pathname;
    return path === "/fanklub" || path.startsWith("/fanklub/");
  } catch {
    return false;
  }
}
