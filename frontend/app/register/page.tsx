"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { registerUser } from "../../lib/api";

const DEMO_AUTH_ENABLED = process.env.NEXT_PUBLIC_DEMO_AUTH === "true";

function saveSession(payload: {
  token: string;
  user: { id: string; name: string; email: string; role: string };
  project?: { id: string; name: string; region: string };
}) {
  window.localStorage.setItem("dozhimAuthToken", payload.token);
  window.localStorage.setItem("dozhimUser", JSON.stringify(payload.user));
  if (payload.project) {
    window.localStorage.setItem("dozhimProject", JSON.stringify(payload.project));
  }
}

function createDemoSession(name: string, email: string) {
  return {
    token: "demo-local-token",
    user: {
      id: "demo-local-user",
      name: name.trim() || "Demo User",
      email: email.trim() || "demo@dozim.ai",
      role: "user"
    },
    project: {
      id: "demo-local-project",
      name: "Первый проект",
      region: "Москва"
    }
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = await registerUser({ name, email, password });
      saveSession(payload);
      router.push("/dashboard");
    } catch (requestError) {
      if (DEMO_AUTH_ENABLED && requestError instanceof Error && requestError.message.includes("Backend недоступен")) {
        saveSession(createDemoSession(name, email));
        router.push("/dashboard");
        return;
      }

      setError(requestError instanceof Error ? requestError.message : "Не удалось зарегистрироваться. Попробуйте еще раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card panel">
        <div className="brand auth-brand">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <h1 className="brand-title">
            ДОЖИМ-<span>АЙ</span>
          </h1>
        </div>

        <h2 className="section-title">Регистрация</h2>
        <p className="section-copy">Создайте аккаунт, чтобы сохранить аудит конкурентов и продолжить работу в кабинете.</p>
        {DEMO_AUTH_ENABLED ? (
          <p className="demo-auth-note">Demo auth включен: если backend недоступен, регистрация сохранит локального demo-пользователя.</p>
        ) : null}

        <form onSubmit={submitRegister}>
          <div className="field">
            <label htmlFor="name">Имя</label>
            <input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Андрей" required />
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
          </div>

          <div className="field">
            <label htmlFor="password">Пароль</label>
            <input id="password" type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Минимум 6 символов" required />
          </div>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="actions">
            <button className="primary-button" disabled={loading} type="submit">
              {loading ? "Регистрирую..." : "Зарегистрироваться"}
            </button>
            <Link className="secondary-link" href="/radar">
              Вернуться к РАДАРУ
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
