import "~/styles/globals.css";

import { type Metadata } from "next";
import Script from "next/script";
import { Geist, Merriweather } from "next/font/google";

import { cn } from "~/lib/utils";
import { TRPCReactProvider } from "~/trpc/react";
import { NavBar } from "~/app/_components/nav-bar";

const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-serif",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "Agent News — AI agent use cases in enterprise",
  description:
    "Curated articles about real-world AI agent implementations in enterprise and business.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("dark", geist.variable, merriweather.variable)}>
      <body>
        <TRPCReactProvider>
          <div className="relative z-10">
            <NavBar />
          </div>
          {children}
        </TRPCReactProvider>
        <Script
          defer
          src="https://analytics.bongevents.com/script.js"
          data-website-id="afc4b1dc-5006-4bba-9d61-827e7e65a2b5"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
