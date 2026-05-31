"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

const money = (value: number) => `${Math.round(value).toLocaleString("ru-RU")} ₽`;

export function RoiCalculator() {
  const [budget, setBudget] = useState(200000);
  const [cpa, setCpa] = useState(1500);
  const [audit, setAudit] = useState("week");
  const [minus, setMinus] = useState("launch");

  const result = useMemo(() => {
    const tariff = budget >= 500000 ? 19900 : 5990;
    let lossRate = 0.1;
    if (audit === "week") lossRate += 0.04;
    if (audit === "month") lossRate += 0.08;
    if (audit === "rare") lossRate += 0.12;
    if (minus === "launch") lossRate += 0.04;
    if (minus === "never") lossRate += 0.08;
    lossRate = Math.min(lossRate, 0.33);

    const loss = budget * lossRate;
    const saving = loss * 0.78;
    const cpaReduction = lossRate * 0.6;
    const convGain = cpaReduction * 1.3;
    const paybackDays = Math.ceil(tariff / (saving / 30));
    const recommendedPlan = budget >= 500000 ? "AGENCY" : "PRO";

    return { loss, saving, cpaReduction, convGain, paybackDays, tariff, recommendedPlan };
  }, [budget, audit, minus]);

  return (
    <div className="conversion-grid" style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 24, alignItems: "stretch" }}>
      <div style={{ background: "#111418", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 28 }}>
        <RangeControl label="Рекламный бюджет в месяц" value={budget} min={30000} max={3000000} step={10000} onChange={setBudget} />
        <RangeControl label="Сколько сейчас стоит одна заявка" value={cpa} min={200} max={50000} step={100} onChange={setCpa} />
        <SelectControl label="Как часто вы проверяете, что реклама не тратит деньги впустую?" value={audit} onChange={setAudit} options={[
          ["daily", "Почти каждый день"],
          ["week", "Примерно раз в неделю"],
          ["month", "Раз в месяц"],
          ["rare", "Не уверен, что это вообще делается"],
        ]} />
        <SelectControl label="Как часто чистите нецелевые запросы и мусорный трафик?" value={minus} onChange={setMinus} options={[
          ["regular", "Регулярно, по отчётам"],
          ["launch", "Настроили при запуске и редко возвращаемся"],
          ["never", "Не уверены, что это вообще делается"],
        ]} />
      </div>

      <div style={{
        background: "#111418", border: "1px solid #219C46", borderRadius: 20, padding: 28,
        boxShadow: "0 0 40px rgba(33,156,70,0.1)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>
          Ваш быстрый расчёт
        </div>
        <div style={{ textAlign: "center", paddingBottom: 22, borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 6 }}>Можно вернуть в месяц</div>
          <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 40, fontWeight: 900, color: "#4ADE80", lineHeight: 1 }}>
            {money(result.saving)}
          </div>
        </div>
        <ResultRow label="Текущие потери" value={money(result.loss)} color="#F87171" />
        <ResultRow label="Прогноз снижения CPA" value={`−${Math.round(result.cpaReduction * 100)}%`} color="#4ADE80" />
        <ResultRow label="Прирост конверсий" value={`+${Math.round(result.convGain * 100)}%`} color="#4ADE80" />
        <ResultRow label="Рекомендуемый тариф" value={`${result.recommendedPlan} · ${money(result.tariff)}/мес`} color="#FBBF24" />
        <div style={{ background: "rgba(33,156,70,0.08)", border: "1px solid rgba(33,156,70,0.22)", borderRadius: 12, padding: 16, textAlign: "center", margin: "18px 0" }}>
          <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 26, fontWeight: 900, color: "#4ADE80" }}>
            {result.paybackDays <= 1 ? "< 1 дня" : result.paybackDays < 30 ? `${result.paybackDays} дн.` : `${Math.ceil(result.paybackDays / 30)} мес.`}
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>окупаемость тарифа</div>
        </div>
        <Link href="/quiz" style={primaryButton({ display: "block", textAlign: "center", width: "100%" })}>
          Пройти квиз и получить план
        </Link>
        <div style={{ fontSize: 11, color: "#475569", textAlign: "center", lineHeight: 1.5, marginTop: 10 }}>
          Расчёт ориентировочный. Точный прогноз появится после AI-аудита кампаний.
        </div>
      </div>
    </div>
  );
}

