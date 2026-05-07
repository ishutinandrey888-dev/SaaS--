import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Eye,
  Flame,
  Gauge,
  LineChart,
  Megaphone,
  Plug,
  Rocket,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Users,
  Wallet,
} from "lucide-react";

const PAIN_ITEMS = [
  {
    icon: TrendingDown,
    title: "CPA растёт, ROMI падает",
    body: "По 2-3 раза в неделю кто-то проверяет рекламу. Между проверками сжигается бюджет.",
  },
  {
    icon: Flame,
    title: "Минус-слова не успевают",
    body: "До 30% показов идут на нерелевантные запросы. Никто не успевает чистить семантику.",
  },
  {
    icon: Eye,
    title: "Кампании работают вслепую",
    body: "Не успеваете проверять, какие ключи / объявления / группы реально окупаются.",
  },
  {
    icon: Wallet,
    title: "Бюджет уходит на тестах",
    body: "Запустили 10 гипотез, выживают 2. Остальные крутятся неделями и сливают деньги.",
  },
  {
    icon: Clock,
    title: "Ручная аналитика — это часы",
    body: "Каждую субботу — выгрузка, сводка, отчёт клиенту. Без этого работа стоит.",
  },
  {
    icon: Users,
    title: "Не масштабируешься без штата",
    body: "Один директолог тянет 5-7 проектов. Десятый клиент — снова найм или потеря качества.",
  },
];

const HOW_STEPS = [
  {
    icon: Plug,
    title: "Подключите Яндекс Директ",
    body: "OAuth — 30 секунд. Никаких выгрузок Excel и ручных перетаскиваний.",
  },
  {
    icon: Bot,
    title: "Опишите бриф и KPI",
    body: "URL, ниша, аудитория, целевая CPA / ROMI. AI знает, что для вас «хорошо».",
  },
  {
    icon: Gauge,
    title: "Выберите режим",
    body: "Советник / Co-pilot / Автопилот — слайдер автономности, который вы контролируете.",
  },
  {
    icon: Rocket,
    title: "Расти в фоне",
    body: "Агент работает 24/7. Вы получаете уведомления только когда есть что показать.",
  },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI-аудит каждые 6 часов",
    body: "Кампании, группы, ключи, объявления — проверяются по 30+ правилам Яндекс Директа.",
  },
  {
    icon: Bot,
    title: "AI-аналитик с памятью",
    body: "Помнит решения по проекту: что вы одобрили, что отклонили, что сработало.",
  },
  {
    icon: LineChart,
    title: "Сквозная аналитика",
    body: "От показа до выручки — без ручной выгрузки в таблицу.",
  },
  {
    icon: Megaphone,
    title: "Автогенерация объявлений",
    body: "Переписывает слабые объявления и предлагает A/B тесты с обоснованием.",
  },
];

const MODES = [
  {
    badge: "Советник",
    title: "Только сообщает",
    body: "AI находит проблемы и точки роста, рассказывает, что улучшить. Действия — за вами.",
    color: "border-ink-300/60 bg-ink-100",
  },
  {
    badge: "Co-pilot",
    title: "Предлагает действия",
    body: "AI готовит конкретные изменения. Применить — одним кликом. Не доверяете — пропустите.",
    color: "border-brand-700/40 bg-brand-700/10",
  },
  {
    badge: "Автопилот",
    title: "Применяет сам",
    body: "Высокоуверенные правки — минусация, ставки, паузы — применяются без вашего участия.",
    color: "border-ink-300/60 bg-ink-100",
  },
];

