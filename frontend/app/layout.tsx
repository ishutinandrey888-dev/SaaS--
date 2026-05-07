import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ДОЖИМ-АЙ — AI-агенты для Яндекс Директа",
  description:
    "AI-агент следит за рекламой 24/7: аудитит, ищет точки роста, в автопилоте применяет изменения через API.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body className="min-h-screen bg-ink-0 text-ink-900 antialiased">
        {children}
      </body>
    </html>
  );
}
