(async function () {
  const state = await globalThis.CompetitorRadarStorage.getRadarState();
  const reportLogoUrl = chrome.runtime.getURL("assets/dozhim-logo.png");

  const competitorsPanel = document.querySelector("#competitorsPanel");
  const keywordsPanel = document.querySelector("#keywordsPanel");
  const competitorsCount = document.querySelector("#competitorsCount");
  const keywordsCount = document.querySelector("#keywordsCount");
  const updatedAt = document.querySelector("#updatedAt");
  const activeProject = document.querySelector("#activeProject");
  const apiBaseUrl = document.querySelector("#apiBaseUrl");
  const connectBackend = document.querySelector("#connectBackend");
  const syncStatus = document.querySelector("#syncStatus");
  const offerFilter = document.querySelector("#offerFilter");
  const onlyWithHypothesis = document.querySelector("#onlyWithHypothesis");
  const fullAudit = document.querySelector("#fullAudit");
  const createCampaign = document.querySelector("#createCampaign");
  let activeTab = "competitors";
  let viewState = {
    offer: "",
    onlyWithHypothesis: false
  };
  const activeProjectName = state.activeProject || "Ремонт квартир Москва";
  const projectCompetitors = filterByProject(state.competitors, activeProjectName);
  const projectKeywords = filterByProject(state.keywords, activeProjectName);

  competitorsCount.textContent = projectCompetitors.length;
  keywordsCount.textContent = projectKeywords.length;
  activeProject.value = activeProjectName;
  apiBaseUrl.value = state.apiBaseUrl || "http://localhost:8787";
  syncStatus.textContent = state.syncStatus || "Локальный режим";
  updatedAt.textContent = state.updatedAt
    ? `Обновлено: ${new Date(state.updatedAt).toLocaleString("ru-RU")}`
    : "Данные еще не сохранены";

  renderOfferFilter(projectCompetitors);
  renderCompetitors(projectCompetitors);
  renderKeywords(projectKeywords);
  renderSoftGate(projectCompetitors);

  activeProject.addEventListener("change", async () => {
    await globalThis.CompetitorRadarStorage.setRadarState({
      ...state,
      activeProject: activeProject.value.trim() || "Ремонт квартир Москва",
      remoteProjectId: null,
      syncStatus: state.apiEnabled ? "Проект изменен, переподключите backend" : state.syncStatus
    });
    location.reload();
  });

  apiBaseUrl.addEventListener("change", async () => {
    await globalThis.CompetitorRadarStorage.setRadarState({
      ...state,
      apiBaseUrl: apiBaseUrl.value.trim() || "http://localhost:8787",
      apiEnabled: false,
      apiToken: null,
      remoteProjectId: null,
      syncStatus: "Backend URL обновлен"
    });
    location.reload();
  });

  connectBackend.addEventListener("click", async () => {
    syncStatus.textContent = "Подключаю backend...";
    connectBackend.disabled = true;
    await globalThis.CompetitorRadarStorage.connectBackend();
    location.reload();
  });

  fullAudit.addEventListener("click", async () => {
    await globalThis.CompetitorRadarStorage.trackEvent("extension_popup_full_audit_clicked", {
      competitors: projectCompetitors.length
    });
    await globalThis.CompetitorRadarStorage.openDozhim("/lead-magnet");
  });

  createCampaign.addEventListener("click", async () => {
    await globalThis.CompetitorRadarStorage.trackEvent("extension_popup_create_campaign_clicked", {
      competitors: projectCompetitors.length,
      keywords: projectKeywords.length
    });
    await globalThis.CompetitorRadarStorage.openDozhim("/");
  });

  offerFilter.addEventListener("change", () => {
    viewState.offer = offerFilter.value;
    renderCompetitors(applyCompetitorFilters(projectCompetitors));
  });

  onlyWithHypothesis.addEventListener("change", () => {
    viewState.onlyWithHypothesis = onlyWithHypothesis.checked;
    renderCompetitors(applyCompetitorFilters(projectCompetitors));
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`#${button.dataset.tab}Panel`).classList.add("active");
      activeTab = button.dataset.tab;
      renderSoftGate(projectCompetitors);
    });
  });

  document.querySelector("#closePopup").addEventListener("click", () => {
    window.close();
  });

  document.querySelector("#clearState").addEventListener("click", async () => {
    await globalThis.CompetitorRadarStorage.setRadarState({
      activeProject: state.activeProject,
      competitors: [],
      keywords: []
    });
    location.reload();
  });

  document.querySelector("#exportJson").addEventListener("click", () => {
    const scopedState = {
      ...state,
      competitors: projectCompetitors,
      keywords: projectKeywords
    };
    const data = encodeURIComponent(JSON.stringify(scopedState, null, 2));
    const url = `data:application/json;charset=utf-8,${data}`;
    chrome.downloads ? chrome.downloads.download({ url, filename: "competitor-radar-export.json" }) : open(url);
  });

  document.querySelector("#exportReport").addEventListener("click", () => {
    const html = buildReportHtml({
      ...state,
      competitors: applyCompetitorFilters(projectCompetitors),
      keywords: projectKeywords
    });
    const url = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    chrome.downloads.download({
      url,
      filename: `radar-report-${slugify(state.activeProject || "project")}.html`
    });
  });

  function renderCompetitors(items) {
    if (!items.length) {
      const topKeyword = getTopKeyword(projectKeywords);
      competitorsPanel.innerHTML = topKeyword
        ? renderEmptyAction({
          title: "Конкуренты ещё не добавлены",
          text: `Откройте поиск Яндекса по самому частотному ключу: “${topKeyword.phrase}”.`,
          href: `https://yandex.ru/search/?text=${encodeURIComponent(topKeyword.phrase)}`,
          label: "Открыть конкурентов в Яндекс.Браузере"
        })
        : `<p class="empty">Откройте поиск Яндекса, нажмите “Радар конкурентов” и сохраните найденные объявления.</p>`;
      return;
    }

    competitorsPanel.innerHTML = items.slice().reverse().slice(0, 30).map((item) => `
      <article class="item">
        <strong>${escapeHtml(item.realHeadline || item.title || "Без заголовка")}</strong>
        <div class="tag">${escapeHtml(item.adLabel || item.sourceType || "Промо")}</div>
        <div class="domain">${escapeHtml(item.domain || "Домен не распознан")}</div>
        <p>${escapeHtml(item.description || "")}</p>
        <p class="meta"><strong>Оффер:</strong> ${escapeHtml(item.primaryOffer || "не распознан")}</p>
        <p class="meta"><strong>Стратегия:</strong> ${escapeHtml(item.strategy || "mixed")} · <strong>CTA:</strong> ${escapeHtml(item.cta || "не выражен явно")}</p>
        <p class="meta">${escapeHtml(item.insight || "")}</p>
        <p class="meta">${escapeHtml(item.hypothesis || "")}</p>
        ${(item.weaknesses || []).length ? `<p class="meta">Слабые места: ${escapeHtml((item.weaknesses || []).join("; "))}</p>` : ""}
        ${(item.sitelinks || []).length ? `<p class="meta">Быстрые ссылки: ${(item.sitelinks || []).map((link) => escapeHtml(link.title || link)).join(" · ")}</p>` : ""}
        <p class="meta">${escapeHtml(item.query || "Запрос не указан")}</p>
        <div class="tags">
          ${Array.from(new Set([...(item.detectedOffers || []), ...(item.triggers || [])])).slice(0, 10).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
      </article>
    `).join("");
  }

  function renderKeywords(items) {
    if (!items.length) {
      const topQuery = getTopCompetitorQuery(projectCompetitors);
      keywordsPanel.innerHTML = topQuery
        ? renderEmptyAction({
          title: "Ключевые запросы ещё не добавлены",
          text: `Откройте Wordstat по главному запросу из объявлений: “${topQuery}”.`,
          href: `https://wordstat.yandex.ru/?words=${encodeURIComponent(topQuery)}`,
          label: "Открыть ключи в Wordstat"
        })
        : `<p class="empty">Откройте Wordstat, нажмите “Радар Wordstat” и сохраните ключи.</p>`;
      return;
    }

    keywordsPanel.innerHTML = items.slice().reverse().slice(0, 40).map((item) => `
      <article class="item">
        <strong>${escapeHtml(item.phrase || "Без фразы")}</strong>
        <div class="domain">Частотность: ${escapeHtml(item.frequency || "не распознана")}</div>
        <p class="meta">${escapeHtml(item.adGroupHint || item.seedQuery || "Исходный запрос не указан")}</p>
        <div class="tags">
          <span class="tag">${escapeHtml(intentLabel(item.intent))}</span>
          ${(item.signals || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
      </article>
    `).join("");
  }

  function renderSoftGate(items) {
    const softGate = document.querySelector("#softGate");
    softGate.hidden = items.length + projectKeywords.length < 3;
  }

  function getTopKeyword(items) {
    return (items || [])
      .filter((item) => item.phrase)
      .slice()
      .sort((a, b) => Number(b.frequency || 0) - Number(a.frequency || 0))[0] || null;
  }

  function getTopCompetitorQuery(items) {
    const counts = (items || []).reduce((acc, item) => {
      const query = String(item.query || "").trim();
      if (!query) return acc;
      acc[query] = (acc[query] || 0) + 1;
      return acc;
    }, {});

    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top) return top[0];

    const title = (items || []).find((item) => item.title) && (items || []).find((item) => item.title).title;
    return title || "";
  }

  function renderEmptyAction({ title, text, href, label }) {
    return `
      <article class="empty-action">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(text)}</p>
        <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>
      </article>
    `;
  }

  function filterByProject(items, project) {
    return (items || []).filter((item) => (item.project || project) === project);
  }

  function applyCompetitorFilters(items) {
    return items.filter((item) => {
      const offers = item.detectedOffers || [];
      if (viewState.offer && !offers.includes(viewState.offer)) return false;
      if (viewState.onlyWithHypothesis && !item.hypothesis) return false;
      return true;
    });
  }

  function renderOfferFilter(items) {
    const offers = Array.from(new Set(items.flatMap((item) => item.detectedOffers || []))).sort();
    offerFilter.innerHTML = [
      `<option value="">Все офферы</option>`,
      ...offers.map((offer) => `<option value="${escapeHtml(offer)}">${escapeHtml(offer)}</option>`)
    ].join("");
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

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-zа-я0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "project";
  }

  function buildReportHtml(reportState) {
    const project = reportState.activeProject || "Проект";
    const competitors = reportState.competitors || [];
    const keywords = reportState.keywords || [];
    const offers = competitors.flatMap((item) => item.detectedOffers || []);
    const offerCounts = offers.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {});
    const topOffers = Object.entries(offerCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const hypotheses = Array.from(new Set(competitors.map((item) => item.hypothesis).filter(Boolean))).slice(0, 8);

    return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Радар конкурентов - ${escapeHtml(project)}</title>
  <style>
    body{background:#181b2b;color:#f8fafc;font:16px/1.5 Arial,sans-serif;margin:0;padding:32px}
    .wrap{max-width:980px;margin:0 auto}
    img{width:220px;height:auto}
    h1{font-size:32px;margin:24px 0 8px}
    h2{font-size:22px;margin:28px 0 12px}
    .muted{color:#9aa6bd}
    .grid{display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr))}
    .card{background:#242738;border:1px solid #3b3f55;border-radius:8px;padding:16px}
    .domain,.green{color:#10d991}
    .tag{background:rgba(16,217,145,.12);border:1px solid rgba(16,217,145,.45);border-radius:999px;color:#b8ffe3;display:inline-block;font-size:12px;margin:4px 4px 0 0;padding:3px 8px}
    @media(max-width:760px){.grid{grid-template-columns:1fr}body{padding:18px}}
  </style>
</head>
<body>
  <main class="wrap">
    <img src="${reportLogoUrl}" alt="ДОЖИМ-АИ">
    <h1>Радар конкурентов: ${escapeHtml(project)}</h1>
    <p class="muted">Сохранено промо-объявлений Директа: ${competitors.length}. Ключей: ${keywords.length}. Отчет создан: ${new Date().toLocaleString("ru-RU")}.</p>
    <h2>Повторяющиеся офферы</h2>
    <div>${topOffers.length ? topOffers.map(([name, count]) => `<span class="tag">${escapeHtml(name)} - ${count}</span>`).join("") : "<p class='muted'>Пока мало данных для вывода.</p>"}</div>
    <h2>Что тестировать</h2>
    <section class="grid">
      ${hypotheses.length ? hypotheses.map((hypothesis) => `
        <article class="card">
          <strong>${escapeHtml(hypothesis)}</strong>
        </article>
      `).join("") : "<p class='muted'>Пока мало данных для гипотез.</p>"}
    </section>
    <h2>Конкуренты</h2>
    <section class="grid">
      ${competitors.slice().reverse().slice(0, 40).map((item) => `
        <article class="card">
          <strong>${escapeHtml(item.realHeadline || item.title || "Без заголовка")}</strong>
          <span class="tag">${escapeHtml(item.adLabel || "Промо")}</span>
          <p class="domain">${escapeHtml(item.domain || "")}</p>
          <p class="muted"><strong>Стратегия:</strong> ${escapeHtml(item.strategy || "mixed")} · <strong>CTA:</strong> ${escapeHtml(item.cta || "не выражен явно")}</p>
          <p>${escapeHtml(item.description || "")}</p>
          <p class="muted">${escapeHtml(item.insight || "")}</p>
          <p class="muted">${escapeHtml(item.hypothesis || "")}</p>
          ${(item.detectedOffers || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </article>
      `).join("")}
    </section>
    <h2>Ключи Wordstat</h2>
    <section class="grid">
      ${keywords.slice().reverse().slice(0, 40).map((item) => `
        <article class="card">
          <strong>${escapeHtml(item.phrase || "")}</strong>
          <p class="green">Частотность: ${escapeHtml(item.frequency || "")}</p>
          <p class="muted">${escapeHtml(intentLabel(item.intent))}</p>
        </article>
      `).join("")}
    </section>
  </main>
</body>
</html>`;
  }
})();
