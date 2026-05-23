import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "Build Profit Solutions | Construction estimating and job costing",
    template: "%s | Build Profit Solutions",
  },
  description: siteConfig.description,
  openGraph: {
    title: "Build Profit Solutions",
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: "Build Profit Solutions",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Build Profit Solutions",
    description: siteConfig.description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
