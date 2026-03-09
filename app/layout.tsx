import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CX 대시보드 | 채널톡",
  description: "채널톡 상담 건수 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
