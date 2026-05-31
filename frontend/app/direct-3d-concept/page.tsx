import Link from "next/link";
import { ArrowUpRight, CheckCircle2, CircleDollarSign, Gauge, Radar, ShieldCheck, SlidersHorizontal, Sparkles, TrendingDown, Zap } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import styles from "./page.module.css";

const queryRows = [
  ["купить права без обучения", "минус-фраза", "−18 400 ₽", "bad"],
  ["автошкола новокузнецк цена", "оставить", "+23%", "good"],
  ["работа инструктором", "минус-фраза", "−7 200 ₽", "bad"],
  ["обучение категория b", "усилить", "CPA −16%", "good"],
  ["скачать билеты бесплатно", "минус-фраза", "−11 900 ₽", "bad"],
];

const cockpitMetrics = [
  ["Показы", "248 901", "+18%"],
  ["Клики", "9 428", "+11%"],
  ["CPA", "1 190 ₽", "−35%"],
  ["Расход", "245 770 ₽", "−22%"],
];

const directTabs = ["Кампании", "Группы", "Объявления", "Ставки и фразы", "Сегменты"];

const actions = [
  { icon: Radar, title: "AI-сканер поисковых фраз", body: "Подсвечивает мусорный трафик и сразу показывает, сколько он съедает в рублях." },
  { icon: SlidersHorizontal, title: "Корректировки ставок", body: "Находит перегретые группы, снижает ставки и переносит бюджет туда, где CPA ниже." },
  { icon: ShieldCheck, title: "Контур безопасности", body: "В режимах Советник и Ассистент крупные изменения не применяются без подтверждения." },
];

