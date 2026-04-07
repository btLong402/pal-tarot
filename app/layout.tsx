import type { Metadata } from "next";
import { Be_Vietnam_Pro, Noto_Serif } from "next/font/google";
import "./globals.css";

const bodyFont = Be_Vietnam_Pro({
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "vietnamese"],
});

const titleFont = Noto_Serif({
  variable: "--font-title",
  weight: ["500", "600", "700"],
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "PAL Tarot | Ritual Reading Studio",
  description:
    "PAL Tarot mang đến trải nghiệm rút bài trực quan với bố cục rõ ràng, hiệu ứng xáo 3D và thông điệp chiêm nghiệm cá nhân hóa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${bodyFont.variable} ${titleFont.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
