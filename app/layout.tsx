import type { ReactNode } from "react";
import "./globals.css";

import AppProviders from "./providers";
import { SiteHeader } from "@/components/layout/site-header";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          {/* TOP NAVIGATION BAR */}
          <SiteHeader />

          {/* MAIN PAGE CONTENT */}
          <main>{children}</main>
        </AppProviders>
      </body>
    </html>
  );
}
