import Link from "next/link";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ExitIntentPopup, LiveActivityWidget, TimedQuizPopup } from "@/components/marketing-conversion";

/* ── DATA ─────────────────────────────────────────────── */

const PAIN_ITEMS = [
  { icon: "💰", title: "Скрытые утечки", body: "Неэффективные площадки и ключи съедают до 30% бюджета.", tag: "Потеря бюджета" },
  { icon: "👁️", title: "Человеческий фактор", body: "Глаз аналитика замыливается, ошибки пропускаются.", tag: "Критично" },
  { icon: "⚡", title: "Медленная реакция", body: "Проблемы обнаруживаются слишком поздно.", tag: "Упущенное время" },
  { icon: "💸", title: "Слив бюджета на нецелевой трафик", body: "Ключевые слова и объявления, которые тратят деньги без конверсий — работают прямо сейчас в ваших кампаниях.", tag: "Критично" },
  { icon: "🔕", title: "Вы узнаёте о проблемах слишком поздно", body: "Ручной мониторинг сотен кампаний в Яндекс Директ занимает часы, а критические отклонения остаются незамеченными.", tag: "Потеря времени" },
  { icon: "📉", title: "Решения принимаются вслепую", body: "Разрозненные данные не дают полной картины. Стратегические решения принимаются на основе неполной аналитики.", tag: "Неэффективность" },
];

const BEFORE_ROWS = [
  "Аудит вручную — 3–5 часов в неделю",
  "Ошибки замечаете через дни",
  "До 30% бюджета уходит впустую",
  "Решения на ощущениях, не на данных",
  "Нет времени на стратегию — только тушите пожары",
  "Каждый клиент — отдельная таблица и рутина",
];

const AFTER_ROWS = [
  "AI мониторит 24/7 — вы видите только главное",
  "Уведомления в момент отклонения",
  "Утечки найдены и закрыты автоматически",
  "Рекомендации с прогнозом эффекта в рублях",
  "Фокус на росте — рутину берёт на себя AI",
  "Все проекты в одном кабинете, один стандарт",
];

const SOL_STATS = [
  { val: "−30%", label: "бюджета возвращается\nиз «слива»" },
  { val: "24/7", label: "мониторинг без\nвыходных и праздников" },
  { val: "87%", label: "точность\nрекомендаций AI" },
  { val: "<5 мин", label: "на запуск\nполного аудита" },
];

const HOW_STEPS = [
  { icon: "🔌", n: "01", title: "Подключите аккаунт", body: "Авторизуйтесь через Яндекс OAuth за 30 секунд. AI сразу получает доступ к вашим кампаниям." },
  { icon: "📋", n: "02", title: "Заполните бриф", body: "Расскажите о бизнесе и целях. AI обучается под ваши KPI и особенности ниши." },
  { icon: "🚀", n: "03", title: "Выберите режим", body: "Советник, Ассистент или Автопилот — выбирайте уровень автономии под свой стиль управления." },
  { icon: "📈", n: "04", title: "Смотрите результаты", body: "Еженедельные отчёты, алерты в реальном времени и история всех принятых решений." },
];

const FEATURES = [
  {
    icon: "🤖", color: "fi-green",
    title: "AI-аудит каждые 6 часов",
    body: "Полный анализ кампаний по 30+ параметрам: ключи, объявления, ставки, площадки, минус-слова, бюджеты.",
    items: ["Анализ 30+ параметров каждой кампании", "Приоритизация проблем по влиянию на KPI", "История всех найденных отклонений"],
  },
  {
    icon: "💬", color: "fi-purple",
    title: "AI-аналитик с памятью",
    body: "Чат с аналитиком, который знает вашу историю решений, помнит что сработало и учится на ваших данных.",
    items: ["Помнит все ваши решения и их эффект", "Отвечает на вопросы по данным кампаний", "Дает рекомендации с обоснованием"],
  },
  {
    icon: "📊", color: "fi-blue",
    title: "Сквозная аналитика",
    body: "Полная аналитика по Яндекс Директ в едином дашборде. Гибкие периоды, кастомные сегменты и история изменений.",
    items: ["Единый дашборд для всех кампаний Директ", "Сравнение периодов и кастомные отчёты", "История всех изменений с подтверждённым эффектом"],
  },
  {
    icon: "⚡", color: "fi-amber",
    title: "Автоматический бриф и генерация",
    body: "AI анализирует ваш сайт и конкурентов, создаёт семантику и объявления за минуты — вместо часов ручной работы.",
    items: ["Анализ сайта и конкурентов за <2 минуты", "Генерация объявлений для всех форматов Директ", "Расход по единому токеновому балансу PRO"],
  },
];