export function RoiCalculatorPage() {
  return (
    <ToolPageShell eyebrow="Калькулятор окупаемости" title="Посчитайте, сколько денег вернёт ДОЖИМ-АЙ" subtitle="Пользователь сначала видит выгоду в своих цифрах, а уже потом получает CTA. Это сильнее, чем просить регистрацию сразу.">
      <RoiCalculator />
      <div className="conversion-strip" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 24 }}>
        {[
          ["1. Увидеть потери", "Человек вводит бюджет и текущий CPA, а калькулятор переводит проблему в рубли."],
          ["2. Понять срок окупаемости", "Не просто “AI полезен”, а “тариф окупится за несколько дней”."],
          ["3. Забрать аудит", "После расчёта логичный следующий шаг — получить бесплатный разбор кампании."],
        ].map(([title, body]) => (
          <div key={title} style={miniCardStyle}>
            <div style={miniCardTitleStyle}>{title}</div>
            <div style={miniCardBodyStyle}>{body}</div>
          </div>
        ))}
      </div>
    </ToolPageShell>
  );
}

export function LeadMagnetPage() {
  return (
    <ToolPageShell eyebrow="Лид-магнит" title="Бесплатный AI-аудит одной кампании" subtitle="Низкий порог входа для холодного трафика: вместо покупки пользователь оставляет контакты и получает измеримую пользу.">
      <div className="conversion-grid" style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 28, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 14 }}>
          {[
            ["Полный разбор кампании", "AI проверит CTR, CPA, минус-слова, ставки, объявления и покажет, где утекают деньги."],
            ["Оценка потерь в рублях", "Формулировка не “есть проблемы”, а “вы теряете примерно 38 000 ₽ в месяц”."],
            ["Топ-3 действия", "Короткий план с прогнозом экономии по каждому пункту."],
            ["PDF-отчёт", "Документ для руководителя, директолога или подрядчика."],
          ].map(([title, body]) => (
            <div key={title} style={miniCardStyle}>
              <div style={miniCardTitleStyle}>{title}</div>
              <div style={miniCardBodyStyle}>{body}</div>
            </div>
          ))}
        </div>
        <aside style={{ background: "#111418", border: "1px solid rgba(33,156,70,0.35)", borderRadius: 22, padding: 28 }}>
          <div style={{ background: "#161B22", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 16, marginBottom: 22 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: 10 }}>Пример отчёта</div>
            {[
              ["Нецелевой трафик", "−34 200 ₽/мес", "#F87171"],
              ["CTR ниже нормы", "−12 объявлений", "#F87171"],
              ["Потенциал снижения CPA", "−28%", "#4ADE80"],
            ].map(([key, val, color]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.07)", fontSize: 12 }}>
                <span style={{ color: "#64748b" }}>{key}</span>
                <strong style={{ color }}>{val}</strong>
              </div>
            ))}
          </div>
          <LeadMagnetForm />
        </aside>
      </div>
    </ToolPageShell>
  );
}

