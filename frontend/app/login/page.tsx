"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, login } from "@/lib/api";

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
    setState({ kind: "submitting" });
    try {
      await login(email.trim().toLowerCase(), password);
      router.push(next);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? translate(error.message)
          : "Не удалось войти. Попробуйте ещё раз.";
      setState({ kind: "error", message });
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <div className="w-full">
        <h1 className="text-2xl font-semibold">Вход</h1>
        <p className="mt-1 text-sm text-ink-600">
          Нет аккаунта?{" "}
          <Link
            href="/register"
            className="font-medium text-brand-500 hover:text-brand-600"
          >
            Зарегистрируйтесь
          </Link>
          .
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
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
            />
          </Field>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!canSubmit || submitting}
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <LogIn className="h-5 w-5" />
            )}
            Войти
          </Button>

          {state.kind === "error" && (
            <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/30">
              {state.message}
            </p>
          )}
        </form>

        <p className="mt-8 text-center text-xs text-ink-600">
          <Link href="/" className="hover:text-ink-800">
            На главную
          </Link>
        </p>
      </div>
    </main>
  );
}

const inputCls =
  "block w-full rounded-xl border border-ink-300/60 bg-ink-100 px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-600 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
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
