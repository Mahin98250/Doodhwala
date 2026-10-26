import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./features.css";
import "./stability.css";

export const metadata: Metadata = {
  title: {
    default: "Doodhwala — Fresh milk from local sellers",
    template: "%s | Doodhwala",
  },
  description:
    "Discover independent milk sellers near you, compare options, and order directly from your neighbourhood.",
  applicationName: "Doodhwala",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Doodhwala" },
};

export const viewport: Viewport = {
  themeColor: "#175a3c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