export function TripwirePage() {
  return (
    <ToolPageShell eyebrow="Tripwire" title="Полный AI-аудит аккаунта за 490 ₽" subtitle="Микропокупка для тех, кто уже заинтересован, но ещё не готов оформлять подписку.">
      <div style={{
        background: "linear-gradient(135deg, rgba(33,156,70,0.14), rgba(74,222,128,0.06))",
        border: "1px solid rgba(33,156,70,0.32)", borderRadius: 14,
        padding: "12px 18px", display: "flex", justifyContent: "center", gap: 16,
        alignItems: "center", flexWrap: "wrap", marginBottom: 34,
      }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#F0F4F8" }}>Специальная цена заканчивается через</span>
        <span style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 18, fontWeight: 900, color: "#4ADE80" }}><TripwireTimer /></span>
        <span style={{ fontSize: 12, color: "#64748b" }}>Осталось мест по акции: <strong style={{ color: "#FBBF24" }}>7 из 20</strong></span>
      </div>

      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ color: "#64748b", fontSize: 16, textDecoration: "line-through", marginBottom: 4 }}>Обычная цена: 5 990 ₽</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <span style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 64, fontWeight: 900, color: "#4ADE80", lineHeight: 1 }}>490 ₽</span>
          <span style={{ color: "#94A3B8", fontSize: 18 }}>разовый платёж</span>
        </div>
      </div>

      <div className="landing-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 30 }}>
        {[
          ["Глубокий аудит всего аккаунта", "Кампании, группы, ключи, минус-слова, ставки и расписание."],
          ["Оценка потерь", "Сколько денег уходит впустую и на каких настройках."],
          ["12 точек роста", "План действий с прогнозом эффекта в рублях и процентах."],
          ["PDF + бенчмарки", "Отчёт, который удобно передать команде или руководителю."],
        ].map(([title, body]) => (
          <div key={title} style={miniCardStyle}>
            <div style={miniCardTitleStyle}>{title}</div>
            <div style={miniCardBodyStyle}>{body}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#111418", border: "2px solid #219C46", borderRadius: 24, padding: 34, textAlign: "center", boxShadow: "0 0 60px rgba(33,156,70,0.12)" }}>
        <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 24, fontWeight: 900, marginBottom: 10 }}>Запустить полный аудит сейчас</h2>
        <p style={{ color: "#94A3B8", lineHeight: 1.6, marginBottom: 24 }}>Если AI не найдёт минимум 5 точек роста — вернём деньги.</p>
        <Link href="/register?offer=audit-490" style={primaryButton({ display: "inline-flex", padding: "17px 42px", fontSize: 17 })}>Получить аудит за 490 ₽</Link>
      </div>
    </ToolPageShell>
  );
}

function ToolPageShell({ eyebrow, title, subtitle, children }: {
  eyebrow: string; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#0A0D10", color: "#F0F4F8", padding: "40px 20px 80px", fontFamily: "'Onest', sans-serif" }}>
      <main style={{ maxWidth: 980, margin: "0 auto" }}>
        <Link href="/" style={{ color: "#94A3B8", fontSize: 14, textDecoration: "none" }}>← На главную</Link>
        <div style={{ marginTop: 46, marginBottom: 38 }}>
          <div style={{ color: "#4ADE80", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>{eyebrow}</div>
          <h1 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: "clamp(32px, 5vw, 58px)", lineHeight: 1.08, fontWeight: 900, marginBottom: 16, maxWidth: 820 }}>
            {title}
          </h1>
          <p style={{ color: "#94A3B8", fontSize: 17, lineHeight: 1.65, maxWidth: 680 }}>{subtitle}</p>
        </div>
        {children}
      </main>
    </div>
  );
}

function RangeControl({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void;
}) {
  return (
    <label style={{ display: "block", marginBottom: 24 }}>
      <span style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, fontWeight: 700, color: "#F0F4F8", marginBottom: 8 }}>
        {label}
        <span style={{ color: "#4ADE80", whiteSpace: "nowrap" }}>{money(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} style={{ width: "100%", accentColor: "#219C46" }} />
    </label>
  );
}

function SelectControl({ label, value, options, onChange }: {
  label: string; value: string; options: string[][]; onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: "block", marginBottom: 20 }}>
      <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#F0F4F8", marginBottom: 8 }}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={{
        width: "100%", background: "#161B22", border: "1px solid rgba(255,255,255,0.07)",
        color: "#F0F4F8", padding: "12px 14px", borderRadius: 10, outline: "none",
      }}>
        {options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}
      </select>
    </label>
  );
}

function ResultRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
      <span style={{ color: "#94A3B8", fontSize: 13 }}>{label}</span>
      <strong style={{ color, fontSize: 14, whiteSpace: "nowrap" }}>{value}</strong>
    </div>
  );
}

