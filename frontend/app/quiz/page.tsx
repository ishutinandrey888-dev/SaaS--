import type { Metadata } from "next";
import { QuizFunnel } from "@/components/marketing-conversion";

export const metadata: Metadata = {
  title: "Быстрая диагностика рекламы — ДОЖИМ-АЙ",
  description: "Ответьте на 3 вопроса и получите предварительную оценку потерь бюджета в Яндекс Директе.",
};

export default function QuizPage() {
  return <QuizFunnel />;
}
