import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import PWAInit from "@/components/PWAInit";

export const metadata: Metadata = {
  title: "Veshtit — Digital Account Manager",
  description:
    "Securely manage all your digital accounts with AES-256 encryption.",
  // icon.tsx and apple-icon.tsx in this directory are picked up automatically
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Veshtit",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0b13" },
    { media: "(prefers-color-scheme: light)", color: "#FF6B35" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <PWAInit />
      </body>
    </html>
  );
}