export function LeadMagnetForm({ showBudget = true, compact = false }: { showBudget?: boolean; compact?: boolean } = {}) {
  const [contact, setContact] = useState("");
  const [channel, setChannel] = useState("email");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div style={{ textAlign: "center", padding: "26px 0" }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>✓</div>
        <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 19, fontWeight: 900, marginBottom: 10 }}>Заявка принята</div>
        <p style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.6 }}>
          Следующий шаг — подключить кабинет или пройти квиз, чтобы AI подготовил персональный план аудита.
        </p>
        <Link href="/roi-calculator" style={secondaryButton({ marginTop: 18 })}>Посчитать окупаемость</Link>
      </div>
    );
  }

  const placeholder = channel === "telegram" ? "@username в Telegram" : channel === "max" ? "Телефон или ID в Max" : "Email для отчёта";

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      if (contact.trim().length > 3) setSent(true);
    }}>
      {!compact && <input required placeholder="Ваше имя" style={inputStyle} />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
        {[
          ["email", "Email"],
          ["telegram", "Telegram"],
          ["max", "Max"],
        ].map(([value, label]) => (
          <button key={value} type="button" onClick={() => setChannel(value)} style={{
            background: channel === value ? "rgba(33,156,70,0.16)" : "#161B22",
            border: channel === value ? "1px solid rgba(74,222,128,0.6)" : "1px solid rgba(255,255,255,0.07)",
            color: channel === value ? "#4ADE80" : "#94A3B8",
            borderRadius: 10,
            padding: "10px 8px",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
          }}>{label}</button>
        ))}
      </div>
      <input required type={channel === "email" ? "email" : "text"} value={contact} onChange={(event) => setContact(event.target.value)} placeholder={placeholder} style={inputStyle} />
      {showBudget && (
        <select required style={inputStyle} defaultValue="">
          <option value="" disabled>Рекламный бюджет в месяц</option>
          <option>До 100 000 ₽</option>
          <option>100 000 — 500 000 ₽</option>
          <option>500 000 — 1 500 000 ₽</option>
          <option>1 500 000 ₽+</option>
        </select>
      )}
      <button type="submit" style={{ ...primaryButton({ width: "100%" }), border: "none", cursor: "pointer" }}>
        Получить отчёт
      </button>
      <div style={{ fontSize: 11, color: "#475569", textAlign: "center", marginTop: 10 }}>Отправим туда, где вам удобнее. Без спама.</div>
    </form>
  );
}

export function TripwireTimer() {
  const [seconds, setSeconds] = useState(23 * 3600 + 47 * 60 + 12);

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");

  return <span>{h}:{m}:{s}</span>;
}

export function LiveActivityWidget() {
  const items = [
    ["AI нашёл утечку на 28 400 ₽", "Нецелевой трафик · только что"],
    ["CPA снижен с 1 820 до 1 190 ₽", "Оптимизация ставок · 2 мин."],
    ["Новая точка роста найдена", "Прогноз +18% конверсий · 3 мин."],
  ];
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = () => {
      setIndex((value) => value + 1);
      setVisible(true);
      window.setTimeout(() => setVisible(false), 5200);
    };
    const first = window.setTimeout(show, 1800);
    const interval = window.setInterval(show, 10500);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);

  const item = items[index % items.length];

  return (
    <div style={{
      position: "fixed",
      left: 24,
      bottom: "20vh",
      zIndex: 80,
      maxWidth: 320,
      display: "flex",
      gap: 12,
      alignItems: "flex-start",
      padding: "14px 16px",
      borderRadius: 14,
      border: "1px solid rgba(33,156,70,0.35)",
      background: "#111418",
      boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 22px rgba(33,156,70,0.08)",
      opacity: visible ? 1 : 0,
      pointerEvents: "none",
      transform: visible ? "translateY(0)" : "translateY(96px)",
      transition: "opacity 0.35s ease, transform 0.35s ease",
    }}>
      <div style={{ fontSize: 20, flexShrink: 0 }}>↗</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#F0F4F8", lineHeight: 1.35 }}>{item[0]}</div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{item[1]}</div>
      </div>
      <span className="live-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ADE80", flexShrink: 0, marginTop: 5 }} />
    </div>
  );
}

