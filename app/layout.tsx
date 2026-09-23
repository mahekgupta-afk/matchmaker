import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tonight — pick something you'll both actually watch",
  description: "Two partners, one swipe deck, zero scrolling. Find tonight's movie or show together.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col items-center bg-[var(--background)]">
        <div className="flex min-h-screen w-full max-w-md flex-col bg-[var(--background)] px-5 py-6">
          {children}
        </div>
      </body>
    </html>
  );
}
