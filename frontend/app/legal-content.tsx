import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

type Section = {
  title: string;
  body: string[];
};

export function LegalPage({
  title,
  lead,
  sections,
}: {
  title: string;
  lead: string;
  sections: Section[];
}) {
  return (
    <main className="min-h-screen bg-[#0A0D10] px-5 py-10 text-[#F0F4F8]">
      <div className="mx-auto max-w-4xl">
        <BrandLogo width={220} priority />

        <article className="mt-10 rounded-[28px] border border-white/10 bg-[#111418] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-400">
            Правовые документы
          </p>
          <h1 className="mt-4 font-display text-3xl font-black leading-tight text-white md:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400">
            {lead}
          </p>

          <div className="mt-10 space-y-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-lg font-bold text-white">{section.title}</h2>
                <div className="mt-3 space-y-3 text-sm leading-7 text-slate-400">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>

        <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-500">
          <Link href="/privacy" className="hover:text-slate-300">Политика конфиденциальности</Link>
          <Link href="/personal-data" className="hover:text-slate-300">Согласие на обработку данных</Link>
          <Link href="/cookies" className="hover:text-slate-300">Cookies</Link>
          <Link href="/terms" className="hover:text-slate-300">Пользовательское соглашение</Link>
          <Link href="/" className="hover:text-slate-300">На главную</Link>
        </nav>
      </div>
    </main>
  );
}