const PLANS = [
  {
    id: "free",
    label: "FREE",
    price: "0 ₽",
    period: "7 дней trial",
    bullets: [
      "1 проект, 1 AI-агент",
      "1 аккаунт Яндекс Директ",
      "Только режим Советник",
      "AI-улучшений: 3",
    ],
    cta: "Начать бесплатно",
    href: "/register",
    highlight: false,
  },
  {
    id: "pro",
    label: "PRO",
    price: "3 990 ₽",
    period: "в месяц",
    bullets: [
      "До 3 агентов",
      "До 3 аккаунтов Яндекс Директ",
      "Все 3 режима, включая автопилот",
      "AI-улучшений: 50/мес",
      "История 30 дней",
    ],
    cta: "Выбрать PRO",
    href: "/register?plan=pro",
    highlight: true,
  },
  {
    id: "agency",
    label: "AGENCY",
    price: "13 900 ₽",
    period: "в месяц",
    bullets: [
      "Безлимит агентов и проектов",
      "Безлимит аккаунтов Direct",
      "Все режимы + приоритетная поддержка",
      "AI-улучшений: безлимит",
      "История без срока",
    ],
    cta: "Выбрать AGENCY",
    href: "/register?plan=agency",
    highlight: false,
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Перевёл 4 проекта на Дожим-Ай. Каждое утро вижу ленту находок и применяю в один клик. Освободилось 8 часов в неделю.",
    author: "Артём Г.",
    role: "Директолог-фрилансер",
  },
  {
    quote:
      "В автопилоте срезали 27% мусорных показов за две недели. CPA упал с 1 800 ₽ до 1 250 ₽.",
    author: "Анна К.",
    role: "Performance-маркетолог",
  },
  {
    quote:
      "Раньше 6 проектов — потолок. Сейчас веду 14 без потери качества. AI закрывает рутину, я делаю стратегию.",
    author: "Илья В.",
    role: "Owner агентства",
  },
];

const FAQ = [
  {
    q: "Почему я должен доверить AI правки в моей рекламе?",
    a: "На старте все режимы — кроме Автопилота — требуют ваше подтверждение. Вы видите каждое решение AI и можете отклонить. Уровень автономности — ваш слайдер.",
  },
  {
    q: "Это безопасно для моих данных?",
    a: "Токены доступа к Яндекс Директ хранятся в зашифрованном виде (Fernet). Никакой человек со стороны Дожим-Ай в ваш кабинет руками не лезет.",
  },
  {
    q: "Поддерживаете VK Рекламу / Google Ads?",
    a: "В первой итерации — только Яндекс Директ. VK Реклама — следующая. Google Ads — по запросу.",
  },
  {
    q: "Что будет, когда trial закончится?",
    a: "Агенты автоматически встанут на паузу. Данные не пропадают. Когда оплатите — продолжат с того же места.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <Header />
      <Hero />
      <Pain />
      <Solution />
      <HowItWorks />
      <Features />
      <ModesSection />
      <Pricing />
      <Testimonials />
      <FaqSection />
      <FinalCTA />
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-300/40 bg-ink-0/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-700 text-white">
            <Activity className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            ДОЖИМ-АЙ
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-ink-700 md:flex">
          <a href="#features" className="hover:text-ink-900">
            Возможности
          </a>
          <a href="#modes" className="hover:text-ink-900">
            Режимы
          </a>
          <a href="#pricing" className="hover:text-ink-900">
            Тарифы
          </a>
          <a href="#faq" className="hover:text-ink-900">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-ink-700 hover:text-ink-900"
          >
            Войти
          </Link>
          <Link href="/register" className="btn-primary text-sm">
            Начать бесплатно
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[600px] w-[1100px] -translate-x-1/2 rounded-full bg-brand-700/10 blur-3xl" />
      </div>
      <div className="mx-auto max-w-6xl px-6 py-24 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-700/15 px-3 py-1 text-xs font-medium text-brand-500 ring-1 ring-brand-700/30">
          <Sparkles className="h-3 w-3" />
          AI-агент для Яндекс Директа
        </span>
        <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Ваша реклама теряет
          <br />
          деньги <span className="text-brand-500">каждую минуту</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-ink-700 sm:text-lg">
          ДОЖИМ-АЙ — AI-агент, который следит за вашей контекстной рекламой
          24/7: аудитит, ищет точки роста и в автопилоте применяет
          изменения через API Яндекс Директа.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register" className="btn-primary">
            Начать бесплатно
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#features" className="btn-secondary">
            Что внутри
          </a>
        </div>
        <Stats />
      </div>
    </section>
  );
}

