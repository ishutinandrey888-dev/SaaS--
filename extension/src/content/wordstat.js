(function () {
  const MARKER = "data-cr-wordstat-processed";
  const logoUrl = chrome.runtime.getURL("assets/dozhim-logo.png");

  function textOf(node) {
    return (node && node.textContent ? node.textContent : "").replace(/\s+/g, " ").trim();
  }

  function extractCurrentQuery() {
    const params = new URLSearchParams(location.search);
    return params.get("words") || params.get("text") || textOf(document.querySelector("input"));
  }

  function parseFrequency(value) {
    const match = String(value || "").replace(/\s+/g, "").match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  function detectIntent(phrase) {
    const value = phrase.toLowerCase();
    if (/[а-яa-z0-9-]+\.(ru|com|рф|io|app)/i.test(value) || /яндекс|авито|циан|озон|wildberries|wb|леруа|петрович/.test(value)) return "brand";
    if (/москв|спб|санкт|район|област|рядом|у метро|в мо|новосибирск|казань|екатеринбург/.test(value)) return "geo";
    if (/купить|цена|стоимость|заказать|доставка|под ключ|услуг|монтаж|ремонт|заявк|рассроч|ипотек/.test(value)) return "commercial";
    if (/как|что|почему|инструкция|пример|самостоятельно|отзывы|форум|своими руками/.test(value)) return "informational";
    return "mixed";
  }

  function detectKeywordSignals(phrase, frequency) {
    const value = phrase.toLowerCase();
    const signals = [];
    if (/купить|цена|стоимость|заказать|под ключ|услуг|заявк|рассроч|ипотек/.test(value)) signals.push("коммерческий запрос");
    if (/бесплатно|своими руками|самостоятельно|вакансии|работа|отзывы|форум|скачать|образец|пример/.test(value)) signals.push("минус-слово");
    if (/дизайн|смета|калькулятор|материал|ипотек|кредит|ремонт|доставка|подбор/.test(value)) signals.push("смежная ниша");
    if ((frequency || 0) >= 1000 || /цена|стоимость|под ключ|купить|заказать/.test(value)) signals.push("высокий потенциал");
    return signals;
  }

  function buildAdGroupHint(keyword) {
    const phrase = keyword.phrase.toLowerCase();
    if (/цена|стоимость|прайс/.test(phrase)) return "Группа объявлений: цена/стоимость.";
    if (/под ключ|заказать|услуг/.test(phrase)) return "Группа объявлений: услуга под ключ.";
    if (/москв|спб|район|у метро|област/.test(phrase)) return "Группа объявлений: гео-запросы.";
    if (/ремонт|монтаж|доставка|дизайн|смета|калькулятор/.test(phrase)) return "Группа объявлений: смежный спрос и лид-магнит.";
    if (/отзывы|как|что|почему|самостоятельно/.test(phrase)) return "Группа объявлений: прогрев/контент, не основной поиск.";
    return "Группа объявлений: базовая семантика.";
  }

  function findKeywordRows() {
    const rows = Array.from(document.querySelectorAll("tr, li, div"))
      .filter((node) => {
        const text = textOf(node);
        if (text.length < 4 || text.length > 160) return false;
        if (!/\d/.test(text)) return false;
        if (!/[а-яa-z]/i.test(text)) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 180 && rect.height > 16 && rect.height < 110;
      });

    const keywords = [];
    const seen = new Set();

    rows.forEach((row) => {
      const text = textOf(row);
      const frequency = parseFrequency(text);
      const phrase = text
        .replace(/\d[\d\s]*$/, "")
        .replace(/\s+\d[\d\s]*\s+/g, " ")
        .trim();

      if (!phrase || phrase.length < 3 || !frequency) return;
      const key = phrase.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      keywords.push({
        source: "wordstat",
        phrase,
        frequency,
        intent: detectIntent(phrase),
        signals: detectKeywordSignals(phrase, frequency),
        adGroupHint: buildAdGroupHint({ phrase, frequency }),
        seedQuery: extractCurrentQuery(),
        capturedAt: new Date().toISOString()
      });
    });

    return keywords.slice(0, 80);
  }

  function summarize(keywords) {
    const groups = keywords.reduce((acc, item) => {
      acc[item.intent] = (acc[item.intent] || 0) + 1;
      return acc;
    }, {});

    return [
      `Фраз: ${keywords.length}`,
      `Коммерческих: ${groups.commercial || 0}`,
      `Информационных: ${groups.informational || 0}`,
      `Брендовых: ${groups.brand || 0}`,
      `Гео: ${groups.geo || 0}`,
      `Смешанных: ${groups.mixed || 0}`
    ].join(" · ");
  }

  function summarizeSignals(keywords) {
    const counters = keywords.flatMap((item) => item.signals || []).reduce((acc, signal) => {
      acc[signal] = (acc[signal] || 0) + 1;
      return acc;
    }, {});

    return [
      ["коммерческие запросы", counters["коммерческий запрос"] || 0],
      ["минус-слова", counters["минус-слово"] || 0],
      ["смежные ниши", counters["смежная ниша"] || 0],
      ["высокий потенциал", counters["высокий потенциал"] || 0]
    ];
  }

  function renderAdGroupHints(keywords) {
    const hints = Array.from(new Set(keywords.map((item) => item.adGroupHint).filter(Boolean))).slice(0, 5);
    if (!hints.length) return "";

    return `
      <section class="cr-radar-summary">
        <strong>AI-подсказка: какие группы объявлений создать</strong>
        <div class="cr-radar-ideas">
          ${hints.map((hint) => `<span>${escapeHtml(hint)}</span>`).join("")}
        </div>
      </section>
    `;
  }

  function renderSoftGate(keywords) {
    if (!keywords.length) return "";

    return `
      <section class="cr-radar-softgate">
        <strong>Хотите полный отчет по конкурентам?</strong>
        <p>Переходите в ДОЖИМ-АЙ: соберем AI-аудит, сравним спрос и подготовим основу кампании.</p>
        <div class="cr-radar-inline">
          <button class="cr-radar-button" data-cr-full-audit>Получить полный AI-аудит</button>
          <button class="cr-radar-button secondary" data-cr-create-campaign>Создать рекламную кампанию с AI</button>
        </div>
      </section>
    `;
  }

  function renderSummaryButton(state) {
    const count = (state.keywords || []).length;
    return `
      <button class="cr-radar-button cr-radar-summary-open" data-cr-open-summary type="button">
        Открыть сводку
        ${count ? `<span class="cr-radar-badge">${count}</span>` : ""}
      </button>
    `;
  }

  async function openSummaryFallback(keywords) {
    chrome.runtime.sendMessage({ type: "CR_OPEN_POPUP" }, async (response) => {
      if (response && response.ok) return;
      if (keywords && keywords.length) {
        renderPanel(keywords);
        return;
      }
      const state = await globalThis.CompetitorRadarStorage.getRadarState();
      const latestItems = state.latestScan && state.latestScan.type === "keywords" ? state.latestScan.items : [];
      const fallbackKeywords = latestItems && latestItems.length ? latestItems : (state.keywords || []).slice(-25).reverse();
      renderPanel(fallbackKeywords);
    });
  }

  async function renderPanel(keywords) {
    const previous = document.querySelector(".cr-radar-panel");
    if (previous) previous.remove();
    const state = await globalThis.CompetitorRadarStorage.getRadarState();

    const panel = document.createElement("aside");
    panel.className = "cr-radar-panel";
    panel.innerHTML = `
      <div class="cr-radar-header">
        <h3>
          <span class="cr-radar-brand">
            <img class="cr-radar-logo" src="${logoUrl}" alt="ДОЖИМ-АИ">
          </span>
          <span class="cr-radar-title">Радар Wordstat</span>
        </h3>
        <button class="cr-radar-close" data-cr-close aria-label="Закрыть">×</button>
      </div>
      <div class="cr-radar-panel-toolbar">
        ${renderSummaryButton(state)}
      </div>
      <p class="cr-radar-muted">${escapeHtml(summarize(keywords))}</p>
      <div class="cr-radar-scroll">
        <div class="cr-radar-sync">
          <div>
            <strong>${state.apiEnabled ? "Backend подключен" : "Локальный режим"}</strong>
            <span>${escapeHtml(state.syncStatus || "Данные сохраняются в браузере")}</span>
          </div>
          <button class="cr-radar-button secondary" data-cr-connect-backend>${state.apiEnabled ? "Переподключить" : "Подключить backend"}</button>
        </div>
        <section class="cr-radar-summary">
          <strong>Разбор видимой семантики</strong>
          <div class="cr-radar-tags">
            ${summarizeSignals(keywords).map(([label, count]) => `<span class="cr-radar-tag">${escapeHtml(label)}: ${count}</span>`).join("")}
          </div>
        </section>
        ${renderAdGroupHints(keywords)}
        <div class="cr-radar-list"></div>
      </div>
      <div class="cr-radar-actions">
        ${renderSoftGate(keywords)}
        <button class="cr-radar-button" data-cr-save>Сохранить ключи в сводку</button>
      </div>
    `;

    const list = panel.querySelector(".cr-radar-list");
    if (!keywords.length) {
      list.innerHTML = `<p class="cr-radar-muted">Пока не удалось распознать фразы. Дождитесь загрузки Wordstat или измените запрос.</p>`;
    } else {
      keywords.slice(0, 25).forEach((item) => {
        const card = document.createElement("div");
        card.className = "cr-radar-card";
        card.innerHTML = `
          <strong>${escapeHtml(item.phrase)}</strong>
          <div class="cr-radar-domain">Частотность: ${escapeHtml(item.frequency)}</div>
          <p class="cr-radar-insight">${escapeHtml(item.adGroupHint || "")}</p>
          <div class="cr-radar-tags">
            <span class="cr-radar-tag">${escapeHtml(intentLabel(item.intent))}</span>
            ${(item.signals || []).map((signal) => `<span class="cr-radar-tag">${escapeHtml(signal)}</span>`).join("")}
          </div>
        `;
        list.append(card);
      });
    }

    panel.querySelector("[data-cr-close]").addEventListener("click", () => panel.remove());
    panel.querySelectorAll("[data-cr-open-summary]").forEach((button) => {
      button.addEventListener("click", async () => {
        await openSummaryFallback(keywords);
      });
    });
    panel.querySelectorAll("[data-cr-full-audit]").forEach((button) => {
      button.addEventListener("click", async () => {
        await globalThis.CompetitorRadarStorage.trackEvent("extension_wordstat_full_audit_clicked", {
          query: extractCurrentQuery(),
          count: keywords.length
        });
        await globalThis.CompetitorRadarStorage.openDozhim("/lead-magnet");
      });
    });
    panel.querySelectorAll("[data-cr-create-campaign]").forEach((button) => {
      button.addEventListener("click", async () => {
        await globalThis.CompetitorRadarStorage.trackEvent("extension_wordstat_create_campaign_clicked", {
          query: extractCurrentQuery(),
          count: keywords.length
        });
        await globalThis.CompetitorRadarStorage.openDozhim("/");
      });
    });
    panel.querySelector("[data-cr-connect-backend]").addEventListener("click", async (event) => {
      event.currentTarget.textContent = "Подключаю...";
      event.currentTarget.disabled = true;
      await globalThis.CompetitorRadarStorage.connectBackend();
      showToast("Backend: статус обновлен");
      renderPanel(keywords);
    });
    panel.querySelector("[data-cr-save]").addEventListener("click", async () => {
      await globalThis.CompetitorRadarStorage.saveKeywords(keywords);
      await globalThis.CompetitorRadarStorage.trackEvent("extension_keywords_saved", {
        query: extractCurrentQuery(),
        count: keywords.length
      });
      showToast(`Ключи сохранены в сводку: ${keywords.length}`);
      renderPanel(keywords);
    });

    document.body.append(panel);
    updateSummaryBadge();
  }

  function intentLabel(intent) {
    const labels = {
      commercial: "коммерческий",
      informational: "информационный",
      brand: "бренд",
      brand_or_domain: "бренд/домен",
      geo: "гео",
      mixed: "смешанный"
    };
    return labels[intent] || "смешанный";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "cr-radar-toast";
    toast.textContent = message;
    document.body.append(toast);
    setTimeout(() => toast.remove(), 2200);
  }

  function injectButton() {
    if (document.body.hasAttribute(MARKER)) return;
    document.body.setAttribute(MARKER, "true");

    const stack = document.createElement("div");
    stack.className = "cr-radar-launcher-stack";

    const button = document.createElement("button");
    button.className = "cr-radar-button cr-radar-launcher";
    button.innerHTML = `<span class="cr-radar-target" aria-hidden="true"></span><span>Радар Wordstat</span>`;
    button.addEventListener("click", async () => {
      const keywords = findKeywordRows();
      await globalThis.CompetitorRadarStorage.saveLatestScan({
        type: "keywords",
        title: "Радар Wordstat",
        query: extractCurrentQuery(),
        items: keywords
      });

      chrome.runtime.sendMessage({ type: "CR_OPEN_SIDE_PANEL" }, (response) => {
        if (!response || !response.ok) renderPanel(keywords);
      });
    });

    const summaryButton = document.createElement("button");
    summaryButton.className = "cr-radar-button cr-radar-launcher secondary";
    summaryButton.innerHTML = `Открыть сводку <span class="cr-radar-badge" hidden>0</span>`;
    summaryButton.addEventListener("click", async () => {
      await openSummaryFallback();
    });

    stack.append(button, summaryButton);
    document.body.append(stack);
    updateSummaryBadge();
  }

  async function updateSummaryBadge() {
    const state = await globalThis.CompetitorRadarStorage.getRadarState();
    const count = (state.keywords || []).length;
    document.querySelectorAll(".cr-radar-badge").forEach((badge) => {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    });
  }

  injectButton();
})();
