"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ApiError, login } from "@/lib/api";

const DEMO_ADMIN_EMAIL = "admin@dozim.ai";
const DEMO_ADMIN_PASSWORD = "password";
const DEMO_USER_EMAIL = "test@dozim.ai";
const DEMO_USER_PASSWORD = "password";
const DEMO_USER_KEY = "dozim-demo-user";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const submitting = state.kind === "submitting";
  const canSubmit = email.trim().length > 3 && password.length >= 8;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    await submitLogin(email.trim().toLowerCase(), password, next);
  }

  async function submitLogin(loginEmail: string, loginPassword: string, redirectTo: string) {
    setState({ kind: "submitting" });
    if (loginEmail === DEMO_USER_EMAIL && loginPassword === DEMO_USER_PASSWORD) {
      window.localStorage.setItem(
        DEMO_USER_KEY,
        JSON.stringify({
          email: DEMO_USER_EMAIL,
          full_name: "Иван Петров",
          plan: "free",
        }),
      );
      router.push(redirectTo || "/dashboard");
      return;
    }

    if (loginEmail === DEMO_ADMIN_EMAIL && loginPassword === DEMO_ADMIN_PASSWORD) {
      window.sessionStorage.setItem(
        "dozim_demo_user",
        JSON.stringify({
          id: "demo-admin",
          email: DEMO_ADMIN_EMAIL,
          user_metadata: { name: "Администратор" },
        }),
      );
      router.push("/admin");
      return;
    }

    try {
      await login(loginEmail, loginPassword);
      router.push(redirectTo);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? translate(error.message)
          : "Не удалось войти. Попробуйте ещё раз.";
      setState({ kind: "error", message });
    }
  }

  async function onDemoAdminLogin() {
    setEmail(DEMO_ADMIN_EMAIL);
    setPassword(DEMO_ADMIN_PASSWORD);
    await submitLogin(DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD, "/admin");
  }

  async function onDemoUserLogin() {
    setEmail(DEMO_USER_EMAIL);
    setPassword(DEMO_USER_PASSWORD);
    await submitLogin(DEMO_USER_EMAIL, DEMO_USER_PASSWORD, "/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#111422] px-5 py-10 text-[#F0F4F8]">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[532px] flex-col items-center justify-center">
        <BrandLogo className="mb-8" width={240} priority />

        <section className="w-full rounded-[28px] border border-white/10 bg-[#202332]/80 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur md:p-10">
          <div className="grid h-[64px] grid-cols-2 rounded-2xl bg-[#292d3d] p-1.5">
            <div className="grid place-items-center rounded-xl bg-[#22A64B] text-lg font-bold text-white shadow-[0_8px_24px_rgba(34,166,75,0.35)]">
              Вход
            </div>
            <Link
              href="/register"
              className="grid place-items-center rounded-xl text-lg font-bold text-slate-400 transition hover:text-slate-200"
            >
              Регистрация
            </Link>
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
            <Field label="Пароль">
              <input
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="••••••••"
              />
            </Field>

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="flex h-[66px] w-full items-center justify-center gap-3 rounded-2xl bg-[#22A64B] text-xl font-bold text-white shadow-[0_16px_36px_rgba(34,166,75,0.25)] transition hover:bg-[#27B350] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
              Войти
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={onDemoUserLogin}
              className="flex h-[54px] w-full items-center justify-center gap-3 rounded-2xl border border-[#22A64B]/50 bg-[#22A64B]/10 text-base font-bold text-[#6DDB87] transition hover:border-[#22A64B] hover:bg-[#22A64B]/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
              Войти как пользователь
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={onDemoAdminLogin}
              className="flex h-[54px] w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 text-base font-bold text-slate-300 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
              Войти как админ
            </button>

            <p className="text-center text-sm text-slate-500">
              Пользователь: test@dozim.ai / password
              <br />
              Админ: admin@dozim.ai / password
            </p>

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
    case "invalid_credentials":
      return "Неверный email или пароль.";
    case "account_locked":
      return "Слишком много попыток — попробуйте чуть позже.";
    case "user_disabled":
      return "Аккаунт отключён. Напишите в поддержку.";
    default:
      return `Ошибка: ${detail}`;
  }
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
