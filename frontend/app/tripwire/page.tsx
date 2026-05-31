import type { Metadata } from "next";
import { TripwirePage } from "@/components/marketing-conversion";

export const metadata: Metadata = {
  title: "Полный AI-аудит за 490 ₽ — ДОЖИМ-АЙ",
  description: "Разовый полный AI-аудит рекламного аккаунта с PDF-отчётом, оценкой потерь и планом роста.",
};

export default function Page() {
  return <TripwirePage />;
}
