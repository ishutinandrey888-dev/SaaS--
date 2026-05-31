import type { Metadata } from "next";
import { LeadMagnetPage } from "@/components/marketing-conversion";

export const metadata: Metadata = {
  title: "Бесплатный AI-аудит кампании — ДОЖИМ-АЙ",
  description: "Получите бесплатный AI-аудит одной кампании Яндекс Директ и PDF-отчёт с найденными утечками бюджета.",
};

export default function Page() {
  return <LeadMagnetPage />;
}
