import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Радар конкурентов | ДОЖИМ-АИ",
  description: "Бесплатный мини-аудит конкурентов, офферов и идей для рекламы."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
