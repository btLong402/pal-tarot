import type { Metadata } from "next";
import { Cormorant_Garamond, Spectral } from "next/font/google";
import "./globals.css";

const bodyFont = Spectral({
  variable: "--font-body",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const titleFont = Cormorant_Garamond({
  variable: "--font-title",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PAL Tarot | Không gian chiêm nghiệm",
  description:
    "PAL Tarot mang đến trải nghiệm rút bài trực quan với hiệu ứng xáo, lật 3D và thông điệp chiêm nghiệm cá nhân hóa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${bodyFont.variable} ${titleFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