export function ExitIntentPopup() {
  const [visible, setVisible] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (window.sessionStorage.getItem("dozim_exit_popup_seen") === "1") return;

    const show = () => {
      if (window.sessionStorage.getItem("dozim_exit_popup_seen") === "1") return;
      window.sessionStorage.setItem("dozim_exit_popup_seen", "1");
      setVisible(true);
    };
    const onMouseLeave = (event: MouseEvent) => {
      if (event.clientY <= 4) show();
    };
    const onScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll > 0 && window.scrollY / maxScroll > 0.72) show();
    };

    document.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 190, background: "rgba(0,0,0,0.75)",
      backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "#111418", border: "1px solid rgba(33,156,70,0.42)", borderRadius: 26,
        padding: "clamp(24px, 4vw, 34px)", maxWidth: 456, width: "100%", position: "relative",
        boxShadow: "0 20px 80px rgba(0,0,0,0.6), 0 0 60px rgba(33,156,70,0.08)",
      }}>
        <button type="button" onClick={() => setVisible(false)} aria-label="Закрыть" style={{
          position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.07)", background: "#161B22", color: "#94A3B8", cursor: "pointer",
        }}>×</button>

        {!sent ? (
          <form onSubmit={(event) => {
            event.preventDefault();
            setSent(true);
          }}>
            <div style={{
              width: 38, height: 38, marginBottom: 24,
              background: "linear-gradient(180deg, #ff755f 0%, #ef2506 62%, #cc1600 100%)",
              clipPath: "polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)",
              boxShadow: "inset 0 7px 0 rgba(255,255,255,0.25)",
            }} />
            <span style={{ display: "inline-block", background: "rgba(33,156,70,0.1)", border: "1px solid rgba(33,156,70,0.28)", color: "#4ADE80", fontSize: 11, fontWeight: 900, padding: "5px 13px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
              Подождите — это бесплатно
            </span>
            <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: "clamp(25px, 3.2vw, 30px)", lineHeight: 1.12, fontWeight: 900, marginBottom: 12 }}>
              Перед уходом — возьмите чек-лист
            </h2>
            <p style={{ fontSize: 15, color: "#94A3B8", lineHeight: 1.55, marginBottom: 18 }}>
              “12 утечек бюджета в Яндекс Директ” — PDF на 8 страниц. Наши клиенты находят в среднем 4–7 пунктов у себя.
            </p>
            {["Топ-12 причин слива бюджета", "Короткая проверка каждой причины", "Мини-калькулятор потерь внутри"].map((item) => (
              <div key={item} style={{ display: "flex", gap: 10, color: "#94A3B8", fontSize: 14, marginBottom: 8 }}>
                <span style={{ color: "#4ADE80", fontWeight: 900 }}>✓</span>
                {item}
              </div>
            ))}
            <input required type="email" placeholder="Ваш email для отправки" style={{ ...inputStyle, marginTop: 18, padding: "14px 16px", fontSize: 14, borderRadius: 12 }} />
            <button type="submit" style={{ ...primaryButton({ width: "100%", padding: "15px 20px", fontSize: 15, borderRadius: 13 }), border: 0, cursor: "pointer" }}>Получить чек-лист →</button>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 12, textAlign: "center" }}>Без спама. Отписаться в 1 клик.</div>
            <button type="button" onClick={() => setVisible(false)} style={{ display: "block", width: "100%", background: "transparent", border: 0, color: "#64748b", fontSize: 13, marginTop: 12, cursor: "pointer", textDecoration: "underline" }}>
              Нет, я готов терять деньги дальше
            </button>
          </form>
        ) : (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 46, marginBottom: 12 }}>✓</div>
            <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 20, fontWeight: 900, marginBottom: 10 }}>Чек-лист отправлен</h2>
            <p style={{ color: "#94A3B8", fontSize: 14, lineHeight: 1.65 }}>Проверьте почту. Следующий полезный шаг — рассчитать окупаемость ДОЖИМ-АЙ на ваших цифрах.</p>
            <Link href="/roi-calculator" onClick={() => setVisible(false)} style={secondaryButton({ marginTop: 18 })}>Открыть калькулятор</Link>
          </div>
        )}
      </div>
    </div>
  );
}

