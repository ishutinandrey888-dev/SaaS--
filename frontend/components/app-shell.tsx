import Link from "next/link";
import { BrandLogo } from "./brand-logo";

type NavItem = {
  href: string;
  label: string;
};

type AppShellProps = {
  active: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Кабинет" },
  { href: "/admin", label: "Админка" },
  { href: "/lead-magnet", label: "Радар" },
  { href: "/analytics", label: "Аналитика" },
  { href: "/settings", label: "Настройки" },
  { href: "/yandex", label: "Яндекс" }
];

export function AppShell({ active, title, subtitle, children }: AppShellProps) {
  return (
    <main className="saas-shell">
      <aside className="saas-sidebar">
        <Link className="saas-brand-link" href="/dashboard">
          <BrandLogo />
        </Link>
        <nav className="saas-nav" aria-label="Основная навигация">
          {navItems.map((item) => (
            <Link className={active === item.href ? "saas-nav-item active" : "saas-nav-item"} href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <section className="saas-main">
        <header className="saas-topbar">
          <div>
            <p className="eyebrow">ДОЖИМ-АЙ</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <Link className="primary-button" href="/radar">
            Запустить аудит
          </Link>
        </header>
        {children}
      </section>
    </main>
  );
}
