import type { ReactNode } from "react";
import "./globals.css";

import AppProviders from "./providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <AppProviders>
          {/* Top navigation bar */}
          <SiteHeader />

          {/* Main page content */}
          <main className="flex-1">{children}</main>

          {/* Footer with beta feedback */}
          <SiteFooter />
        </AppProviders>
      </body>
    </html>
  );
}
