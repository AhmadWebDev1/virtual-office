import type { Metadata, Viewport } from "next";
import "@fontsource-variable/cairo/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "المكتب الافتراضي | غرفة عمليات الوكلاء",
  description:
    "لوحة تحكم تفاعلية لفريق من الوكلاء الأذكياء في مكتب افتراضي بتصميم بيكسل آرت، مع أوامر مباشرة وإدارة للمهام والغرف.",
  applicationName: "المكتب الافتراضي",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#11211d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
