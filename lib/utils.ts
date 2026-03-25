import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/* -------------------------------------------------------------------------- */
/*  Classname utility (Tailwind + clsx)                                       */
/* -------------------------------------------------------------------------- */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* -------------------------------------------------------------------------- */
/*  Resolve app base URL (emails, server-side absolute links).                 */
/*  Production (e.g. Render): set NEXT_PUBLIC_APP_URL; do not rely on        */
/*  Vercel-only vars. VERCEL_URL is an optional fallback for local previews.   */
/* -------------------------------------------------------------------------- */
export function getBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    return appUrl;
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
  }

  return "http://localhost:3000";
}
