"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_RADAR_API_URL || "http://localhost:8787";

type Competitor = {
  id: string;
  domain: string;
  title: string;
  offer: string;
  weakness: string;
  activityScore: number;
};

type RadarScan = {
  id: string;
  niche: string;
  site: string;
  keywords: string[];
  region: string;
  result: {
    competitors: Competitor[];
    offers: string[];
    weaknesses: string[];
    ideas: string[];
  };
};

type FormState = {
  niche: string;
  site: string;
  keywords: string;
  region: string;
};

async function track(eventName: string, properties: Record<string, unknown> = {}) {
  try {
    await fetch(`${API_URL}/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName, properties, source: "radar_web_lead_magnet" })
    });
  } catch {
    // Analytics must not block the lead-magnet flow.
  }
}

function getContactType(contact: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim()) ? "email" : "telegram";
}

export default function RadarPage() {
  const [form, setForm] = useState<FormState>({
    niche: "ремонт квартир",
    site: "",
    keywords: "ремонт квартир москва\nремонт под ключ\nдизайн-проект в подарок",
    region: "Москва"
  });
  const [scan, setScan] = useState<RadarScan | null>(null);
  const [contact, setContact] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leadLoading, setLeadLoading] = useState(false);
  const [message, setMessage] = useState("");

  const canSubmitLead = useMemo(() => Boolean(scan?.id && contact.trim() && consentAccepted), [scan, contact, consentAccepted]);

  useEffect(() => {
    track("radar_page_view");
  }, []);

  async function submitScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("Запускаю быстрый аудит конкурентов...");
    await track("radar_scan_submitted", { niche: form.niche, region: form.region });

    try {
      const response = await fetch(`${API_URL}/radar/scans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Не удалось запустить аудит.");
      setScan(payload.scan);
      setMessage("Готово: нашли конкурентов, офферы и идеи для вашей рекламы.");
      await track("radar_result_viewed", {
        scanId: payload.scan.id,
        competitorsCount: payload.scan.result.competitors.length
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка аудита.");
    } finally {
      setLoading(false);
    }
  }

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scan) return;

    setLeadLoading(true);
    setMessage("Сохраняю контакт и согласие...");

    try {
      const response = await fetch(`${API_URL}/radar/scans/${scan.id}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact,
          consentAccepted,
          consentVersion: "2026-05-31"
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Не удалось сохранить лид.");
      setMessage("Контакт сохранен. Следующий шаг: полный AI-аудит в ДОЖИМ-АИ.");
      await track("radar_lead_submitted", {
        scanId: scan.id,
        contactType: getContactType(contact)
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка сохранения лида.");
    } finally {
      setLeadLoading(false);
    }
  }

  async function clickFullAudit() {
    await track("radar_full_audit_cta_clicked", { scanId: scan?.id });
    setMessage("CTA зафиксирован. В P1 здесь будет переход в основной ДОЖИМ-АИ.");
  }

  return (
    <main className="radar-page">
      <div className="radar-shell">
        <header className="radar-header">
          <div className="brand">
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
          <p className="header-note">
            Радар конкурентов показывает, какие офферы используют игроки рынка, где они слабы и какие рекламные идеи можно забрать в работу.
          </p>
        </header>

        <section className="hero-grid">
          <form className="panel form-panel" onSubmit={submitScan}>
            <h2 className="section-title">Быстрый аудит конкурентов</h2>
            <p className="section-copy">Введите нишу, сайт или ключевые фразы. MVP строит первичный отчет и готовит лид к полному AI-аудиту.</p>

            <div className="field">
              <label htmlFor="niche">Ниша</label>
              <input
                id="niche"
                value={form.niche}
                onChange={(event) => setForm({ ...form, niche: event.target.value })}
                placeholder="Например: стоматология, ремонт квартир, онлайн-школа"
              />
            </div>

            <div className="field">
              <label htmlFor="site">Сайт</label>
              <input
                id="site"
                value={form.site}
                onChange={(event) => setForm({ ...form, site: event.target.value })}
                placeholder="example.ru"
              />
            </div>

            <div className="field">
              <label htmlFor="keywords">Ключевые фразы</label>
              <textarea
                id="keywords"
                value={form.keywords}
                onChange={(event) => setForm({ ...form, keywords: event.target.value })}
                placeholder="По одной фразе на строку"
              />
            </div>

            <div className="field">
              <label htmlFor="region">Регион</label>
              <input
                id="region"
                value={form.region}
                onChange={(event) => setForm({ ...form, region: event.target.value })}
                placeholder="Москва"
              />
            </div>

            <div className="actions">
              <button className="primary-button" disabled={loading} type="submit">
                {loading ? "Сканирую..." : "Показать конкурентов"}
              </button>
              <span className="status">{message}</span>
            </div>
          </form>

          <div className="panel results-panel">
            {!scan ? (
              <div className="empty-result">
                <div>
                  <h2 className="section-title">Результат появится здесь</h2>
                  <p className="section-copy">После отправки формы покажем конкурентов, офферы, слабые места и 3-5 идей для рекламы.</p>
                </div>
              </div>
            ) : (
              <>
                <h2 className="section-title">Радар по нише: {scan.niche || scan.keywords[0] || "ваш запрос"}</h2>
                <div className="result-meta">
                  <span className="pill">{scan.region}</span>
                  <span className="pill">{scan.result.competitors.length} конкурентов</span>
                  <span className="pill">{scan.result.offers.length} офферов</span>
                </div>

                <div className="competitor-table-wrap">
                  <table className="competitor-table">
                    <thead>
                      <tr>
                        <th>Конкурент / домен</th>
                        <th>Оффер</th>
                        <th>Слабое место</th>
                        <th>Идея для рекламы</th>
                        <th>Активность</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scan.result.competitors.map((competitor, index) => (
                        <tr key={competitor.id}>
                          <td data-label="Конкурент / домен">
                            <strong>{competitor.title}</strong>
                            <span className="domain">{competitor.domain}</span>
                          </td>
                          <td data-label="Оффер">{competitor.offer}</td>
                          <td data-label="Слабое место">{competitor.weakness}</td>
                          <td data-label="Идея для рекламы">{scan.result.ideas[index] || scan.result.ideas[0]}</td>
                          <td data-label="Активность">
                            <span className="score">{competitor.activityScore}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="result-columns">
                  <div className="mini-block">
                    <h3>Слабые места</h3>
                    <ul>
                      {scan.result.weaknesses.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="mini-block">
                    <h3>Идеи для рекламы</h3>
                    <ul>
                      {scan.result.ideas.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <form className="panel lead-panel" onSubmit={submitLead}>
                  <h2 className="section-title">Получить полный разбор</h2>
                  <p className="section-copy">Оставьте Telegram или email, чтобы забрать полный AI-аудит в ДОЖИМ-АИ.</p>
                  <div className="field">
                    <label htmlFor="contact">Telegram или email</label>
                    <input
                      id="contact"
                      value={contact}
                      onChange={(event) => setContact(event.target.value)}
                      placeholder="@username или name@example.ru"
                    />
                  </div>
                  <label className="consent-row">
                    <input
                      checked={consentAccepted}
                      onChange={(event) => setConsentAccepted(event.target.checked)}
                      type="checkbox"
                    />
                    <span>
                      Я согласен на обработку персональных данных для подготовки аудита и связи по продукту ДОЖИМ-АИ.
                    </span>
                  </label>
                  <div className="legal-links">
                    <Link href="/privacy">Политика конфиденциальности</Link>
                    <Link href="/personal-data">Согласие на ПДн</Link>
                    <Link href="/terms">Условия</Link>
                  </div>
                  <div className="actions" style={{ marginTop: 18 }}>
                    <button className="primary-button" disabled={!canSubmitLead || leadLoading} type="submit">
                      {leadLoading ? "Сохраняю..." : "Оставить контакт"}
                    </button>
                    <button className="secondary-button" onClick={clickFullAudit} type="button">
                      Получить полный AI-аудит в ДОЖИМ-АИ
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
