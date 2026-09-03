import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AdFlow",
  description: "Generate and launch Meta ad drafts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