function Stats() {
  const items = [
    { v: "−27%", k: "мусорные показы за 2 недели" },
    { v: "+18%", k: "CTR после AI-правок" },
    { v: "8 ч", k: "освобождается в неделю" },
    { v: "24/7", k: "агент не спит" },
  ];
  return (
    <dl className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-6 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.k}>
          <dt className="text-3xl font-semibold text-ink-900">{i.v}</dt>
          <dd className="mt-1 text-xs text-ink-600">{i.k}</dd>
        </div>
      ))}
    </dl>
  );
}

function Pain() {
  return (
    <Section id="pain" title="Знакомо?" subtitle="Боли, с которыми сталкивается каждый, кто ведёт Яндекс Директ.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PAIN_ITEMS.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-2xl border border-ink-300/40 bg-ink-100 p-6"
          >
            <Icon className="h-6 w-6 text-rose-400" />
            <p className="mt-4 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-sm text-ink-600">{body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Solution() {
  return (
    <Section
      id="solution"
      title="Один AI вместо ручного контроля"
      subtitle="ДОЖИМ-АЙ закрывает рутину аудита и оптимизации, оставляя вам стратегию."
    >
      <div className="mx-auto max-w-3xl rounded-3xl border border-brand-700/30 bg-gradient-to-br from-brand-700/15 to-ink-100 p-8 text-center">
        <Bot className="mx-auto h-12 w-12 text-brand-500" />
        <p className="mt-6 text-lg font-medium leading-relaxed">
          Подключаете аккаунт. Описываете цели. Выбираете уровень автономности.
        </p>
        <p className="mt-3 text-sm text-ink-700">
          Дальше AI делает то, что обычно делает специалист по контекстной
          рекламе — только без выходных и в 100× быстрее.
        </p>
      </div>
    </Section>
  );
}

function HowItWorks() {
  return (
    <Section id="how" title="Как это работает" subtitle="4 шага от подключения до роста.">
      <ol className="grid gap-4 lg:grid-cols-4">
        {HOW_STEPS.map((s, i) => (
          <li
            key={s.title}
            className="rounded-2xl border border-ink-300/40 bg-ink-100 p-6"
          >
            <div className="flex items-center justify-between">
              <span className="text-3xl font-semibold text-brand-500">
                {String(i + 1).padStart(2, "0")}
              </span>
              <s.icon className="h-5 w-5 text-ink-600" />
            </div>
            <p className="mt-4 text-sm font-semibold">{s.title}</p>
            <p className="mt-1 text-sm text-ink-600">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Features() {
  return (
    <Section
      id="features"
      title="Что умеет ДОЖИМ-АЙ"
      subtitle="Не просто аналитика — связка «найти → объяснить → применить»."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-2xl border border-ink-300/40 bg-ink-100 p-6"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-700/15 text-brand-500">
              <Icon className="h-5 w-5" />
            </span>
            <p className="mt-4 text-base font-semibold">{title}</p>
            <p className="mt-1 text-sm text-ink-600">{body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ModesSection() {
  return (
    <Section
      id="modes"
      title="Уровни автономности — ваш контроль"
      subtitle="Меняйте режим в любой момент, без переподключения."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {MODES.map((m) => (
          <div
            key={m.badge}
            className={"rounded-2xl border p-6 " + m.color}
          >
            <span className="rounded-full bg-ink-200/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-700">
              {m.badge}
            </span>
            <p className="mt-4 text-lg font-semibold">{m.title}</p>
            <p className="mt-1 text-sm text-ink-600">{m.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Pricing() {
  return (
    <Section
      id="pricing"
      title="Тарифы"
      subtitle="Старт бесплатный, без карты. Не понравится — отключитесь в один клик."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((p) => (
          <article
            key={p.id}
            className={
              "flex flex-col rounded-3xl border p-7 " +
              (p.highlight
                ? "border-brand-700 bg-brand-700/10"
                : "border-ink-300/40 bg-ink-100")
            }
          >
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-ink-700">
                {p.label}
              </span>
              {p.highlight && (
                <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[11px] font-medium text-white">
                  ПОПУЛЯРНО
                </span>
              )}
            </div>
            <p className="mt-6 text-4xl font-semibold">{p.price}</p>
            <p className="mt-1 text-xs text-ink-600">{p.period}</p>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-ink-700">
              {p.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                  {b}
                </li>
              ))}
            </ul>
            <Link
              href={p.href}
              className={
                "mt-7 block rounded-xl px-5 py-3 text-center text-sm font-medium transition " +
                (p.highlight
                  ? "bg-brand-700 text-white hover:bg-brand-800"
                  : "bg-ink-200 text-ink-900 ring-1 ring-ink-300/60 hover:bg-ink-300")
              }
            >
              {p.cta}
            </Link>
          </article>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-ink-600">
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-brand-500" />
        Оплата через Robokassa. Возврат — по первому запросу в первые 7 дней.
      </p>
    </Section>
  );
}

function Testimonials() {
  return (
    <Section
      id="reviews"
      title="Кто уже использует"
      subtitle="Маркетологи и агентства, которые перестали жить в спредшитах."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.author}
            className="rounded-2xl border border-ink-300/40 bg-ink-100 p-6"
          >
            <blockquote className="text-sm leading-relaxed text-ink-800">
              «{t.quote}»
            </blockquote>
            <figcaption className="mt-4 text-xs text-ink-600">
              <span className="font-semibold text-ink-900">{t.author}</span> —{" "}
              {t.role}
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}

function FaqSection() {
  return (
    <Section id="faq" title="Вопросы и ответы">
      <dl className="mx-auto max-w-3xl space-y-4">
        {FAQ.map((q) => (
          <details
            key={q.q}
            className="group rounded-2xl border border-ink-300/40 bg-ink-100 p-5 open:bg-ink-200/60"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-medium">
              {q.q}
              <span className="grid h-6 w-6 place-items-center rounded-full bg-ink-200 text-ink-600 transition group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm text-ink-700">{q.a}</p>
          </details>
        ))}
      </dl>
    </Section>
  );
}

function FinalCTA() {
  return (
    <section className="px-6 pb-24 pt-16">
      <div className="mx-auto flex max-w-4xl flex-col items-center rounded-3xl border border-brand-700/40 bg-gradient-to-br from-brand-700/20 to-ink-100 px-8 py-14 text-center">
        <Bot className="h-12 w-12 text-brand-500" />
        <h2 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
          Перестаньте дожимать рекламу руками.
        </h2>
        <p className="mt-3 max-w-xl text-sm text-ink-700">
          Запустите AI-агента за 5 минут. Первые 7 дней — бесплатно, без карты.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register" className="btn-primary">
            Начать бесплатно
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="btn-secondary">
            Войти
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink-300/40 px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-xs text-ink-600 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-700 text-white">
            <Activity className="h-3 w-3" />
          </span>
          <span>© ДОЖИМ-АЙ, 2026. Все права защищены.</span>
        </div>
        <nav className="flex items-center gap-5">
          <a href="#pricing" className="hover:text-ink-900">
            Тарифы
          </a>
          <a href="#faq" className="hover:text-ink-900">
            FAQ
          </a>
          <a href="mailto:hello@dozim.ai" className="hover:text-ink-900">
            hello@dozim.ai
          </a>
        </nav>
      </div>
    </footer>
  );
}

function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <header className="mb-12 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mx-auto mt-3 max-w-2xl text-sm text-ink-700">
              {subtitle}
            </p>
          )}
        </header>
        {children}
      </div>
    </section>
  );
}