const MODES = [
  {
    icon: "🧭", badge: "Советник", badgeColor: "rgba(59,130,246,0.12)", badgeText: "#60A5FA",
    title: "AI советует — вы решаете",
    body: "Агент находит проблемы и предлагает решения. Вы проверяете каждое предложение перед применением.",
    items: ["Все рекомендации требуют вашего подтверждения", "Полная прозрачность — видите причину каждого совета", "Идеально для старта и знакомства с инструментом"],
    highlighted: false,
  },
  {
    icon: "🤝", badge: "Ассистент · Рекомендуется", badgeColor: "rgba(33,156,70,0.12)", badgeText: "#4ade80",
    title: "Мелкое — сам, крупное — вам",
    body: "Рутинные задачи AI выполняет самостоятельно. Стратегические изменения требуют вашего одобрения.",
    items: ["Автоматические минус-слова, корректировки ставок", "Бюджетные изменения — только с вашего ОК", "Оптимальный баланс скорости и контроля"],
    highlighted: true,
  },
  {
    icon: "🚀", badge: "Автопилот", badgeColor: "rgba(139,92,246,0.12)", badgeText: "#A78BFA",
    title: "Полная автономия",
    body: "AI действует самостоятельно в рамках заданных KPI. Вы получаете ежедневные отчёты о результатах.",
    items: ["Работает 24/7 без вашего участия", "Жёсткие рамки по бюджету и KPI — AI не выходит за них", "Ежедневный отчёт на почту с итогами и действиями"],
    highlighted: false,
  },
];

const PLANS = [
  {
    id: "free", name: "FREE", price: "500 токенов", period: "Бесплатно · 7 дней",
    items: ["500 токенов бесплатно на 7 дней", "1 аккаунт Яндекс Директ", "1 проект", "Реферальные токены после trial"],
    cta: "Начать бесплатно", href: "/register", highlight: false, checkColor: "#64748b",
  },
  {
    id: "pro", name: "PRO", price: "5 000 токенов", period: "5 990 ₽/мес",
    items: ["5 проектов", "Генерация изображений по брифу", "Яндекс Директ + Яндекс Метрика", "AI-аналитик с памятью", "Докупка токенов в любой момент"],
    cta: "Выбрать PRO", href: "/register?plan=pro", highlight: true, checkColor: "#4ade80",
  },
  {
    id: "agency", name: "AGENCY", price: "15 000 токенов", period: "19 900 ₽/мес",
    items: ["30 проектов", "10–20 рекламных аккаунтов", "Командные токены", "Приоритетная поддержка", "White-label отчёты"],
    cta: "Выбрать AGENCY", href: "/register?plan=agency", highlight: false, checkColor: "#A78BFA",
  },
];

const TESTIMONIALS = [
  {
    stars: "★★★★★",
    text: "«За первые две недели AI нашёл 7 проблемных кампаний, которые мы пропускали месяцами. Сократили CPA на 41% без увеличения бюджета.»",
    initials: "АК", gradFrom: "#219C46", gradTo: "#27b350",
    name: "Алексей Козлов", role: "Head of Performance, e-com",
  },
  {
    stars: "★★★★★",
    text: "«Как агентство ведём 20+ клиентов. Раньше аудит занимал 2-3 дня в месяц. Теперь — 30 минут. Клиенты получают отчёты с реальными цифрами экономии.»",
    initials: "МВ", gradFrom: "#8B5CF6", gradTo: "#9d6ef8",
    name: "Мария Волкова", role: "Директор, диджитал-агентство",
  },
  {
    stars: "★★★★★",
    text: "«Подключил на пробу, AI сразу нашёл 4 убыточные группы объявлений в Директ. Перераспределил бюджет — ROMI вырос с 180% до 336% за месяц.»",
    initials: "ДП", gradFrom: "#3B82F6", gradTo: "#60a5fa",
    name: "Дмитрий Петров", role: "Маркетолог, медицинский центр",
  },
];

const FAQ = [
  { q: "Безопасно ли давать AI доступ к рекламному кабинету?", a: "Да. Мы используем стандартный OAuth Яндекса — тот же механизм, что используют все сторонние сервисы. Токен хранится в зашифрованном виде. Никакой передачи паролей нет." },
  { q: "AI может навредить моим кампаниям?", a: "В режимах «Советник» и «Ассистент» AI не делает ничего без вашего подтверждения. В Автопилоте действуют жёсткие рамки по бюджету и KPI — AI не выйдет за них." },
  { q: "Поддерживаете VK Рекламу / Google Ads?", a: "В первой итерации — только Яндекс Директ. VK Реклама — следующая. Google Ads — по запросу." },
  { q: "Что будет, когда trial закончится?", a: "Агенты автоматически встанут на паузу. Данные не пропадают. Когда оплатите — продолжат с того же места." },
  { q: "Нужны ли технические знания для настройки?", a: "Нет. Подключение занимает 5 минут: авторизация через Яндекс, короткий бриф о бизнесе, выбор режима — и AI начинает работу." },
];

