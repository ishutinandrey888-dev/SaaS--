import type { Metadata } from "next";
import { RoiCalculatorPage } from "@/components/marketing-conversion";

export const metadata: Metadata = {
  title: "ROI-калькулятор ДОЖИМ-АЙ",
  description: "Рассчитайте окупаемость ДОЖИМ-АЙ и примерную экономию рекламного бюджета на ваших данных.",
};

export default function Page() {
  return <RoiCalculatorPage />;
}
