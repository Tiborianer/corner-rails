import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const previewImage = new URL("/og.png", metadataBase).toString();

  return {
    metadataBase,
    title: "Corner Rails — A Pocket-Sized Rail Empire",
    description:
      "Build a tiny German station into an international terminus in this isometric incremental train game.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Corner Rails",
      description: "Build a corner. Connect a continent.",
      type: "website",
      images: [{ url: previewImage, width: 1536, height: 864, alt: "Corner Rails isometric station diorama" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Corner Rails",
      description: "Build a corner. Connect a continent.",
      images: [previewImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