/* ── PAGE ─────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div style={{ fontFamily: "'Onest', sans-serif", background: "#0A0D10", color: "#F0F4F8", overflowX: "hidden" }}>
      <Nav />
      <LiveActivityWidget />
      <ExitIntentPopup />
      <TimedQuizPopup />
      <Hero />
      <ConversionPath />
      <Pain />
      <Solution />
      <Product3DSystem />
      <HowItWorks />
      <FeaturesSection />
      <ModesSection />
      <Pricing />
      <TestimonialsSection />
      <FaqSection />
      <CtaSection />
      <FooterSection />
    </div>
  );
}

/* ── NAV ─────────────────────────────────────────────── */

function Nav() {
  return (
    <nav className="landing-nav" style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 40px", height: 64,
      background: "rgba(10,13,16,0.85)",
      backdropFilter: "blur(20px)",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
    }}>
      <BrandLogo width={188} priority />
      <div className="landing-nav-links" style={{ display: "flex", gap: 32 }}>
        {[["/lead-magnet", "AI-аудит"], ["/roi-calculator", "Калькулятор"], ["/quiz", "Квиз"], ["#pricing", "Тарифы"]].map(([href, label]) => (
          <a key={href} href={href} style={{ color: "#94A3B8", textDecoration: "none", fontSize: 14, fontWeight: 500 }}>{label}</a>
        ))}
      </div>
      <div className="landing-nav-actions" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Link href="/login" style={{
          background: "transparent", border: "1px solid rgba(255,255,255,0.07)",
          color: "#94A3B8", padding: "9px 20px", borderRadius: 10,
          fontSize: 14, fontWeight: 500, textDecoration: "none",
        }}>Войти</Link>
        <Link href="/register" style={{
          background: "#219C46", border: "none", color: "#fff",
          padding: "9px 22px", borderRadius: 10, fontSize: 14,
          fontWeight: 600, textDecoration: "none",
        }}>Попробовать бесплатно</Link>
      </div>
    </nav>
  );
}

