import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ДОЖИМ-АЙ — AI-агент для рекламы в Яндекс Директе",
  description:
    "AI-агент следит за контекстной рекламой 24/7: аудитит, ищет точки роста, в автопилоте применяет изменения через API.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=Unbounded:wght@400;700;900&family=Onest:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-ink-0 text-ink-900 antialiased">
        {children}
      </body>
    </html>
  );
}
