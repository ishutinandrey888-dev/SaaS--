import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaaS Direct — AI-аудит и улучшение рекламы",
  description:
    "Загрузите Excel из Яндекс Директ и получите аудит каждого объявления за 60 секунд.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
