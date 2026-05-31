"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ApiError, register } from "@/lib/api";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

const PWD_RULES = [
  { re: /.{8,}/, label: "минимум 8 символов" },
  { re: /[A-Za-zА-Яа-яЁё]/, label: "хотя бы одна буква" },
  { re: /\d/, label: "хотя бы одна цифра" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const submitting = state.kind === "submitting";
  const pwdOk = PWD_RULES.every((r) => r.re.test(password));
  const canSubmit = email.trim().length > 3 && pwdOk;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setState({ kind: "submitting" });
    try {
      await register({
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName.trim() || undefined,
      });
      router.push("/dashboard");
    } catch (error) {
      const message =
        error instanceof ApiError
          ? translate(error.message)
          : "Не удалось зарегистрироваться. Попробуйте ещё раз.";
      setState({ kind: "error", message });
    }
  }

  return (
    <main className="min-h-screen bg-[#111422] px-5 py-10 text-[#F0F4F8]">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[532px] flex-col items-center justify-center">
        <BrandLogo className="mb-8" width={240} priority />

        <section className="w-full rounded-[28px] border border-white/10 bg-[#202332]/80 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur md:p-10">
          <div className="grid h-[64px] grid-cols-2 rounded-2xl bg-[#292d3d] p-1.5">
            <Link
              href="/login"
              className="grid place-items-center rounded-xl text-lg font-bold text-slate-400 transition hover:text-slate-200"
            >
              Вход
            </Link>
            <div className="grid place-items-center rounded-xl bg-[#22A64B] text-lg font-bold text-white shadow-[0_8px_24px_rgba(34,166,75,0.35)]">
              Регистрация
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-9 space-y-6">
            <Field label="Email">
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="you@example.com"
              />
            </Field>

            <Field label="Имя">
              <input
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputCls}
                maxLength={255}
                placeholder="Как к вам обращаться"
              />
            </Field>

            <Field label="Пароль">
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="••••••••"
              />
              <ul className="mt-3 grid gap-1 text-xs text-slate-500 sm:grid-cols-3">
                {PWD_RULES.map((r) => {
                  const passed = r.re.test(password);
                  return (
                    <li
                      key={r.label}
                      className={passed ? "text-brand-400" : "text-slate-500"}
                    >
                      {passed ? "✓" : "○"} {r.label}
                    </li>
                  );
                })}
              </ul>
            </Field>

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="flex h-[66px] w-full items-center justify-center gap-3 rounded-2xl bg-[#22A64B] text-xl font-bold text-white shadow-[0_16px_36px_rgba(34,166,75,0.25)] transition hover:bg-[#27B350] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
              Создать аккаунт
            </button>

            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-slate-400">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[#22A64B] text-white">
                <Check className="h-3.5 w-3.5" />
              </span>
              <span>
                Нажимая кнопку, вы соглашаетесь с{" "}
                <Link href="/terms" className="text-brand-400 hover:text-brand-300">
                  пользовательским соглашением
                </Link>
                ,{" "}
                <Link href="/privacy" className="text-brand-400 hover:text-brand-300">
                  политикой конфиденциальности
                </Link>{" "}
                и{" "}
                <Link href="/personal-data" className="text-brand-400 hover:text-brand-300">
                  обработкой персональных данных
                </Link>
                .
              </span>
            </div>

            {state.kind === "error" && (
              <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/30">
                {state.message}
              </p>
            )}
          </form>
        </section>

        <footer className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-600">
          <Link href="/privacy" className="hover:text-slate-400">Конфиденциальность</Link>
          <Link href="/personal-data" className="hover:text-slate-400">Персональные данные</Link>
          <Link href="/cookies" className="hover:text-slate-400">Cookies</Link>
          <Link href="/terms" className="hover:text-slate-400">Соглашение</Link>
          <span>© 2026 ДОЖИМ-АЙ</span>
        </footer>
      </div>
    </main>
  );
}

const inputCls =
  "block h-[58px] w-full rounded-2xl border border-white/10 bg-[#272b3a] px-5 text-lg text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-3 block text-sm font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function translate(detail: string): string {
  switch (detail) {
    case "email_already_registered":
      return "Этот email уже занят.";
    default:
      return `Ошибка: ${detail}`;
  }
}
