import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LexGuard AI – Contract Risk Analyzer",
  description: "AI contract risk detection and RAG chat",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
