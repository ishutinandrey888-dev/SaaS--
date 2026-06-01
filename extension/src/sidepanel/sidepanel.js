(async function () {
  const reportLogoUrl = chrome.runtime.getURL("assets/dozhim-logo.png");
  let state = await globalThis.CompetitorRadarStorage.getRadarState();
  let offerFilter = "";

  const activeProject = document.querySelector("#activeProject");
  const updatedAt = document.querySelector("#updatedAt");
  const syncStatus = document.querySelector("#syncStatus");
  const scanTitle = document.querySelector("#scanTitle");
  const scanMeta = document.querySelector("#scanMeta");
  const scanList = document.querySelector("#scanList");
  const saveScan = document.querySelector("#saveScan");
  const softGate = document.querySelector("#softGate");
  const offerSelect = document.querySelector("#offerFilter");
  const competitorsPanel = document.querySelector("#competitorsPanel");
  const keywordsPanel = document.querySelector("#keywordsPanel");

  render();

  document.querySelector("#refreshState").addEventListener("click", async () => {
    state = await globalThis.CompetitorRadarStorage.getRadarState();
    render();
  });

  activeProject.addEventListener("change", async () => {
    state = await globalThis.CompetitorRadarStorage.setRadarState({
      ...state,
      activeProject: activeProject.value.trim() || "Ремонт квартир Москва",
      remoteProjectId: null,
      syncStatus: state.apiEnabled ? "Проект изменен, переподключите backend" : state.syncStatus
    });
    render();
  });

  saveScan.addEventListener("click", async () => {
    const scan = state.latestScan;
    if (!scan || !scan.items || !scan.items.length) return;

    if (scan.type === "keywords") {
      state = await globalThis.CompetitorRadarStorage.saveKeywords(scan.items);
      await globalThis.CompetitorRadarStorage.trackEvent("extension_sidepanel_keywords_saved", {
        query: scan.query || "",
        count: scan.items.length
      });
    } else {
      state = await globalThis.CompetitorRadarStorage.saveCompetitors(scan.items);
      await globalThis.CompetitorRadarStorage.trackEvent("extension_sidepanel_competitors_saved", {
        query: scan.query || "",
        count: scan.items.length
      });
    }

    render();
  });

  document.querySelector("#openDozhim").addEventListener("click", async () => {
    await globalThis.CompetitorRadarStorage.trackEvent("extension_sidepanel_open_dozhim_clicked", {
      competitors: getCompetitors().length
    });
    await globalThis.CompetitorRadarStorage.openDozhim("/login");
  });

  document.querySelector("#fullAudit").addEventListener("click", async () => {
    await globalThis.CompetitorRadarStorage.trackEvent("extension_sidepanel_full_audit_clicked", {
      competitors: getCompetitors().length
    });
    await globalThis.CompetitorRadarStorage.openDozhim("/lead-magnet");
  });

  offerSelect.addEventListener("change", () => {
    offerFilter = offerSelect.value;
    renderSaved();
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`#${button.dataset.tab}Panel`).classList.add("active");
    });
  });

  document.querySelector("#exportReport").addEventListener("click", () => {
    const project = getProject();
    const html = buildReportHtml({
      activeProject: project,
      competitors: getCompetitors().filter(matchesOffer),
      keywords: getKeywords()
    });
    const url = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    chrome.downloads.download({
      url,
      filename: `radar-report-${slugify(project)}.html`
    });
  });

  document.querySelector("#openPopupHint").addEventListener("click", () => {
    alert("JSON-экспорт пока доступен в popup по иконке расширения. Основной сценарий работает через правую панель на странице.");
  });

  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== "local" || !changes.competitorRadarState) return;
    state = await globalThis.CompetitorRadarStorage.getRadarState();
    render();
  });

  function render() {
    activeProject.value = getProject();
    syncStatus.textContent = state.syncStatus || "Локальный режим";
    updatedAt.textContent = state.updatedAt
      ? `Обновлено: ${new Date(state.updatedAt).toLocaleString("ru-RU")}`
      : "Данных пока нет";
    renderScan();
    renderOfferFilter();
    renderSaved();
  }

  function renderScan() {
    const scan = state.latestScan;
    if (!scan || !scan.items || !scan.items.length) {
      scanTitle.textContent = "Текущая проверка";
      scanMeta.textContent = "Откройте Яндекс или Wordstat и нажмите кнопку радара.";
      scanList.innerHTML = `<p class="empty">Здесь появятся найденные конкуренты или ключи.</p>`;
      saveScan.disabled = true;
      softGate.hidden = true;
      return;
    }

    saveScan.disabled = false;
    scanTitle.textContent = scan.title || "Текущая проверка";
    scanMeta.textContent = `${scan.items.length} найдено${scan.query ? ` · ${scan.query}` : ""}`;
    scanList.innerHTML = `${renderScanSummary(scan)}${scan.items.slice(0, 8).map((item) => renderItem(item, scan.type)).join("")}`;
    softGate.hidden = getCompetitors().length + (scan.type === "competitors" ? scan.items.length : 0) < 3;
  }

  function renderSaved() {
    const competitors = getCompetitors().filter(matchesOffer);
    const keywords = getKeywords();

    competitorsPanel.innerHTML = competitors.length
      ? competitors.slice().reverse().slice(0, 40).map((item) => renderItem(item, "competitors")).join("")
      : `<p class="empty">Сохраненных конкурентов по проекту пока нет.</p>`;

    keywordsPanel.innerHTML = keywords.length
      ? keywords.slice().reverse().slice(0, 60).map((item) => renderItem(item, "keywords")).join("")
      : `<p class="empty">Сохраненных ключей по проекту пока нет.</p>`;
  }

  function renderOfferFilter() {
    const current = offerFilter;
    const offers = Array.from(new Set(getCompetitors().flatMap((item) => item.detectedOffers || []))).sort();
    offerSelect.innerHTML = [
      `<option value="">Все офферы</option>`,
      ...offers.map((offer) => `<option value="${escapeHtml(offer)}">${escapeHtml(offer)}</option>`)
    ].join("");
    offerSelect.value = offers.includes(current) ? current : "";
    offerFilter = offerSelect.value;
  }

  function renderItem(item, type) {
    if (type === "keywords") {
      return `
        <article class="item">
          <strong>${escapeHtml(item.phrase || "Без фразы")}</strong>
          <div class="domain">Частотность: ${escapeHtml(item.frequency || "не распознана")}</div>
          <p class="meta">${escapeHtml(item.adGroupHint || intentLabel(item.intent))}</p>
          <div class="tags">
            <span class="tag">${escapeHtml(intentLabel(item.intent))}</span>
            ${(item.signals || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
        </article>
      `;
    }

    return `
      <article class="item">
        <strong>${escapeHtml(item.realHeadline || item.title || "Без заголовка")}</strong>
        <span class="tag">${escapeHtml(item.adLabel || item.sourceType || "Промо")}</span>
        <div class="domain">${escapeHtml(item.domain || "Домен не распознан")}</div>
        <p>${escapeHtml(item.description || "")}</p>
        <p class="meta"><strong>Оффер:</strong> ${escapeHtml(item.primaryOffer || "не распознан")}</p>
        <p class="meta"><strong>Стратегия:</strong> ${escapeHtml(item.strategy || "mixed")} · <strong>CTA:</strong> ${escapeHtml(item.cta || "не выражен явно")}</p>
        ${item.insight ? `<p class="insight">${escapeHtml(item.insight)}</p>` : ""}
        ${item.hypothesis ? `<p class="hypothesis">${escapeHtml(item.hypothesis)}</p>` : ""}
        ${(item.weaknesses || []).length ? `<p class="meta">Слабые места: ${escapeHtml((item.weaknesses || []).join("; "))}</p>` : ""}
        ${(item.sitelinks || []).length ? `<p class="meta">Быстрые ссылки: ${(item.sitelinks || []).map((link) => escapeHtml(link.title || link)).join(" · ")}</p>` : ""}
        <div class="tags">${Array.from(new Set([...(item.detectedOffers || []), ...(item.triggers || [])])).slice(0, 10).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
      </article>
    `;
  }

  function renderScanSummary(scan) {
    if (!scan.items.length) return "";

    if (scan.type === "keywords") {
      const signals = scan.items.flatMap((item) => item.signals || []);
      const highPotential = signals.filter((item) => item === "высокий потенциал").length;
      const minus = signals.filter((item) => item === "минус-слово").length;
      const hints = Array.from(new Set(scan.items.map((item) => item.adGroupHint).filter(Boolean))).slice(0, 3);
      return `
        <div class="summary-box">
          <strong>Сводка Wordstat</strong>
          <p>Высокий потенциал: ${highPotential}. Минус-слова: ${minus}. ${hints.join(" ")}</p>
        </div>
      `;
    }

    const offers = scan.items.flatMap((item) => item.detectedOffers || []);
    const uniqueOffers = Array.from(new Set(offers)).slice(0, 6);
    const ideas = Array.from(new Set(scan.items.map((item) => item.hypothesis).filter(Boolean))).slice(0, 3);
    return `
      <div class="summary-box">
        <strong>Сводка по текущему запросу</strong>
        <p>Конкурентов: ${scan.items.length}. Офферы: ${uniqueOffers.join(", ") || "не распознаны"}. ${ideas.join(" ")}</p>
      </div>
    `;
  }

  function getProject() {
    return state.activeProject || "Ремонт квартир Москва";
  }

  function getCompetitors() {
    const project = getProject();
    return (state.competitors || []).filter((item) => (item.project || project) === project);
  }

  function getKeywords() {
    const project = getProject();
    return (state.keywords || []).filter((item) => (item.project || project) === project);
  }

  function matchesOffer(item) {
    if (!offerFilter) return true;
    return (item.detectedOffers || []).includes(offerFilter);
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
    <section class="grid">${hypotheses.length ? hypotheses.map((hypothesis) => `<article class="card"><strong>${escapeHtml(hypothesis)}</strong></article>`).join("") : "<p class='muted'>Пока мало данных для гипотез.</p>"}</section>
    <h2>Конкуренты</h2>
    <section class="grid">${competitors.slice().reverse().slice(0, 40).map((item) => `<article class="card"><strong>${escapeHtml(item.realHeadline || item.title || "Без заголовка")}</strong><span class="tag">${escapeHtml(item.adLabel || "Промо")}</span><p class="domain">${escapeHtml(item.domain || "")}</p><p class="muted"><strong>Стратегия:</strong> ${escapeHtml(item.strategy || "mixed")} · <strong>CTA:</strong> ${escapeHtml(item.cta || "не выражен явно")}</p><p>${escapeHtml(item.description || "")}</p><p class="muted">${escapeHtml(item.insight || "")}</p><p class="muted">${escapeHtml(item.hypothesis || "")}</p>${(item.detectedOffers || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</article>`).join("")}</section>
    <h2>Ключи Wordstat</h2>
    <section class="grid">${keywords.slice().reverse().slice(0, 40).map((item) => `<article class="card"><strong>${escapeHtml(item.phrase || "")}</strong><p class="green">Частотность: ${escapeHtml(item.frequency || "")}</p><p class="muted">${escapeHtml(intentLabel(item.intent))}</p></article>`).join("")}</section>
  </main>
</body>
</html>`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
