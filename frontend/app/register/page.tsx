"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      // Cookies are already set on the response; land users on the
      // homepage so they can upload immediately.
      router.push("/");
    } catch (error) {
      const message =
        error instanceof ApiError
          ? translate(error.message)
          : "Не удалось зарегистрироваться. Попробуйте ещё раз.";
      setState({ kind: "error", message });
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <div className="w-full">
        <h1 className="text-2xl font-semibold text-slate-900">Регистрация</h1>
        <p className="mt-1 text-sm text-slate-500">
          Уже есть аккаунт?{" "}
          <Link
            href="/login"
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            Войти
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
          <Field label="Имя" hint="Необязательно.">
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
            />
            <ul className="mt-2 space-y-1 text-xs">
              {PWD_RULES.map((r) => {
                const passed = r.re.test(password);
                return (
                  <li
                    key={r.label}
                    className={
                      passed ? "text-emerald-700" : "text-slate-500"
                    }
                  >
                    {passed ? "✓" : "○"} {r.label}
                  </li>
                );
              })}
            </ul>
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
              <UserPlus className="h-5 w-5" />
            )}
            Создать аккаунт
          </Button>

          {state.kind === "error" && (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
              {state.message}
            </p>
          )}
        </form>

        <p className="mt-8 text-center text-xs text-slate-400">
          <Link href="/" className="hover:text-slate-600">
            На главную
          </Link>
        </p>
      </div>
    </main>
  );
}

const inputCls =
  "block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
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
