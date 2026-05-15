"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ApiError, login, register } from "@/lib/api";

type Mode = "login" | "register";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

const PWD_RULES = [
  { re: /.{8,}/, label: "минимум 8 символов" },
  { re: /[A-Za-zА-Яа-яЁё]/, label: "хотя бы одна буква" },
  { re: /\d/, label: "хотя бы одна цифра" },
];

const TH = {
  bg: "#1A1D2E",
  card: "#22253A",
  cardBorder: "rgba(255,255,255,0.06)",
  inputBg: "rgba(255,255,255,0.04)",
  inputBorder: "rgba(255,255,255,0.08)",
  G: "#22C55E",
  GD: "#16A34A",
  fg1: "#F1F5F9",
  fg2: "#94A3B8",
  fg3: "#64748B",
};

function AuthInner({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const submitting = state.kind === "submitting";
  const pwdOk = PWD_RULES.every(r => r.re.test(password));
  const canSubmit =
    email.trim().length > 3 &&
    (mode === "login" ? password.length >= 8 : pwdOk);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setState({ kind: "submitting" });
    try {
      if (mode === "login") {
        await login(email.trim().toLowerCase(), password);
        router.push(next);
      } else {
        await register({
          email: email.trim().toLowerCase(),
          password,
          full_name: fullName.trim() || undefined,
        });
        router.push("/dashboard");
      }
    } catch (error) {
      const message =
        error instanceof ApiError ? translate(error.message, mode) : "Не удалось войти. Попробуйте ещё раз.";
      setState({ kind: "error", message });
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: TH.bg,
        color: TH.fg1,
        fontFamily: "'Montserrat', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* Brand header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{
          fontSize: 36,
          fontWeight: 900,
          letterSpacing: "0.04em",
          color: TH.G,
          margin: 0,
        }}>
          ДОЖИМ-АЙ
        </h1>
        <p style={{
          fontSize: 13,
          color: TH.fg2,
          marginTop: 6,
        }}>
          AI-ассистент для рекламы
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: TH.card,
          border: `1px solid ${TH.cardBorder}`,
          borderRadius: 16,
          padding: 32,
        }}
      >
        {/* Tabs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "rgba(0,0,0,0.2)",
            borderRadius: 10,
            padding: 4,
            marginBottom: 24,
          }}
        >
          <TabLink href="/login" label="Вход" active={mode === "login"} />
          <TabLink href="/register" label="Регистрация" active={mode === "register"} />
        </div>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Field label="Email">
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />
          </Field>

          {mode === "register" && (
            <Field label="Имя" hint="Необязательно.">
              <input
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={255}
                placeholder="Как к вам обращаться"
                style={inputStyle}
              />
            </Field>
          )}

          <Field label="Пароль">
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
            {mode === "register" && password.length > 0 && (
              <ul style={{ marginTop: 8, listStyle: "none", padding: 0, fontSize: 11 }}>
                {PWD_RULES.map(r => {
                  const passed = r.re.test(password);
                  return (
                    <li key={r.label} style={{ color: passed ? TH.G : TH.fg3, marginBottom: 2 }}>
                      {passed ? "✓" : "○"} {r.label}
                    </li>
                  );
                })}
              </ul>
            )}
          </Field>

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            style={{
              marginTop: 6,
              padding: "14px",
              borderRadius: 10,
              background: canSubmit && !submitting ? TH.G : "rgba(34,197,94,0.4)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              border: "none",
              cursor: canSubmit && !submitting ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "background 0.15s",
            }}
            onMouseOver={e => {
              if (canSubmit && !submitting) (e.currentTarget as HTMLButtonElement).style.background = TH.GD;
            }}
            onMouseOut={e => {
              if (canSubmit && !submitting) (e.currentTarget as HTMLButtonElement).style.background = TH.G;
            }}
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>

          {state.kind === "error" && (
            <p
              style={{
                background: "rgba(239,68,68,0.1)",
                color: "#FCA5A5",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 13,
                margin: 0,
              }}
            >
              {state.message}
            </p>
          )}
        </form>

        {/* Demo credentials info */}
        <div
          style={{
            marginTop: 24,
            padding: "14px 16px",
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: 10,
            fontSize: 12,
            lineHeight: 1.6,
            color: TH.fg2,
          }}
        >
          <strong style={{ color: "#F59E0B" }}>Демо-режим</strong>
          {" "}— войдите тестовыми данными:
          <div style={{ marginTop: 6, fontFamily: "monospace", color: TH.fg1 }}>
            <div><span style={{ background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4 }}>test@dozim.ai</span> / <span style={{ background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4 }}>password</span> <span style={{ color: TH.fg3, fontFamily: "Montserrat" }}>— обычный пользователь</span></div>
            <div style={{ marginTop: 3 }}><span style={{ background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4 }}>admin@dozim.ai</span> / <span style={{ background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4 }}>password</span> <span style={{ color: TH.fg3, fontFamily: "Montserrat" }}>— админ</span></div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 11, color: TH.fg3, marginTop: 24 }}>
        © {new Date().getFullYear()} ДОЖИМ-АЙ
      </p>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  background: TH.inputBg,
  border: `1px solid ${TH.inputBorder}`,
  color: TH.fg1,
  fontSize: 13,
  fontFamily: "'Montserrat', system-ui, sans-serif",
  outline: "none",
  transition: "border-color 0.15s",
};

function TabLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        padding: "10px 16px",
        borderRadius: 8,
        textAlign: "center",
        fontSize: 13,
        fontWeight: 700,
        textDecoration: "none",
        background: active ? TH.G : "transparent",
        color: active ? "#fff" : TH.fg2,
        transition: "background 0.15s, color 0.15s",
      }}
    >
      {label}
    </Link>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{
        display: "block",
        fontSize: 11,
        fontWeight: 600,
        color: TH.fg2,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 8,
      }}>
        {label}
      </span>
      {children}
      {hint && <span style={{ display: "block", fontSize: 11, color: TH.fg3, marginTop: 4 }}>{hint}</span>}
    </label>
  );
}

function translate(detail: string, mode: Mode): string {
  switch (detail) {
    case "invalid_credentials":
      return "Неверный email или пароль.";
    case "account_locked":
      return "Слишком много попыток — попробуйте чуть позже.";
    case "user_disabled":
      return "Аккаунт отключён. Напишите в поддержку.";
    case "email_already_registered":
      return "Этот email уже занят.";
    default:
      return mode === "login" ? `Ошибка входа: ${detail}` : `Ошибка регистрации: ${detail}`;
  }
}

export function AuthForm({ mode }: { mode: Mode }) {
  return (
    <Suspense fallback={null}>
      <AuthInner mode={mode} />
    </Suspense>
  );
}