/* ── HERO ─────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="landing-hero" style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: "100px 40px 60px",
      position: "relative", overflow: "hidden",
    }}>
      {/* radial green glow */}
      <div style={{
        position: "absolute", width: 700, height: 700, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(33,156,70,0.12) 0%, transparent 70%)",
        top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        pointerEvents: "none",
      }} />
      {/* grid pattern */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 80%)",
        maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 80%)",
        pointerEvents: "none",
      }} />
      <HeroProductScene />

      {/* badge */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        background: "rgba(33,156,70,0.1)", border: "1px solid rgba(33,156,70,0.3)",
        color: "#4ADE80", fontSize: 12, fontWeight: 600,
        padding: "6px 16px", borderRadius: 9999, marginBottom: 28,
        letterSpacing: "0.05em", textTransform: "uppercase", position: "relative",
      }}>
        <span className="live-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ADE80", display: "inline-block" }} />
        AI-контроль Яндекс Директа 24/7
      </div>

      {/* h1 */}
      <h1 className="landing-hero-title" style={{
        fontFamily: "'Unbounded', sans-serif",
        fontSize: "clamp(36px, 5vw, 68px)", fontWeight: 900,
        lineHeight: 1.05, letterSpacing: "-0.03em",
        maxWidth: 900, marginBottom: 16, position: "relative",
      }}>
        Ваша реклама теряет деньги<br />
        <span style={{ color: "#4ADE80" }}>каждую минуту</span>
      </h1>

      {/* brand name */}
      <div className="landing-hero-brand" style={{
        fontFamily: "'Unbounded', sans-serif",
        fontSize: "clamp(48px, 7vw, 88px)", fontWeight: 900,
        letterSpacing: "-0.04em", lineHeight: 1,
        margin: "12px 0 10px",
        background: "linear-gradient(135deg, #4ADE80 0%, #219C46 50%, #16a34a 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        filter: "drop-shadow(0 0 40px rgba(74,222,128,0.3))",
        position: "relative",
      }}>
        ДОЖИМ-АЙ
      </div>

      {/* subtitle */}
      <p className="landing-hero-subtitle" style={{
        fontSize: 18, color: "#94A3B8", maxWidth: 560, lineHeight: 1.6,
        marginBottom: 40, position: "relative",
      }}>
        AI работает 24/7 — автоматизируйте мониторинг, находите точки роста и дожимайте KPI до максимума.
      </p>

      {/* buttons */}
      <div className="landing-hero-actions" style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 60, position: "relative" }}>
        <Link href="/register" style={{
          background: "#219C46", border: "none", color: "#fff",
          padding: "16px 36px", borderRadius: 14, fontSize: 16,
          fontWeight: 700, textDecoration: "none",
          boxShadow: "0 4px 30px rgba(33,156,70,0.35)",
        }}>Попробовать бесплатно</Link>
        <a href="#features" style={{
          background: "transparent", border: "1px solid rgba(255,255,255,0.07)",
          color: "#94A3B8", padding: "16px 36px", borderRadius: 14,
          fontSize: 16, fontWeight: 600, textDecoration: "none",
        }}>Смотреть демо видео о продукте</a>
      </div>

      {/* stats */}
      <div className="landing-hero-stats" style={{
        display: "flex", gap: 48,
        borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 40,
        width: "100%", maxWidth: 700, justifyContent: "center", position: "relative",
      }}>
        {[["−35%","снижение CPA"],["+112к ₽","экономия в месяц"],["87%","точность рекомендаций"],["<5 мин","на запуск аудита"]].map(([v, l]) => (
          <div key={l} style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 28, fontWeight: 900, color: "#4ADE80", lineHeight: 1 }}>{v}</div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 6, fontWeight: 500 }}>{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HeroProductScene() {
  const orbitItems = [
    { label: "CPA", value: "−35%", tone: "#4ADE80", transform: "rotateY(0deg) translateZ(210px)" },
    { label: "Минус-слова", value: "+128", tone: "#60A5FA", transform: "rotateY(72deg) translateZ(210px)" },
    { label: "Слив", value: "−112к ₽", tone: "#F87171", transform: "rotateY(144deg) translateZ(210px)" },
    { label: "ROMI", value: "336%", tone: "#FBBF24", transform: "rotateY(216deg) translateZ(210px)" },
    { label: "Алерты", value: "24/7", tone: "#A78BFA", transform: "rotateY(288deg) translateZ(210px)" },
  ];

  return (
    <div className="hero-3d-stage" aria-hidden="true">
      <div className="hero-3d-perspective">
        <div className="hero-3d-orbit">
          {orbitItems.map((item) => (
            <div key={item.label} className="hero-3d-card" style={{ transform: item.transform, ["--accent" as string]: item.tone }}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
        <div className="hero-3d-core">
          <div className="hero-3d-core-top">AI</div>
          <div className="hero-3d-core-mid">
            <span />
            <span />
            <span />
          </div>
          <div className="hero-3d-core-bottom">Директ</div>
        </div>
        <div className="hero-3d-dashboard">
          <div className="hero-3d-dashboard-head">
            <span>Audit live</span>
            <strong>87%</strong>
          </div>
          <div className="hero-3d-bars">
            <i style={{ height: "42%" }} />
            <i style={{ height: "72%" }} />
            <i style={{ height: "54%" }} />
            <i style={{ height: "88%" }} />
            <i style={{ height: "66%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── CONVERSION PATH ─────────────────────────────────── */

function ConversionPath() {
  return (
    <section id="conversion-tools" style={{ padding: "88px 40px 50px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4ADE80", marginBottom: 16 }}>
          Быстрый старт
        </div>
        <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: "clamp(30px, 4vw, 52px)", fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.03em", marginBottom: 18 }}>
          Выберите самый удобный<br />первый шаг
        </h2>
        <p style={{ color: "#94A3B8", fontSize: 17, lineHeight: 1.65, maxWidth: 680, marginBottom: 30 }}>
          На главной не заставляем пользователя заполнять длинные формы. Даём четыре понятных сценария: оценить потери, посчитать окупаемость, забрать бесплатный аудит или купить разовый полный разбор.
        </p>
        <div className="conversion-strip" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            ["Быстрая диагностика рекламы", "3 вопроса → оценка потерь → персональный следующий шаг.", "/quiz", "Пройти диагностику"],
            ["Калькулятор окупаемости", "Показывает выгоду и срок окупаемости на цифрах пользователя.", "/roi-calculator", "Посчитать"],
            ["Бесплатный AI-аудит", "Лид-магнит для тех, кто хочет увидеть конкретные утечки.", "/lead-magnet", "Получить аудит"],
            ["Аудит за 490 ₽", "Tripwire для тёплого пользователя, который уже готов платить за результат.", "/tripwire", "Открыть оффер"],
          ].map(([title, body, href, cta]) => (
            <Link key={title} href={href} style={{ background: "#111418", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 22, textDecoration: "none" }}>
              <div style={{ color: "#F0F4F8", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{title}</div>
              <div style={{ color: "#94A3B8", fontSize: 13, lineHeight: 1.55, marginBottom: 16 }}>{body}</div>
              <div style={{ color: "#4ADE80", fontSize: 13, fontWeight: 800 }}>{cta} →</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── SECTION WRAPPER ─────────────────────────────────── */

function SectionInner({ id, badge, title, sub, children, narrow }: {
  id?: string; badge?: string; title: string; sub?: string; children: React.ReactNode; narrow?: boolean;
}) {
  return (
    <div id={id} style={{ padding: "100px 40px", maxWidth: narrow ? 800 : 1200, margin: "0 auto" }}>
      {badge && <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4ADE80", marginBottom: 16 }}>{badge}</div>}
      <div style={{ fontFamily: "'Unbounded', sans-serif", fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: 16 }} dangerouslySetInnerHTML={{ __html: title }} />
      {sub && <div style={{ fontSize: 16, color: "#94A3B8", maxWidth: 520, lineHeight: 1.65, marginBottom: 56 }}>{sub}</div>}
      {children}
    </div>
  );
}

/* ── PAIN ─────────────────────────────────────────────── */

function Pain() {
  return (
    <SectionInner badge="Проблема" title="Вы теряете бюджет,<br>не зная об этом" sub="Каждый рекламный аккаунт содержит десятки скрытых проблем, которые молча поглощают деньги.">
      <div className="landing-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {PAIN_ITEMS.map((p) => (
          <div key={p.title} style={{
            background: "#111418", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16, padding: 28,
          }}>
            <div style={{ fontSize: 28, marginBottom: 16 }}>{p.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#F0F4F8", marginBottom: 8 }}>{p.title}</div>
            <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>{p.body}</div>
            <span style={{
              display: "inline-block", marginTop: 14,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
              color: "#F87171", fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 9999,
            }}>{p.tag}</span>
          </div>
        ))}
      </div>
    </SectionInner>
  );
}

/* ── SOLUTION ─────────────────────────────────────────── */

function Solution() {
  return (
    <SectionInner id="solution" badge="Решение" title="Один AI вместо<br>ручного контроля" sub="ДОЖИМ-АЙ закрывает каждую из этих проблем — автоматически, без участия человека.">
      {/* Before / After */}
      <div className="landing-before-after" style={{
        display: "grid", gridTemplateColumns: "1fr 60px 1fr",
        background: "#111418", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 24, overflow: "hidden",
      }}>
        {/* Before */}
        <div style={{ padding: "36px 40px", background: "rgba(239,68,68,0.03)", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ marginBottom: 28 }}>
            <span style={{
              display: "inline-block", background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.25)", color: "#F87171",
              fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 9999,
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>Без ДОЖИМ-АЙ</span>
          </div>
          {BEFORE_ROWS.map((r) => (
            <div key={r} style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              fontSize: 14, color: "#94A3B8", lineHeight: 1.5,
              padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}>
              <span style={{ color: "#F87171", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✕</span> {r}
            </div>
          ))}
        </div>
        {/* VS divider */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          borderLeft: "1px solid rgba(255,255,255,0.07)", borderRight: "1px solid rgba(255,255,255,0.07)",
          background: "#161B22",
        }}>
          <span style={{
            fontFamily: "'Unbounded', sans-serif", fontSize: 13, fontWeight: 900,
            color: "#475569", letterSpacing: "0.05em",
            writingMode: "vertical-rl",
          }}>VS</span>
        </div>
        {/* After */}
        <div style={{ padding: "36px 40px", background: "rgba(33,156,70,0.04)" }}>
          <div style={{ marginBottom: 28 }}>
            <span style={{
              display: "inline-block", background: "rgba(33,156,70,0.12)",
              border: "1px solid rgba(33,156,70,0.3)", color: "#4ADE80",
              fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 9999,
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>С ДОЖИМ-АЙ</span>
          </div>
          {AFTER_ROWS.map((r) => (
            <div key={r} style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              fontSize: 14, color: "#94A3B8", lineHeight: 1.5,
              padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}>
              <span style={{ color: "#4ADE80", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span> {r}
            </div>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="landing-stats-bar" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#111418", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20, padding: "36px 48px", marginTop: 20,
      }}>
        {SOL_STATS.map((s, i) => (
          <div key={s.val} style={{ display: "contents" }}>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{
                fontFamily: "'Unbounded', sans-serif", fontSize: 36, fontWeight: 900,
                color: "#4ADE80", lineHeight: 1, marginBottom: 8,
              }}>{s.val}</div>
              <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, whiteSpace: "pre-line" }}>{s.label}</div>
            </div>
            {i < SOL_STATS.length - 1 && <div style={{ width: 1, height: 64, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />}
          </div>
        ))}
      </div>
    </SectionInner>
  );
}

function Product3DSystem() {
  return (
    <section style={{ padding: "40px 40px 100px" }}>
      <div className="product-3d-section" style={{
        maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "0.9fr 1.1fr",
        gap: 40, alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.07)",
        paddingTop: 80,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4ADE80", marginBottom: 16 }}>
            AI-контур продукта
          </div>
          <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: "clamp(28px, 3.6vw, 46px)", fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.03em", marginBottom: 18 }}>
            3D-карта того,<br />как AI держит рекламу
          </h2>
          <p style={{ color: "#94A3B8", fontSize: 16, lineHeight: 1.7, maxWidth: 500, marginBottom: 26 }}>
            Кампании, ключи, ставки и бюджет сходятся в один центр контроля. AI подсвечивает утечки, оценивает эффект в рублях и предлагает действие до того, как проблема съест бюджет.
          </p>
          <div style={{ display: "grid", gap: 12 }}>
            {[
              ["Поток данных", "Яндекс Директ, Метрика, расходы и конверсии собираются в единый слой."],
              ["AI-сканер", "Каждые 6 часов проверяет отклонения, мусорный трафик и падение KPI."],
              ["Контроль действий", "Советник, Ассистент или Автопилот применяют решения с нужным уровнем допуска."],
            ].map(([title, body]) => (
              <div key={title} style={{ display: "grid", gridTemplateColumns: "10px 1fr", gap: 12, alignItems: "start" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "#4ADE80", marginTop: 7, boxShadow: "0 0 16px rgba(74,222,128,0.45)" }} />
                <div>
                  <div style={{ color: "#F0F4F8", fontSize: 14, fontWeight: 800, marginBottom: 4 }}>{title}</div>
                  <div style={{ color: "#94A3B8", fontSize: 13, lineHeight: 1.55 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="product-3d-stage" aria-hidden="true">
          <div className="product-3d-stack product-3d-stack-a">
            <span>Кампании</span>
            <strong>18</strong>
          </div>
          <div className="product-3d-stack product-3d-stack-b">
            <span>Ключи</span>
            <strong>4 812</strong>
          </div>
          <div className="product-3d-stack product-3d-stack-c">
            <span>Ставки</span>
            <strong>online</strong>
          </div>
          <div className="product-3d-ai-core">
            <div className="product-3d-ring product-3d-ring-one" />
            <div className="product-3d-ring product-3d-ring-two" />
            <div className="product-3d-chip">AI</div>
          </div>
          <div className="product-3d-alert">
            <span>утечка бюджета</span>
            <strong>−34 200 ₽</strong>
          </div>
          <div className="product-3d-action">
            <span>действие</span>
            <strong>минус-слова + ставки</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── HOW IT WORKS ─────────────────────────────────────── */

function HowItWorks() {
  return (
    <SectionInner id="how" badge="Процесс" title="Как это работает" sub="4 простых шага от подключения до первых результатов.">
      <div className="landing-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, position: "relative" }}>
        <div style={{
          content: "", position: "absolute", top: 40, left: "10%", right: "10%", height: 1,
          background: "linear-gradient(90deg, transparent, #219C46, #219C46, transparent)",
          opacity: 0.3,
        }} />
        {HOW_STEPS.map((s) => (
          <div key={s.n} style={{
            background: "#111418", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16, padding: "28px 24px", textAlign: "center",
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%", background: "#161B22",
              border: "2px solid #219C46", color: "#4ADE80",
              fontFamily: "'Unbounded', sans-serif", fontSize: 18, fontWeight: 900,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 18px", position: "relative", zIndex: 1,
            }}>{s.n}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#F0F4F8", marginBottom: 8 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.6 }}>{s.body}</div>
          </div>
        ))}
      </div>
    </SectionInner>
  );
}

/* ── FEATURES ─────────────────────────────────────────── */

function FeaturesSection() {
  return (
    <SectionInner id="features" badge="Возможности" title="Что умеет ДОЖИМ-АЙ" sub="Не просто аналитика — полный цикл: найти → объяснить → применить.">
      <div className="landing-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
        {FEATURES.map((f) => (
          <div key={f.title} style={{
            background: "#111418", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 20, padding: "32px 28px",
          }}>
            <div style={{ fontSize: 28, marginBottom: 16 }}>{f.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#F0F4F8", marginBottom: 10 }}>{f.title}</div>
            <div style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.65, marginBottom: 16 }}>{f.body}</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {f.items.map((item) => (
                <li key={item} style={{
                  fontSize: 13, color: "#94A3B8", padding: "5px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span style={{ color: "#4ADE80", fontWeight: 700 }}>✓</span> {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Metrics demo */}
      <div className="landing-metrics-row" style={{
        display: "flex", gap: 16, marginTop: 20,
        background: "#111418", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20, padding: "28px 32px",
      }}>
        {[
          { val: "245 770 ₽", sub: "Потрачено", color: "#94A3B8", delta: "↑ 12%", neg: true },
          { val: "824 650 ₽", sub: "Выручка", color: "#4ADE80", delta: "↑ 18%", neg: false },
          { val: "487 ₽", sub: "CPA", color: "#F0F4F8", delta: "↓ 35%", neg: false },
          { val: "1 692", sub: "Конверсии", color: "#F0F4F8", delta: "↑ 21%", neg: false },
          { val: "336%", sub: "ROMI", color: "#4ADE80", delta: "↑ 16%", neg: false },
        ].map((m) => (
          <div key={m.sub} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: m.color, marginBottom: 4 }}>{m.val}</div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>{m.sub}</div>
            <div style={{
              display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 9999,
              background: m.neg ? "rgba(239,68,68,0.1)" : "rgba(33,156,70,0.1)",
              color: m.neg ? "#F87171" : "#4ADE80",
            }}>{m.delta}</div>
          </div>
        ))}
      </div>
    </SectionInner>
  );
}

/* ── MODES ─────────────────────────────────────────────── */

function ModesSection() {
  return (
    <SectionInner id="control" badge="Гибкость управления" title="Выберите свой<br>уровень контроля" sub="AI подстраивается под ваш стиль управления — от полного контроля до полного автопилота.">
      <div className="landing-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {MODES.map((m) => (
          <div key={m.badge} style={{
            background: "#111418",
            border: m.highlighted ? "1px solid #219C46" : "1px solid rgba(255,255,255,0.07)",
            boxShadow: m.highlighted ? "0 0 40px rgba(33,156,70,0.1)" : undefined,
            borderRadius: 20, padding: "32px 28px",
            display: "flex", flexDirection: "column", gap: 16,
            position: "relative", overflow: "hidden",
          }}>
            {m.highlighted && (
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 2,
                background: "linear-gradient(90deg, transparent, #219C46, transparent)",
              }} />
            )}
            <div style={{ fontSize: 24 }}>{m.icon}</div>
            <div style={{
              display: "inline-block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", padding: "4px 12px", borderRadius: 9999,
              background: m.badgeColor, color: m.badgeText, width: "fit-content",
            }}>{m.badge}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#F0F4F8" }}>{m.title}</div>
            <div style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.65 }}>{m.body}</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {m.items.map((item) => (
                <li key={item} style={{
                  fontSize: 13, color: "#94A3B8", padding: "5px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span style={{ color: "#4ADE80", fontWeight: 700 }}>✓</span> {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SectionInner>
  );
}

/* ── PRICING ─────────────────────────────────────────── */

function Pricing() {
  return (
    <SectionInner id="pricing" badge="Тарифы" title="Единая валюта — токены" sub="Токены списываются за аудит, AI-рекомендации, генерацию изображений и применение действий. На 80% расхода покажем предупреждение, на 100% предложим докупить или получить токены по реферальной программе.">
      <div className="landing-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {PLANS.map((p) => (
          <div key={p.id} style={{
            background: "#111418",
            border: p.highlight ? "1px solid #219C46" : "1px solid rgba(255,255,255,0.07)",
            boxShadow: p.highlight ? "0 0 40px rgba(33,156,70,0.1)" : undefined,
            borderRadius: 20, padding: "32px 28px",
            display: "flex", flexDirection: "column",
            position: "relative",
          }}>
            {p.highlight && (
              <>
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 2,
                  background: "linear-gradient(90deg, transparent, #219C46, transparent)",
                }} />
                <div style={{
                  position: "absolute", top: 16, right: 16,
                  background: "#219C46", color: "#fff", fontSize: 10, fontWeight: 700,
                  padding: "4px 10px", borderRadius: 9999, textTransform: "uppercase", letterSpacing: "0.06em",
                }}>Популярный</div>
              </>
            )}
            <div style={{
              fontFamily: "'Unbounded', sans-serif", fontSize: 14, fontWeight: 900,
              color: p.highlight ? "#4ADE80" : "#94A3B8",
              letterSpacing: "0.05em", marginBottom: 16,
            }}>{p.name}</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#F0F4F8", marginBottom: 4 }}>{p.price}</div>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 24 }}>{p.period}</div>
            <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 24 }} />
            <ul style={{ listStyle: "none", padding: 0, margin: 0, flex: 1 }}>
              {p.items.map((item) => (
                <li key={item} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  fontSize: 14, color: "#94A3B8", padding: "6px 0",
                }}>
                  <CheckCircle2 size={14} color={p.checkColor} style={{ flexShrink: 0 }} />
                  {item}
                </li>
              ))}
            </ul>
            <Link href={p.href} style={{
              display: "block", marginTop: 28, textAlign: "center",
              padding: "13px 0", borderRadius: 12, fontSize: 14, fontWeight: 600,
              textDecoration: "none",
              background: p.highlight ? "#219C46" : "transparent",
              border: p.highlight ? "none" : "1px solid rgba(255,255,255,0.15)",
              color: p.highlight ? "#fff" : "#94A3B8",
            }}>{p.cta}</Link>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: "#475569" }}>
        <ShieldCheck size={14} style={{ display: "inline", marginRight: 6, color: "#4ADE80", verticalAlign: "middle" }} />
        Пакеты докупки: 1 000 токенов за 1 290 ₽, 5 000 за 4 990 ₽ или 15 000 за 12 900 ₽. Лимит действует до конца расчётного периода.
      </p>
    </SectionInner>
  );
}

/* ── TESTIMONIALS ─────────────────────────────────────── */

function TestimonialsSection() {
  return (
    <SectionInner badge="Отзывы" title="Результаты говорят<br>сами за себя" sub="Реальные клиенты, реальные цифры.">
      <div className="landing-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {TESTIMONIALS.map((t) => (
          <div key={t.name} style={{
            background: "#111418", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 20, padding: "28px",
          }}>
            <div style={{ color: "#FBBF24", fontSize: 16, marginBottom: 16 }}>{t.stars}</div>
            <div style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.7, marginBottom: 24 }}>{t.text}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: `linear-gradient(135deg, ${t.gradFrom}, ${t.gradTo})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0,
              }}>{t.initials}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#F0F4F8" }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "#475569" }}>{t.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionInner>
  );
}

/* ── FAQ ──────────────────────────────────────────────── */

function FaqSection() {
  return (
    <SectionInner id="faq" badge="FAQ" title="Частые вопросы" narrow>
      <div>
        {FAQ.map((item) => (
          <details key={item.q} style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <summary style={{
              width: "100%", background: "none", border: "none", textAlign: "left",
              padding: "20px 0", fontSize: 15, fontWeight: 600, color: "#F0F4F8",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
              listStyle: "none",
            }}>
              {item.q}
              <span style={{ fontSize: 18, color: "#475569", flexShrink: 0 }}>▼</span>
            </summary>
            <p style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.7, paddingBottom: 20 }}>{item.a}</p>
          </details>
        ))}
      </div>
    </SectionInner>
  );
}

/* ── CTA ──────────────────────────────────────────────── */

function CtaSection() {
  return (
    <div style={{
      textAlign: "center", padding: "120px 40px",
      background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(33,156,70,0.08) 0%, transparent 70%)",
      borderTop: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.07)",
    }}>
      <div style={{
        fontFamily: "'Unbounded', sans-serif",
        fontSize: "clamp(28px, 4vw, 52px)", fontWeight: 900,
        letterSpacing: "-0.03em", maxWidth: 700, margin: "0 auto 20px", lineHeight: 1.1,
      }}>
        Перестаньте терять деньги.<br />Запустите ДОЖИМ-АЙ сегодня.
      </div>
      <p style={{ fontSize: 16, color: "#94A3B8", maxWidth: 480, margin: "0 auto 40px", lineHeight: 1.65 }}>
        Первые 7 дней бесплатно. Без карты. Отключите в любой момент.
      </p>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/register" style={{
          background: "#219C46", color: "#fff", padding: "16px 40px",
          borderRadius: 14, fontSize: 16, fontWeight: 700, textDecoration: "none",
          boxShadow: "0 4px 30px rgba(33,156,70,0.35)",
        }}>Начать бесплатно</Link>
        <Link href="/login" style={{
          background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
          color: "#94A3B8", padding: "16px 40px", borderRadius: 14,
          fontSize: 16, fontWeight: 600, textDecoration: "none",
        }}>Войти</Link>
      </div>
    </div>
  );
}

/* ── FOOTER ───────────────────────────────────────────── */

function FooterSection() {
  return (
    <footer className="landing-footer" style={{
      padding: "48px 40px", display: "flex", alignItems: "center", justifyContent: "space-between",
      borderTop: "1px solid rgba(255,255,255,0.07)", maxWidth: 1200, margin: "0 auto",
      fontSize: 13, color: "#475569",
    }}>
      <BrandLogo width={150} />
      <div>© 2026. Все права защищены.</div>
      <nav className="landing-footer-links" style={{ display: "flex", gap: 24 }}>
        <a href="#pricing" style={{ color: "#475569", textDecoration: "none" }}>Тарифы</a>
        <a href="#faq" style={{ color: "#475569", textDecoration: "none" }}>FAQ</a>
        <Link href="/privacy" style={{ color: "#475569", textDecoration: "none" }}>Конфиденциальность</Link>
        <Link href="/personal-data" style={{ color: "#475569", textDecoration: "none" }}>Персональные данные</Link>
        <Link href="/cookies" style={{ color: "#475569", textDecoration: "none" }}>Cookies</Link>
        <Link href="/terms" style={{ color: "#475569", textDecoration: "none" }}>Документы</Link>
        <a href="mailto:hello@dozim.ai" style={{ color: "#475569", textDecoration: "none" }}>hello@dozim.ai</a>
      </nav>
    </footer>
  );
}
