"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";

const STORAGE_KEY = "dozim_cookie_consent_v2";

export function CookieConsent() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;
    setVisible(window.localStorage.getItem(STORAGE_KEY) !== "accepted");
  }, [pathname]);

  if (!visible || pathname?.startsWith("/admin")) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[200] px-4 pb-4 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 rounded-2xl border border-white/10 bg-[#151927]/95 p-4 text-sm text-slate-300 shadow-[0_20px_70px_rgba(0,0,0,0.45)] backdrop-blur md:flex-row md:items-center md:justify-between">
        <p className="max-w-3xl leading-6">
          Мы используем cookie для работы сайта, авторизации и аналитики. Продолжая пользоваться сайтом, вы соглашаетесь с{" "}
          <Link href="/cookies" className="text-brand-400 hover:text-brand-300">
            политикой cookie
          </Link>{" "}
          и{" "}
          <Link href="/privacy" className="text-brand-400 hover:text-brand-300">
            политикой конфиденциальности
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(STORAGE_KEY, "accepted");
            setVisible(false);
          }}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#22A64B] px-5 font-semibold text-white transition hover:bg-[#27B350]"
        >
          <Check className="h-4 w-4" />
          Принять
        </button>
      </div>
    </div>
  );
}
