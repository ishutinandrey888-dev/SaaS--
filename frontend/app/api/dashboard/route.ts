import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    cards: [
      { title: "Радар конкурентов", href: "/lead-magnet" },
      { title: "Аналитика", href: "/analytics" },
      { title: "Настройки", href: "/settings" },
      { title: "Яндекс", href: "/yandex" }
    ]
  });
}
