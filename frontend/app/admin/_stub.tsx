import { Clock } from "lucide-react";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: "#F1F5F9" }}>{title}</h1>
        <p className="mt-1 text-sm" style={{ color: "#94A3B8" }}>{description}</p>
      </div>
      <div
        className="rounded-xl p-12 flex flex-col items-center gap-3"
        style={{ background: "#16191F", border: "1px solid #262932" }}
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "rgba(33,156,70,0.12)" }}
        >
          <Clock size={24} style={{ color: "#219C46" }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: "#E2E8F0" }}>Скоро будет</p>
        <p className="text-xs text-center max-w-md" style={{ color: "#64748B" }}>
          Раздел в разработке. После запуска MVP добавим аналитику, инструменты управления и интеграции.
        </p>
      </div>
    </div>
  );
}
