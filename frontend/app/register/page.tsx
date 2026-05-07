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
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <div className="w-full">
        <h1 className="text-2xl font-semibold">Регистрация</h1>
        <p className="mt-1 text-sm text-ink-600">
          Уже есть аккаунт?{" "}
          <Link
            href="/login"
            className="font-medium text-brand-500 hover:text-brand-600"
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
                    className={passed ? "text-brand-500" : "text-ink-600"}
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
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-600">{hint}</span>}
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