export default function Direct3DConceptPage() {
  return (
    <main className={styles.page}>
      <header className={styles.nav}>
        <BrandLogo width={170} priority />
        <nav className={styles.navLinks}>
          <a href="#direct">Директ-сцена</a>
          <a href="#scanner">AI-сканер</a>
          <a href="#control">Контроль</a>
        </nav>
        <Link href="/register" className={styles.navCta}>Запустить аудит</Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroBacklight} />
        <div className={styles.heroCopy}>
          <div className={styles.kicker}>
            <span />
            AI-контроль Яндекс Директа 24/7
          </div>
          <h1>
            Директ под контролем:
            <br />
            AI видит утечки раньше бюджета
          </h1>
          <p>
            Концепт лендинга с 3D-кабинетом: кампании, группы, объявления, ставки,
            фразы, UTM и предпросмотр рекламы собраны в один живой слой.
          </p>
          <div className={styles.heroActions}>
            <Link href="/quiz">Найти утечки</Link>
            <a href="#direct">Смотреть 3D-концепт</a>
          </div>
          <div className={styles.proofGrid}>
            {cockpitMetrics.map(([label, value, delta]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
                <em>{delta}</em>
              </div>
            ))}
          </div>
        </div>

        <DirectCockpit3D />
      </section>

      <section id="direct" className={styles.directSection}>
        <div className={styles.sectionHead}>
          <span>Атрибуты Директа</span>
          <h2>Не абстрактный AI, а рекламный кабинет в объёме</h2>
          <p>
            Берём узнаваемую механику Яндекс.Директа: таблицы кампаний, фразы,
            ставки, предпросмотр объявления, UTM и превращаем это в hero-сцену.
          </p>
        </div>
        <div className={styles.directBoard}>
          <div className={styles.browserChrome}>
            <span />
            <span />
            <span />
            <strong>dozhim-ai.direct/control</strong>
          </div>
          <div className={styles.directTabs}>
            {directTabs.map((tab, index) => <span key={tab} className={index === 0 ? styles.activeTab : ""}>{tab}</span>)}
          </div>
          <div className={styles.directGrid}>
            <div className={styles.tablePanel}>
              <div className={styles.tableTools}>
                <button>Добавить кампанию</button>
                <span>Поиск</span>
                <span>Последние 30 дней</span>
                <span>Все кампании</span>
              </div>
              <div className={styles.tableHead}>
                <span>Название</span>
                <span>Статус</span>
                <span>Места</span>
                <span>CPA</span>
                <span>Расход</span>
              </div>
              {[
                ["РСЯ · Автошкола", "Архив", "РСЯ", "1 190 ₽", "245 770 ₽"],
                ["Поиск · Категория B", "Активна", "Поиск", "980 ₽", "138 400 ₽"],
                ["Мастер кампаний", "Пауза", "Сеть", "1 840 ₽", "61 300 ₽"],
              ].map((row) => (
                <div key={row[0]} className={styles.tableRow}>
                  {row.map((cell) => <span key={cell}>{cell}</span>)}
                </div>
              ))}
            </div>
            <div className={styles.previewPanel}>
              <div className={styles.previewTop}>Предпросмотр</div>
              <div className={styles.adPreview}>
                <div className={styles.adImage}>РЕКЛАМА</div>
                <span>avtoshkola-nk.ru</span>
                <h3>Автошкола Новокузнецкая!</h3>
                <p>Получи −3000 ₽ на категорию “B”</p>
                <button>Узнать больше</button>
              </div>
            </div>
          </div>
          <div className={styles.scanBeam} />
        </div>
      </section>

      <section id="scanner" className={styles.scannerSection}>
        <div className={styles.scannerCopy}>
          <span>AI-сканер фраз</span>
          <h2>Поток запросов превращается в действия</h2>
          <p>
            Вместо обычной “аналитики” показываем конкретную механику продукта:
            AI читает поисковые фразы, ловит нецелевые запросы и предлагает минус-фразы,
            ставки и перераспределение бюджета.
          </p>
        </div>
        <div className={styles.queryTunnel}>
          {queryRows.map(([query, action, money, type], index) => (
            <div key={query} className={`${styles.queryChip} ${type === "bad" ? styles.badChip : styles.goodChip}`} style={{ ["--i" as string]: index }}>
              <span>{query}</span>
              <strong>{action}</strong>
              <em>{money}</em>
            </div>
          ))}
          <div className={styles.aiGate}>
            <Sparkles size={26} />
            <strong>AI</strong>
            <span>фильтр</span>
          </div>
        </div>
      </section>

      <section id="control" className={styles.actionSection}>
        <div className={styles.sectionHead}>
          <span>Что усиливаем в следующем проходе</span>
          <h2>3D-анимация должна объяснять продукт</h2>
        </div>
        <div className={styles.actionGrid}>
          {actions.map((item) => (
            <article key={item.title}>
              <item.icon size={24} />
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function DirectCockpit3D() {
  return (
    <div className={styles.cockpit} aria-hidden="true">
      <div className={styles.cockpitScene}>
        <div className={styles.sideRail}>
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className={styles.campaignPlane}>
          <div className={styles.planeTabs}>
            <span>Кампании</span>
            <span>Ставки и фразы</span>
            <span>Профили</span>
          </div>
          <div className={styles.planeToolbar}>
            <b>+ кампания</b>
            <span>Последние 30 дней</span>
            <span>Все типы</span>
          </div>
          <div className={styles.planeTable}>
            {[
              ["РСЯ · Автошкола", "CPA 1 190 ₽", "−35%"],
              ["Поиск · Новокузнецк", "CPC 42 ₽", "+18%"],
              ["Фразы · категория B", "128 минус", "−112к"],
            ].map(([name, metric, delta]) => (
              <div key={name}>
                <span>{name}</span>
                <strong>{metric}</strong>
                <em>{delta}</em>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.budgetLeak}>
          <TrendingDown size={18} />
          <span>утечка</span>
          <strong>−34 200 ₽</strong>
        </div>
        <div className={styles.aiCore}>
          <div className={styles.aiRingOne} />
          <div className={styles.aiRingTwo} />
          <div className={styles.aiChip}>AI</div>
        </div>
        <div className={styles.adCard3d}>
          <span>предпросмотр</span>
          <strong>Вертикальные</strong>
          <p>Автошкола Новокузнецкая! −3000 ₽</p>
        </div>
        <div className={styles.actionCard3d}>
          <Zap size={18} />
          <span>действие</span>
          <strong>минус-фразы + ставки</strong>
        </div>
        <div className={styles.metricDisk}>
          <Gauge size={22} />
          <strong>87%</strong>
          <span>точность</span>
        </div>
        <div className={styles.moneyDisk}>
          <CircleDollarSign size={22} />
          <strong>112к ₽</strong>
          <span>возврат</span>
        </div>
        <div className={styles.directGlow} />
      </div>
    </div>
  );
}