export function TimedQuizPopup() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const done = step >= quizSteps.length;
  const score = answers.reduce((sum, answer) => sum + (answer.includes("500") || answer.includes("1 500") || answer.includes("сливается") ? 2 : 1), 0);
  const loss = score > 5 ? 112000 : score > 3 ? 64000 : 28000;

  useEffect(() => {
    if (window.sessionStorage.getItem("dozim_quiz_popup_seen") === "1") return;
    const timer = window.setTimeout(() => {
      window.sessionStorage.setItem("dozim_quiz_popup_seen", "1");
      setVisible(true);
    }, 35000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 180, background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 640, background: "#111418", border: "1px solid rgba(33,156,70,0.45)",
        borderRadius: 24, padding: "clamp(24px, 5vw, 36px)", position: "relative",
        boxShadow: "0 22px 80px rgba(0,0,0,0.58), 0 0 60px rgba(33,156,70,0.08)",
      }}>
        <button type="button" onClick={() => setVisible(false)} aria-label="Закрыть квиз" style={{
          position: "absolute", top: 16, right: 16, width: 34, height: 34, borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.1)", background: "#161B22", color: "#94A3B8", cursor: "pointer", fontSize: 20,
        }}>×</button>
        <div style={{ color: "#4ADE80", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
          Быстрый квиз · 35 секунд
        </div>
        {!done ? (
          <>
            <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: "clamp(24px, 4vw, 34px)", lineHeight: 1.12, fontWeight: 900, marginBottom: 18 }}>
              {quizSteps[step].q}
            </h2>
            <div style={{ height: 6, background: "#161B22", borderRadius: 999, overflow: "hidden", marginBottom: 22 }}>
              <div style={{ width: `${((step + 1) / quizSteps.length) * 100}%`, height: "100%", background: "#219C46" }} />
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {quizSteps[step].a.map((answer) => (
                <button key={answer} type="button" onClick={() => {
                  setAnswers((value) => [...value, answer]);
                  setStep((value) => value + 1);
                }} style={{
                  width: "100%", textAlign: "left", background: "#161B22", color: "#F0F4F8",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "15px 16px",
                  cursor: "pointer", fontSize: 15, fontWeight: 800,
                }}>{answer}</button>
              ))}
            </div>
          </>
        ) : (
          <div>
            <div style={{ color: "#4ADE80", fontSize: 13, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              Предварительный результат
            </div>
            <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: "clamp(28px, 4vw, 40px)", lineHeight: 1.1, fontWeight: 900, marginBottom: 16 }}>
              Потенциальные потери: <span style={{ color: "#4ADE80" }}>{money(loss)}/мес</span>
            </h2>
            <p style={{ color: "#94A3B8", lineHeight: 1.6, marginBottom: 18 }}>
              Получите расширенный отчёт и рекомендации к действиям.
            </p>
            <LeadMagnetForm showBudget={false} compact />
          </div>
        )}
      </div>
    </div>
  );
}

const quizSteps = [
  { q: "Какой бюджет в Яндекс Директ вы контролируете?", a: ["До 100 000 ₽", "100 000 — 500 000 ₽", "500 000 — 1 500 000 ₽", "1 500 000 ₽+"] },
  { q: "Что болит сильнее всего?", a: ["Не понимаю, где сливается бюджет", "Много ручной аналитики", "Нужен рост заявок без роста бюджета"] },
  { q: "Кто будет использовать ДОЖИМ-АЙ?", a: ["Собственник", "Маркетолог", "Агентство"] },
];

