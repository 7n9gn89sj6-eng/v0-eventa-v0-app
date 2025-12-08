import type { ReactNode } from "react";
import "./globals.css";

import AppProviders from "./providers";
import { SiteHeader } from "@/components/layout/site-header";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          {/* Top navigation bar */}
          <SiteHeader />

          {/* Main page content */}
          <main>{children}</main>
        </AppProviders>
      </body>
    </html>
  );
}
