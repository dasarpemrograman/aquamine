import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { plusJakartaSans } from "./fonts/plus-jakarta-sans";
import "./globals.css";
import "leaflet/dist/leaflet.css";

import { bootstrapSuperadmin } from "@/lib/bootstrap";
import { FieldModeProvider } from "./context/FieldModeContext";
import { ThemeProvider } from "./context/ThemeContext";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aquamine.web.id";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AquaMine - Acid Mine Drainage Monitoring System",
    template: "%s | AquaMine",
  },
  description:
    "AquaMine is an intelligent early warning system for Acid Mine Drainage (AMD) monitoring. Real-time IoT telemetry, time-series forecasting, anomaly detection, and AI-powered analysis.",
  keywords: [
    "Acid Mine Drainage",
    "AMD monitoring",
    "environmental monitoring",
    "IoT sensors",
    "water quality",
    "mining environmental impact",
    "real-time monitoring",
    "anomaly detection",
    "time-series forecasting",
    "environmental dashboard",
  ],
  authors: [{ name: "AquaMine Team" }],
  creator: "AquaMine",
  publisher: "AquaMine",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "AquaMine",
    title: "AquaMine - Acid Mine Drainage Monitoring System",
    description:
      "Intelligent early warning system for Acid Mine Drainage monitoring with real-time IoT telemetry and AI-powered analysis.",
    images: [
      {
        url: "/og-image.webp",
        width: 1200,
        height: 630,
        alt: "AquaMine Dashboard - Acid Mine Drainage Monitoring",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AquaMine - Acid Mine Drainage Monitoring System",
    description:
      "Intelligent early warning system for Acid Mine Drainage monitoring with real-time IoT telemetry and AI-powered analysis.",
    images: ["/og-image.webp"],
    creator: "@aquamine",
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.webp", type: "image/webp", sizes: "32x32" },
      { url: "/favicon-16x16.webp", type: "image/webp", sizes: "16x16" },
    ],
    shortcut: "/favicon-32x32.webp",
    apple: "/favicon-32x32.webp",
    other: [
      {
        rel: "mask-icon",
        url: "/favicon-32x32.webp",
      },
    ],
  },
  manifest: "/manifest.json",
  category: "technology",
  classification: "Environmental Monitoring Software",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  try {
    await bootstrapSuperadmin();
  } catch (error) {
    console.error("Bootstrap error:", error);
  }

  return (
    <ClerkProvider
      appearance={{
        elements: {
          footer: "hidden",
          footerAction: "hidden",
          footerActionText: "hidden",
          footerActionLink: "hidden",
        },
      }}
    >
      <html lang="en">
        <body
          className={`${plusJakartaSans.variable} antialiased text-slate-900 bg-slate-50`}
        >
          <FieldModeProvider>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </FieldModeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