export function QuizFunnel() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const done = step >= quizSteps.length;
  const score = answers.reduce((sum, answer) => sum + (answer.includes("500") || answer.includes("1 500") || answer.includes("сливается") ? 2 : 1), 0);
  const loss = score > 6 ? 112000 : score > 4 ? 64000 : 28000;

  return (
    <div style={{ minHeight: "100vh", background: "#0A0D10", color: "#F0F4F8", padding: "40px 20px", fontFamily: "'Onest', sans-serif", overflowX: "hidden" }}>
      <div className="quiz-shell" style={{ maxWidth: 980, margin: "0 auto" }}>
        <Link href="/" style={{ color: "#94A3B8", fontSize: 14, textDecoration: "none" }}>← На главную</Link>
        <div className="quiz-grid" style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 28, alignItems: "start", marginTop: 42 }}>
          <div>
            <div style={{ color: "#4ADE80", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
              Быстрая диагностика рекламы · 2 минуты
            </div>
            <h1 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.1, fontWeight: 900, marginBottom: 18, maxWidth: "100%", overflowWrap: "break-word" }}>
              Узнайте, сколько денег теряет ваша реклама
            </h1>
            <p style={{ color: "#94A3B8", fontSize: 16, lineHeight: 1.65, maxWidth: 620, marginBottom: 36, overflowWrap: "break-word" }}>
              Ответьте на 3 вопроса — покажем примерную сумму потерь и предложим самый короткий путь к первому результату.
            </p>

            <div style={{ background: "#111418", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 22, padding: "clamp(20px, 4vw, 28px)", maxWidth: "100%" }}>
              {!done ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
                    <span style={{ color: "#64748b", fontSize: 13 }}>Вопрос {step + 1} из {quizSteps.length}</span>
                    <span style={{ color: "#4ADE80", fontSize: 13 }}>{Math.round((step / quizSteps.length) * 100)}%</span>
                  </div>
                  <div style={{ height: 6, background: "#161B22", borderRadius: 999, overflow: "hidden", marginBottom: 28 }}>
                    <div style={{ width: `${((step + 1) / quizSteps.length) * 100}%`, height: "100%", background: "#219C46" }} />
                  </div>
                  <h2 style={{ fontSize: "clamp(19px, 3vw, 22px)", lineHeight: 1.3, fontWeight: 800, marginBottom: 18, overflowWrap: "break-word" }}>{quizSteps[step].q}</h2>
                  <div style={{ display: "grid", gap: 12 }}>
                    {quizSteps[step].a.map((answer) => (
                      <button key={answer} type="button" onClick={() => {
                        setAnswers((value) => [...value, answer]);
                        setStep((value) => value + 1);
                      }} style={{
                        width: "100%", textAlign: "left", background: "#161B22", color: "#F0F4F8",
                        border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px 18px",
                        cursor: "pointer", fontSize: 15, fontWeight: 700,
                      }}>
                        {answer}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div>
                  <div style={{ color: "#4ADE80", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                    Предварительный результат
                  </div>
                  <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 34, lineHeight: 1.12, fontWeight: 900, marginBottom: 16 }}>
                    Потенциальные потери: <span style={{ color: "#4ADE80" }}>{money(loss)}/мес</span>
                  </h2>
                  <p style={{ color: "#94A3B8", lineHeight: 1.6, marginBottom: 18 }}>
                    Получите расширенный отчёт и рекомендации к действиям.
                  </p>
                  <LeadMagnetForm showBudget={false} compact />
                </div>
              )}
            </div>
          </div>

          <aside style={{ background: "#111418", border: "1px solid rgba(33,156,70,0.35)", borderRadius: 20, padding: 24 }}>
            <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800, marginBottom: 16 }}>
              Что получите после квиза
            </div>
            {["Оценку потерь в рублях", "Подходящий сценарий внедрения", "Рекомендацию тарифа", "Бесплатный AI-аудит кампании"].map((item) => (
              <div key={item} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.07)", color: "#94A3B8", fontSize: 14 }}>
                <span style={{ color: "#4ADE80", fontWeight: 900 }}>✓</span>
                {item}
              </div>
            ))}
          </aside>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: "#161B22",
  border: "1px solid rgba(255,255,255,0.07)",
  color: "#F0F4F8",
  padding: "13px 15px",
  borderRadius: 10,
  fontSize: 14,
  marginBottom: 12,
  outline: "none",
};

const miniCardStyle = {
  background: "#111418",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 16,
  padding: 22,
};

const miniCardTitleStyle = {
  color: "#F0F4F8",
  fontSize: 15,
  fontWeight: 800,
  marginBottom: 7,
};

const miniCardBodyStyle = {
  color: "#94A3B8",
  fontSize: 13,
  lineHeight: 1.55,
};

function primaryButton(extra: CSSProperties = {}) {
  return {
    background: "#219C46",
    color: "#fff",
    padding: "15px 24px",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 800,
    textDecoration: "none",
    boxShadow: "0 4px 26px rgba(33,156,70,0.3)",
    ...extra,
  };
}

function secondaryButton(extra: CSSProperties = {}) {
  return {
    display: "inline-flex",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#94A3B8",
    padding: "12px 18px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    textDecoration: "none",
    ...extra,
  };
}
