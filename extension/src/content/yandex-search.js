(function () {
  const MARKER = "data-cr-radar-processed";
  const query = new URLSearchParams(location.search).get("text") || "";
  const logoUrl = chrome.runtime.getURL("assets/dozhim-logo.png");

  function textOf(node) {
    return (node && node.textContent ? node.textContent : "").replace(/\s+/g, " ").trim();
  }

  function getDomainFromUrl(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  function normalizeDomain(value) {
    const match = String(value || "")
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .match(/[a-zа-я0-9][a-zа-я0-9.-]*\.(ru|рф|com|net|org|su|io|app|pro|moscow)/i);

    return match ? match[0].toLowerCase() : "";
  }

  function normalizeDomains(value) {
    return Array.from(String(value || "").matchAll(/[a-zа-я0-9][a-zа-я0-9.-]*\.(ru|рф|com|net|org|su|io|app|pro|moscow)/gi))
      .map((match) => match[0].replace(/^www\./, "").toLowerCase())
      .filter((domain, index, array) => array.indexOf(domain) === index);
  }

  function getDomain(card) {
    const link = getMainAdLink(card) || card.querySelector("a[href^='http']");
    const url = link ? link.href : "";
    const visible = textOf(card.querySelector("[class*='Path'], [class*='Organic-Path'], cite"));
    const visibleFromPath = normalizeDomain(visible);
    const visibleDomains = normalizeDomains(textOf(card)).filter(isAdvertiserDomain);
    const visibleFromCard = visibleDomains[0] || "";
    const hrefDomain = getDomainFromUrl(url);

    if (visibleFromPath) return visibleFromPath;
    if (visibleFromCard) return visibleFromCard;
    if (isAdvertiserDomain(hrefDomain)) return hrefDomain;
    return "";
  }

  function getMainAdLink(card) {
    const links = Array.from(card.querySelectorAll("a[href^='http']"));
    const domain = normalizeDomain(textOf(card));
    const scored = links.map((link) => {
      const text = cleanTitle(textOf(link));
      const rect = link.getBoundingClientRect();
      let score = 0;
      if (isLikelyTitle(text)) score += 45;
      if (rect.width > 120 && rect.height > 12) score += 15;
      if (!normalizeDomain(text)) score += 10;
      if (domain && text.includes(domain)) score -= 30;
      if (/контактная информация|показать|отзывы|цены|акции|портфолио/i.test(text)) score -= 20;
      if (getDomainFromUrl(link.href) && isAdvertiserDomain(getDomainFromUrl(link.href))) score += 10;
      return { link, score };
    }).sort((a, b) => b.score - a.score);

    return scored[0] && scored[0].score >= 35 ? scored[0].link : links[0] || null;
  }

  function isAdvertiserDomain(domain) {
    return Boolean(domain)
      && !/(^|\.)yandex\.(ru|com)$/.test(domain)
      && !/^(ya\.ru|yabs\.yandex\.ru)$/.test(domain);
  }

  function getTitle(card) {
    const titleNode = card.querySelector("h2 a[href^='http'], h3 a[href^='http'], [role='heading'] a[href^='http'], a[class*='Title'], a[class*='title']");
    const headingTitle = textOf(titleNode);
    if (isLikelyTitle(headingTitle)) return headingTitle;

    const links = Array.from(card.querySelectorAll("a"))
      .map(textOf)
      .map(cleanTitle)
      .filter(isLikelyTitle);

    const fromLink = links[0] || "";
    if (fromLink) return fromLink;

    const fromText = getTitleFromText(card);
    if (fromText) return fromText;

    return getTitleFromBreadcrumbText(card);
  }

  function getDisplayUrl(card) {
    const pathNode = card.querySelector("[class*='Path'], [class*='Organic-Path'], cite, [class*='Breadcrumb']");
    const pathText = textOf(pathNode);
    if (pathText && normalizeDomain(pathText)) return pathText;

    const domain = getDomain(card);
    const pathCandidate = Array.from(card.querySelectorAll("span, div"))
      .map(textOf)
      .find((value) => value.includes("›") && (!domain || value.includes(domain)));

    return pathCandidate || domain || "";
  }

  function getTitleFromBreadcrumbText(card) {
    const text = textOf(card);
    const domain = getDomain(card);
    if (!domain || !text.includes("›")) return "";

    const afterDomain = text.split(domain).slice(1).join(domain);
    const parts = afterDomain
      .split("›")
      .map(cleanTitle)
      .filter((part) => part && !part.includes(domain))
      .filter(isLikelyTitle);

    return parts[0] || "";
  }

  function cleanTitle(value) {
    const normalized = String(value || "")
      .replace(/^›+/, "")
      .replace(/^(Промо|Реклама)\s*/i, "")
      .replace(/^(Поиск|Алиса AI|Услуги|Картинки|Видео|Карты|Товары|Финансы|Квартиры|Переводчик|Все)\s*/i, "")
      .trim();

    if (normalized.includes("›")) {
      const parts = normalized.split("›").map((part) => part.trim()).filter(Boolean);
      return parts[parts.length - 1] || normalized;
    }

    return normalized;
  }

  function getTitleFromText(card) {
    const domain = getDomain(card);
    const lines = textOf(card)
      .split(/(?=Промо)|·|\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const candidates = lines
      .flatMap((line) => line.split(/\s{2,}/).map((part) => part.trim()))
      .filter((line) => line && line !== domain)
      .filter((line) => !line.includes(domain))
      .filter((line) => !/^промо$/i.test(line))
      .map(cleanTitle)
      .filter((line) => !normalizeDomain(line))
      .filter(isLikelyTitle);

    return candidates[0] || "";
  }

  function isLikelyTitle(value) {
    const text = String(value || "").trim();
    if (text.length < 6 || text.length > 160) return false;
    if (/^(промо|реклама|контактная информация|показать|сведения|ещё|еще)$/i.test(text)) return false;
    if (/^[+()\-\d\s]+$/.test(text)) return false;
    if (normalizeDomain(text) === text.toLowerCase()) return false;
    return /[а-яa-z]/i.test(text);
  }

  function getDescription(card) {
    const title = getTitle(card);
    const domain = getDomain(card);
    const sitelinks = new Set(getSitelinks(card).map((item) => item.title || item));
    const nodes = Array.from(card.querySelectorAll("span, div, p"))
      .map(textOf)
      .map((value) => cleanDescription(value, domain, title))
      .filter((value) => !sitelinks.has(value))
      .filter((value) => !/^промо$/i.test(value))
      .filter((value) => !normalizeDomain(value))
      .filter((value) => value.length > 35 && value.length < 280);

    return nodes.find((value) => value !== title) || "";
  }

  function cleanDescription(value, domain, title) {
    return String(value || "")
      .replace(domain || "", "")
      .replace(title || "", "")
      .replace(/^[›\s]+/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getSitelinks(card) {
    const title = getTitle(card);
    const domain = getDomain(card);
    return Array.from(card.querySelectorAll("a"))
      .map((link) => ({
        title: cleanTitle(textOf(link)),
        url: link.href || "",
        domain: getDomainFromUrl(link.href)
      }))
      .filter((item) => item.title.length > 2 && item.title.length < 64)
      .filter((item) => item.title !== title && item.title !== domain)
      .filter((item) => !/^промо$/i.test(item.title))
      .filter((item) => !normalizeDomain(item.title))
      .filter((item, index, array) => array.findIndex((next) => next.title === item.title) === index)
      .map((item) => ({
        ...item,
        signals: detectSignalGroups(item.title).allSignals
      }))
      .slice(0, 6);
  }

  function hasPromoLabel(card) {
    return /(^|\s|·)промо(\s|·|$)/i.test(textOf(card));
  }

  function findPromoLabelNodes() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];

    document
      .querySelectorAll("#search-result span.AdvLabel-Text, span.AdvLabel-Text, .AdvLabel-Text")
      .forEach((node) => {
        if (/^промо$/i.test(textOf(node))) nodes.push(node);
      });

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (/(^|\s|·)промо(\s|·|$)/i.test(node.nodeValue || "")) {
        nodes.push(node.parentElement);
      }
    }

    return nodes
      .filter(Boolean)
      .filter((node, index, array) => array.indexOf(node) === index);
  }

  function looksLikeAd(card) {
    const title = getTitle(card).toLowerCase();
    const hasExternalLink = Boolean(card.querySelector("a[href^='http']"));
    const isServiceBlock = /^(телефон|контактная информация|адрес|режим работы)$/.test(title);
    const isTooGeneric = !title || title.length < 4 || title.length > 140;
    const isMapOrCatalog = /специалисты|организации|похожие места|карта|рядом со мной/.test(title);
    const hasDomain = Boolean(getDomain(card));

    return hasPromoLabel(card) && hasDomain && !isServiceBlock && !isTooGeneric && !isMapOrCatalog && (hasExternalLink || textOf(card).length > 80);
  }

  function detectOffers(text) {
    return detectSignalGroups(text).detectedOffers;
  }

  function detectSignalGroups(text) {
    const rules = [
      ["скидка", /скидк|%|акци/i],
      ["рассрочка", /рассроч|кредит|ипотек|транш/i],
      ["гарантия", /гарант/i],
      ["бесплатный замер/консультация", /бесплат\w*\s+(замер|консультац|аудит|расч[её]т)|замер\s+0|консультац\w*\s+бесплат|0 ?₽/i],
      ["калькулятор", /калькулятор|смета|рассчит|расч[её]т|узнай/i],
      ["квиз", /квиз|тест|опрос|подбор/i],
      ["цена", /цена|стоимость|от \d|₽|руб|прайс/i],
      ["срочность", /сегодня|за \d+ (дн|дня|дней|час|часа|часов)|срочн|быстр|до конца/i],
      ["гео", /москв|санкт|спб|район|рядом|выезд|област|в мо|по москве|у метро/i],
      ["опыт", /лет|опыт|с \d{4}/i]
    ];

    const signalRules = {
      offerSignals: [
        ["скидка", /скидк|%|акци/i],
        ["рассрочка", /рассроч|кредит|ипотек|транш/i],
        ["комплектация/под ключ", /под ключ|комплектац|готов\w* решени/i],
        ["широкий выбор", /каталог|выбор|ассортимент|более \d+/i],
        ["экспертность", /эксперт|сертифиц|профессионал|авторск|премиум/i]
      ],
      priceSignals: [
        ["цена", /цена|стоимость|прайс/i],
        ["конкретная цена", /от\s*\d|₽|руб|\d+\s*(₽|руб|р\/м|\/м2)/i],
        ["расчет/смета", /смета|рассчит|расч[её]т|калькулятор/i]
      ],
      urgencySignals: [
        ["срочность", /сегодня|срочн|быстр|до конца|успей/i],
        ["срок", /за \d+ (дн|дня|дней|час|часа|часов|мес)/i]
      ],
      guaranteeSignals: [
        ["гарантия", /гарант/i],
        ["договор", /договор|официальн|фиксируем|без доплат/i],
        ["без риска", /без риска|возврат|без аванс/i]
      ],
      leadMagnetSignals: [
        ["бесплатный замер/консультация", /бесплат\w*\s+(замер|консультац|аудит|расч[её]т)|замер\s+0|консультац\w*\s+бесплат|0 ?₽/i],
        ["калькулятор", /калькулятор|смета|рассчит|расч[её]т|узнай/i],
        ["квиз", /квиз|тест|опрос|подбор/i],
        ["каталог/презентация", /каталог|скачать|презентац|прайс/i]
      ],
      ctaSignals: [
        ["оставить заявку", /остав(ить|ьте)\s+заявк|заявк/i],
        ["позвонить", /звон|позвон|телефон/i],
        ["рассчитать", /рассчит|расч[её]т|узнай/i],
        ["получить", /получ|заказать|оформить/i],
        ["скачать", /скачать|получить каталог/i]
      ],
      geoSignals: [
        ["гео", /москв|санкт|спб|район|рядом|выезд|област|в мо|по москве|у метро/i]
      ],
      trustSignals: [
        ["опыт", /лет|опыт|с \d{4}/i],
        ["отзывы", /отзыв|рейтинг|\d,\d/i],
        ["кейсы", /кейс|портфолио|пример|объект|проект/i],
        ["бренд/награды", /№\s*1|топ|преми|сертифиц|лидер/i]
      ]
    };

    const groups = Object.fromEntries(Object.entries(signalRules).map(([group, items]) => [
      group,
      items.filter(([, pattern]) => pattern.test(text)).map(([label]) => label)
    ]));
    const detectedOffers = rules.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);

    return {
      ...groups,
      detectedOffers,
      allSignals: Array.from(new Set([...detectedOffers, ...Object.values(groups).flat()]))
    };
  }

  function analyzeSitelinks(sitelinks) {
    return (sitelinks || []).map((link) => {
      const title = link.title || link;
      const signals = detectSignalGroups(title);
      return {
        ...(typeof link === "string" ? { title, url: "" } : link),
        signals: signals.allSignals,
        role: classifySitelink(title, signals)
      };
    });
  }

  function classifySitelink(title, signals) {
    const text = String(title || "").toLowerCase();
    if (signals.priceSignals.length) return "price";
    if (signals.leadMagnetSignals.length) return "lead_magnet";
    if (signals.trustSignals.length) return "trust";
    if (/контакт|адрес|телефон|офис/i.test(text)) return "contact";
    if (/услуг|каталог|товар|проект/i.test(text)) return "assortment";
    return "navigation";
  }

  function deriveAdIntelligence({ title, description, sitelinks, signals }) {
    const all = new Set([
      ...signals.offerSignals,
      ...signals.priceSignals,
      ...signals.urgencySignals,
      ...signals.guaranteeSignals,
      ...signals.leadMagnetSignals,
      ...signals.ctaSignals,
      ...signals.geoSignals,
      ...signals.trustSignals,
      ...sitelinks.flatMap((link) => link.signals || [])
    ]);
    const has = (value) => all.has(value);
    const cta = signals.ctaSignals[0]
      || sitelinks.find((link) => (link.signals || []).some((signal) => ["рассчитать", "получить", "скачать"].includes(signal)))?.signals?.[0]
      || "не выражен явно";
    const strategy = classifyStrategy(all);
    const triggers = Array.from(all).slice(0, 8);
    const missingTriggers = [
      !has("конкретная цена") && "конкретная цена",
      !has("гарантия") && "гарантия",
      !has("бесплатный замер/консультация") && "мягкий вход",
      !has("срочность") && "срочность",
      !has("отзывы") && !has("кейсы") && "доказательства"
    ].filter(Boolean);
    const primaryOffer = buildPrimaryOffer({ title, description, signals, sitelinks });
    const usp = buildUsp(strategy, triggers);
    const strengths = buildStrengths(signals, sitelinks);
    const weaknesses = buildWeaknesses(missingTriggers, cta);
    const differentiationPoint = buildDifferentiationPoint(missingTriggers, strategy);
    const hypothesis = buildDetailedHypothesis(missingTriggers, strategy);

    return {
      primaryOffer,
      usp,
      cta,
      strategy,
      triggers,
      strengths,
      weaknesses,
      missingTriggers,
      differentiationPoint,
      hypothesis,
      insight: `Стратегия конкурента: ${strategy}. Сильная сторона: ${strengths[0] || "оффер распознан частично"}. Точка отстройки: ${differentiationPoint}`
    };
  }

  function classifyStrategy(signals) {
    const has = (value) => signals.has(value);
    if (has("конкретная цена") || has("цена") || has("расчет/смета")) return "price-led";
    if (has("гарантия") || has("договор") || has("без риска")) return "trust-led";
    if (has("срочность") || has("срок")) return "urgency-led";
    if (has("бесплатный замер/консультация") || has("квиз") || has("калькулятор")) return "lead-magnet-led";
    if (has("широкий выбор") || has("каталог/презентация")) return "assortment-led";
    if (has("гео")) return "geo-led";
    if (has("экспертность") || has("опыт") || has("бренд/награды")) return "expertise-led";
    return "mixed";
  }

  function buildPrimaryOffer({ title, description, signals, sitelinks }) {
    const fragments = [
      title,
      signals.priceSignals[0],
      signals.guaranteeSignals[0],
      signals.leadMagnetSignals[0],
      sitelinks.find((link) => link.role === "lead_magnet")?.title
    ].filter(Boolean);
    if (fragments.length > 1) return fragments.slice(0, 3).join(" + ");
    return description ? description.slice(0, 120) : title || "Оффер не распознан";
  }

  function buildUsp(strategy, triggers) {
    const map = {
      "price-led": "акцент на цене или понятном расчете",
      "trust-led": "снижение риска через гарантию/договор",
      "urgency-led": "быстрое решение или ограничение по сроку",
      "lead-magnet-led": "мягкий вход через бесплатное действие",
      "assortment-led": "широкий выбор или каталог",
      "geo-led": "локальность и близость к клиенту",
      "expertise-led": "экспертность, опыт или статус"
    };
    return map[strategy] || (triggers.length ? `смешанный оффер: ${triggers.slice(0, 3).join(", ")}` : "УТП выражено слабо");
  }

  function buildStrengths(signals, sitelinks) {
    return [
      signals.priceSignals.length && "есть цена/расчет стоимости",
      signals.guaranteeSignals.length && "снижает риск гарантией или договором",
      signals.leadMagnetSignals.length && "есть мягкий вход для заявки",
      signals.ctaSignals.length && "есть понятный призыв к действию",
      sitelinks.length >= 3 && "быстрые ссылки расширяют оффер"
    ].filter(Boolean);
  }

  function buildWeaknesses(missingTriggers, cta) {
    const items = missingTriggers.map((item) => `нет сигнала: ${item}`);
    if (cta === "не выражен явно") items.unshift("CTA не выражен явно");
    return items.slice(0, 4);
  }

  function buildDifferentiationPoint(missingTriggers, strategy) {
    if (missingTriggers.includes("конкретная цена")) return "вынести конкретную цену, диапазон или расчет в первый экран объявления";
    if (missingTriggers.includes("гарантия")) return "добавить гарантию результата, срока или цены";
    if (missingTriggers.includes("мягкий вход")) return "дать бесплатный расчет, консультацию или аудит как первый шаг";
    if (missingTriggers.includes("доказательства")) return "усилить объявление кейсом, отзывом, объектом или цифрой";
    if (strategy === "price-led") return "отстроиться не ценой, а гарантией и доказательствами";
    return "сформулировать более конкретное обещание в headline";
  }

  function buildDetailedHypothesis(missingTriggers, strategy) {
    if (missingTriggers.includes("конкретная цена")) return "Тест: вынести конкретную цену или диапазон в заголовок и добавить расчет в быструю ссылку.";
    if (missingTriggers.includes("гарантия")) return "Тест: добавить гарантию результата, срока или фиксированной сметы отдельным крючком.";
    if (missingTriggers.includes("мягкий вход")) return "Тест: предложить бесплатный расчет, консультацию или аудит как мягкий вход.";
    if (missingTriggers.includes("срочность")) return "Тест: добавить быстрый старт, срок выполнения или ограничение акции.";
    if (strategy === "price-led") return "Тест: конкурировать не скидкой, а прозрачной сметой, гарантией и кейсом.";
    return "Тест: добавить конкретное УТП и быстрые ссылки под цену, отзывы и расчет.";
  }

  function findAdCards() {
    const unique = [];
    const seen = new Set();

    findPromoLabelNodes().forEach((promoNode) => {
      const card = findPromoCard(promoNode);
      const layoutItem = card ? null : parsePromoByLayout(promoNode);
      const domain = card ? getDomain(card) : layoutItem && layoutItem.domain;
      const title = card ? getTitle(card) : layoutItem && layoutItem.title;
      if (!domain || !title) return;

      const key = `${domain}|${title}`;
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(card || layoutItem);
    });

    return unique.slice(0, 12);
  }

  function parsePromoByLayout(promoNode) {
    const promoRect = promoNode.getBoundingClientRect();
    const nearbyLinks = Array.from(document.querySelectorAll("a"))
      .map((link) => ({
        link,
        text: textOf(link),
        hrefDomain: getDomainFromUrl(link.href),
        rect: link.getBoundingClientRect()
      }))
      .filter((item) => item.rect.width > 20 && item.rect.height > 8)
      .filter((item) => Math.abs(item.rect.left - promoRect.left) < 120 || overlapsX(item.rect, promoRect))
      .filter((item) => item.rect.top > promoRect.top - 180 && item.rect.top < promoRect.top + 220);

    const titleLink = nearbyLinks
      .filter((item) => isLikelyTitle(item.text))
      .sort((a, b) => distanceToPromo(a.rect, promoRect) - distanceToPromo(b.rect, promoRect))[0];

    if (!titleLink) return null;

    const title = cleanTitle(titleLink.text);
    const domain = findLayoutDomain(nearbyLinks, titleLink);
    const displayUrl = domain;
    const description = cleanDescription(collectLayoutDescription(promoRect, title, domain), domain, title);
    const sitelinks = analyzeSitelinks(nearbyLinks
      .map((item) => ({ title: cleanTitle(item.text), url: item.link.href || "", domain: item.hrefDomain }))
      .filter((item) => item.title !== title)
      .filter((item) => isLikelyTitle(item.title))
      .slice(0, 6));
    const fullText = `${title} ${domain} ${description} ${sitelinks.map((item) => item.title).join(" ")}`;
    const signalGroups = detectSignalGroups(fullText);
    const detectedOffers = detectOffers(fullText);
    const intelligence = deriveAdIntelligence({
      title,
      description,
      sitelinks,
      signals: signalGroups
    });

    return {
      __radarLayoutItem: true,
      source: "yandex_search",
      sourceType: "yandex_direct_promo",
      adLabel: "Промо",
      isPromo: true,
      query,
      domain,
      displayUrl,
      realHeadline: title,
      title,
      description,
      position: 0,
      qualityScore: calculateQualityScore({
        domain,
        title,
        description,
        detectedOffers
      }),
      sitelinks,
      detectedOffers,
      offerSignals: signalGroups.offerSignals,
      priceSignals: signalGroups.priceSignals,
      urgencySignals: signalGroups.urgencySignals,
      guaranteeSignals: signalGroups.guaranteeSignals,
      leadMagnetSignals: signalGroups.leadMagnetSignals,
      ctaSignals: signalGroups.ctaSignals,
      strategy: intelligence.strategy,
      primaryOffer: intelligence.primaryOffer,
      usp: intelligence.usp,
      cta: intelligence.cta,
      triggers: intelligence.triggers,
      strengths: intelligence.strengths,
      weaknesses: intelligence.weaknesses,
      missingTriggers: intelligence.missingTriggers,
      differentiationPoint: intelligence.differentiationPoint,
      insight: intelligence.insight,
      hypothesis: intelligence.hypothesis,
      capturedAt: new Date().toISOString()
    };
  }

  function overlapsX(a, b) {
    return Math.max(a.left, b.left) <= Math.min(a.right, b.right);
  }

  function distanceToPromo(rect, promoRect) {
    return Math.abs(rect.top - promoRect.top) + Math.abs(rect.left - promoRect.left);
  }

  function findLayoutDomain(links, titleLink) {
    const domains = links
      .flatMap((item) => normalizeDomains(`${item.text} ${item.hrefDomain}`))
      .filter(isAdvertiserDomain);

    if (domains.length) return domains[0];
    if (isAdvertiserDomain(titleLink.hrefDomain)) return titleLink.hrefDomain;
    return "";
  }

  function collectLayoutDescription(promoRect, title, domain) {
    const elements = Array.from(document.querySelectorAll("span, div, p"))
      .map((node) => ({
        node,
        rect: node.getBoundingClientRect(),
        text: textOf(node)
      }))
      .filter((item) => item.text.length > 20 && item.text.length < 320)
      .filter((item) => item.rect.top >= promoRect.top - 20 && item.rect.top < promoRect.top + 190)
      .filter((item) => Math.abs(item.rect.left - promoRect.left) < 160 || overlapsX(item.rect, promoRect))
      .map((item) => item.text)
      .filter((text) => text !== title && text !== domain)
      .filter((text, index, array) => array.indexOf(text) === index);

    return elements.find((text) => /промо|купить|цена|скидк|ипотек|рассроч|квартир|заказать|гарант/i.test(text)) || elements[0] || "";
  }

  function getPromoDebugSnippets() {
    return findPromoLabelNodes().slice(0, 4).map((promoNode, index) => {
      const candidates = [];
      let node = promoNode;

      while (node && node !== document.body && candidates.length < 10) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const rect = node.getBoundingClientRect();
          candidates.push({
            level: candidates.length,
            tag: node.tagName.toLowerCase(),
            className: String(node.className || "").slice(0, 120),
            size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
            title: getTitle(node),
            domain: getDomain(node),
            links: Array.from(node.querySelectorAll("a")).slice(0, 4).map(textOf).filter(Boolean),
            text: textOf(node).slice(0, 320)
          });
        }
        node = node.parentElement;
      }

      return {
        index: index + 1,
        promoText: textOf(promoNode).slice(0, 120),
        candidates
      };
    });
  }

  function findPromoCard(startNode) {
    const explicitCard = findExplicitPromoCard(startNode);
    if (explicitCard) return explicitCard;

    let node = startNode;
    let best = null;

    while (node && node !== document.body) {
      if (node.nodeType === Node.ELEMENT_NODE && hasPromoLabel(node) && node.querySelector("a[href^='http']")) {
        const rect = node.getBoundingClientRect();
        const title = getTitle(node);
        const domain = getDomain(node);
        const score = scorePromoCandidate(node, rect, title, domain);
        if (!best || score > best.score) best = { node, score };
      }

      node = node.parentElement;
    }

    return best && best.score >= 45 ? best.node : null;
  }

  function findExplicitPromoCard(startNode) {
    const containers = [
      startNode.closest("#search-result > li"),
      startNode.closest("li"),
      startNode.closest("div.Organic-ContentWrapper"),
      startNode.closest("div.TextContainer"),
      startNode.closest("[class*='Organic']")
    ].filter(Boolean);

    const best = containers
      .map((node) => ({
        node,
        score: scorePromoCandidate(node, node.getBoundingClientRect(), getTitle(node), getDomain(node))
      }))
      .filter((item) => hasPromoLabel(item.node))
      .filter((item) => getDomain(item.node) && getTitle(item.node))
      .sort((a, b) => b.score - a.score)[0];

    return best && best.score >= 35 ? best.node : null;
  }

  function scorePromoCandidate(node, rect, title, domain) {
    let score = 0;
    if (rect.width >= 280) score += 10;
    if (rect.height >= 80 && rect.height <= 520) score += 20;
    if (title) score += 25;
    if (domain) score += 25;
    if (node.querySelectorAll("a").length >= 1) score += 10;
    if (hasPromoLabel(node)) score += 10;
    if (textOf(node).length > 80) score += 10;
    if (node.children.length <= 60) score += 10;
    if (rect.height > 650 || node.children.length > 100) score -= 40;
    return score;
  }

  function parseCards() {
    return findAdCards().map((card, index) => {
      if (card.__radarLayoutItem) {
        return {
          ...card,
          position: index + 1
        };
      }

      const title = getTitle(card);
      const description = getDescription(card);
      const domain = getDomain(card);
      const displayUrl = getDisplayUrl(card);
      const sitelinks = analyzeSitelinks(getSitelinks(card));
      const fullText = `${title} ${description} ${textOf(card)} ${sitelinks.map((item) => item.title).join(" ")}`;
      const signalGroups = detectSignalGroups(fullText);
      const detectedOffers = detectOffers(fullText);
      const intelligence = deriveAdIntelligence({
        title,
        description,
        sitelinks,
        signals: signalGroups
      });

      return {
      source: "yandex_search",
      sourceType: "yandex_direct_promo",
      adLabel: "Промо",
      isPromo: true,
      query,
        domain,
        displayUrl,
        realHeadline: title,
        title,
        description,
        position: index + 1,
        qualityScore: calculateQualityScore({ domain, title, description, detectedOffers }),
        sitelinks,
        detectedOffers,
        offerSignals: signalGroups.offerSignals,
        priceSignals: signalGroups.priceSignals,
        urgencySignals: signalGroups.urgencySignals,
        guaranteeSignals: signalGroups.guaranteeSignals,
        leadMagnetSignals: signalGroups.leadMagnetSignals,
        ctaSignals: signalGroups.ctaSignals,
        strategy: intelligence.strategy,
        primaryOffer: intelligence.primaryOffer,
        usp: intelligence.usp,
        cta: intelligence.cta,
        triggers: intelligence.triggers,
        strengths: intelligence.strengths,
        weaknesses: intelligence.weaknesses,
        missingTriggers: intelligence.missingTriggers,
        differentiationPoint: intelligence.differentiationPoint,
        insight: intelligence.insight,
        hypothesis: intelligence.hypothesis,
        capturedAt: new Date().toISOString()
      };
    });
  }

  function calculateQualityScore(item) {
    let score = 30;
    if (item.domain) score += 15;
    if (item.title && item.title.length > 12) score += 15;
    if (item.description && item.description.length > 45) score += 20;
    score += Math.min((item.detectedOffers || []).length * 8, 20);
    return Math.min(score, 100);
  }

  function buildInsight(offers) {
    if (!offers.length) {
      return "Оффер выражен слабо: стоит проверить цену, гарантию, срочность или конкретный подарок.";
    }

    const primary = offers.slice(0, 3).join(", ");
    const missing = ["цена", "гарантия", "бесплатный замер/консультация", "рассрочка"].filter((item) => !offers.includes(item));
    const gap = missing.length ? ` Возможная точка отличия: ${missing[0]}.` : " Оффер плотный, лучше искать отличие в посадочной странице.";
    return `На что давит конкурент: ${primary}.${gap}`;
  }

  function buildHypothesis(offers) {
    if (!offers.includes("цена")) return "Что протестировать в своей рекламе: вынести конкретную цену или диапазон в заголовок/первую строку.";
    if (!offers.includes("гарантия")) return "Тест: добавить гарантию результата или срока отдельным крючком.";
    if (!offers.includes("бесплатный замер/консультация")) return "Тест: предложить бесплатный замер, расчет или аудит как мягкий вход.";
    if (!offers.includes("срочность")) return "Тест: добавить ограничение по сроку или быстрый старт работ.";
    return "Тест: отличаться не оффером, а доказательствами: кейсы, объекты, прозрачная смета.";
  }

  function summarizeOffers(items) {
    const counts = items
      .flatMap((item) => item.detectedOffers || [])
      .reduce((acc, offer) => {
        acc[offer] = (acc[offer] || 0) + 1;
        return acc;
      }, {});

    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }

  function buildAdIdeas(items) {
    const offers = new Set(items.flatMap((item) => item.detectedOffers || []));
    const ideas = [
      !offers.has("цена") && "Вынести цену, диапазон или минимальный чек в первый заголовок.",
      !offers.has("гарантия") && "Сформулировать гарантию результата, срока или возврата отдельным крючком.",
      !offers.has("бесплатный замер/консультация") && "Дать мягкий вход: бесплатный замер, консультация или экспресс-аудит.",
      offers.has("рассрочка") && "Проверить отдельную группу объявлений под рассрочку/ипотеку/траншевую оплату.",
      "Собрать 2-3 доказательства: кейс, срок, объект, фото или прозрачную смету."
    ].filter(Boolean);

    return ideas.slice(0, 5);
  }

  function renderSummary(items, state) {
    if (!items.length) return "";
    const topOffers = summarizeOffers(items);
    const ideas = buildAdIdeas(items);
    const savedCount = (state.competitors || []).length;

    return `
      <section class="cr-radar-summary">
        <strong>Сводка по текущему запросу</strong>
        <p class="cr-radar-muted">Сохранено в браузере: ${savedCount}. Топ-офферы: ${topOffers.length ? topOffers.map(([name, count]) => `${escapeHtml(name)} (${count})`).join(", ") : "пока нет"}.</p>
        <div class="cr-radar-ideas">
          ${ideas.map((idea) => `<span>${escapeHtml(idea)}</span>`).join("")}
        </div>
      </section>
    `;
  }

  function renderSoftGate(state, items) {
    const savedCount = (state.competitors || []).length;
    if (savedCount + items.length < 3) return "";

    return `
      <section class="cr-radar-softgate">
        <strong>Хотите полный отчет по конкурентам?</strong>
        <p>Переходите в ДОЖИМ-АЙ: соберем AI-аудит, сравним офферы и покажем, что тестировать в Директе.</p>
        <div class="cr-radar-inline">
          <button class="cr-radar-button" data-cr-full-audit>Получить полный AI-аудит</button>
          <button class="cr-radar-button secondary" data-cr-create-campaign>Создать рекламную кампанию с AI</button>
        </div>
      </section>
    `;
  }

  function renderSummaryButton(state) {
    const count = (state.competitors || []).length;
    return `
      <button class="cr-radar-button cr-radar-summary-open" data-cr-open-summary type="button">
        Открыть сводку
        ${count ? `<span class="cr-radar-badge">${count}</span>` : ""}
      </button>
    `;
  }

  async function openSummaryFallback(items) {
    chrome.runtime.sendMessage({ type: "CR_OPEN_POPUP" }, async (response) => {
      if (response && response.ok) return;
      if (items && items.length) {
        renderPanel(items);
        return;
      }
      const state = await globalThis.CompetitorRadarStorage.getRadarState();
      const latestItems = state.latestScan && state.latestScan.type === "competitors" ? state.latestScan.items : [];
      const fallbackItems = latestItems && latestItems.length ? latestItems : (state.competitors || []).slice(-12).reverse();
      renderPanel(fallbackItems);
    });
  }

  async function renderPanel(items) {
    const previous = document.querySelector(".cr-radar-panel");
    if (previous) previous.remove();
    const state = await globalThis.CompetitorRadarStorage.getRadarState();
    const promoLabelsCount = findPromoLabelNodes().length;
    const debugSnippets = !items.length && promoLabelsCount ? getPromoDebugSnippets() : [];

    const panel = document.createElement("aside");
    panel.className = "cr-radar-panel";
    panel.innerHTML = `
      <div class="cr-radar-header">
        <h3>
          <span class="cr-radar-brand">
            <img class="cr-radar-logo" src="${logoUrl}" alt="ДОЖИМ-АИ">
          </span>
          <span class="cr-radar-title">Радар конкурентов</span>
        </h3>
        <button class="cr-radar-close" data-cr-close aria-label="Закрыть">×</button>
      </div>
      <div class="cr-radar-panel-toolbar">
        ${renderSummaryButton(state)}
      </div>
      <p class="cr-radar-muted">Найдено ${items.length} конкурентов${query ? ` по запросу "${query}"` : ""}</p>
      <div class="cr-radar-scroll">
        <div class="cr-radar-sync">
          <div>
            <strong>${state.apiEnabled ? "Backend подключен" : "Локальный режим"}</strong>
            <span>${escapeHtml(state.syncStatus || "Данные сохраняются в браузере")}</span>
          </div>
          <button class="cr-radar-button secondary" data-cr-connect-backend>${state.apiEnabled ? "Переподключить" : "Подключить backend"}</button>
        </div>
        ${renderSummary(items, state)}
        <div class="cr-radar-list"></div>
      </div>
      ${renderSoftGate(state, items)}
      <div class="cr-radar-actions">
        <button class="cr-radar-button" data-cr-save>Сохранить в сводку</button>
      </div>
    `;

    const list = panel.querySelector(".cr-radar-list");
    if (!items.length) {
      list.innerHTML = `<p class="cr-radar-muted">${
        promoLabelsCount
          ? `Нашел меток “Промо”: ${promoLabelsCount}, но не смог собрать карточки объявлений. Обновите страницу или пришлите скрин с DOM, будем точечно настраивать селектор.`
          : "Пока не вижу блоков с меткой “Промо”. Попробуйте другой коммерческий запрос или регион."
      }</p>${debugSnippets.length ? renderDebugSnippets(debugSnippets) : ""}`;
    } else {
      items.forEach((item) => {
        const card = document.createElement("div");
        card.className = "cr-radar-card";
        const sitelinks = item.sitelinks || [];
        card.innerHTML = `
          <strong>${escapeHtml(item.realHeadline || item.title)}</strong>
          <div class="cr-radar-adlabel">${escapeHtml(item.adLabel || "Промо")}</div>
          <div class="cr-radar-domain">${escapeHtml(item.domain)}</div>
          <div class="cr-radar-score">Качество распознавания: ${escapeHtml(item.qualityScore || 0)}%</div>
          <div>${escapeHtml(item.description || "Описание не распознано")}</div>
          <p class="cr-radar-insight"><strong>Оффер:</strong> ${escapeHtml(item.primaryOffer || "не распознан")}</p>
          <p class="cr-radar-insight"><strong>Стратегия:</strong> ${escapeHtml(item.strategy || "mixed")} · <strong>CTA:</strong> ${escapeHtml(item.cta || "не выражен явно")}</p>
          <p class="cr-radar-insight">${escapeHtml(item.insight || "")}</p>
          <p class="cr-radar-hypothesis">${escapeHtml(item.hypothesis || "")}</p>
          ${item.weaknesses && item.weaknesses.length ? `
            <div class="cr-radar-sitelinks">${item.weaknesses.map((weakness) => `<span>${escapeHtml(weakness)}</span>`).join("")}</div>
          ` : ""}
          ${sitelinks.length ? `
            <div class="cr-radar-sitelinks">${sitelinks.map((link) => `<span>${escapeHtml(link.title || link)}</span>`).join("")}</div>
          ` : ""}
          <div class="cr-radar-tags">
            ${Array.from(new Set([...(item.detectedOffers || []), ...(item.triggers || [])])).slice(0, 10).map((tag) => `<span class="cr-radar-tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
        `;
        list.append(card);
      });
    }

    panel.querySelector("[data-cr-close]").addEventListener("click", () => panel.remove());
    panel.querySelectorAll("[data-cr-open-summary]").forEach((button) => {
      button.addEventListener("click", async () => {
        await openSummaryFallback(items);
      });
    });
    panel.querySelectorAll("[data-cr-full-audit]").forEach((button) => {
      button.addEventListener("click", async () => {
        await globalThis.CompetitorRadarStorage.trackEvent("extension_full_audit_clicked", { query, count: items.length });
        await globalThis.CompetitorRadarStorage.openDozhim("/lead-magnet");
      });
    });
    panel.querySelectorAll("[data-cr-create-campaign]").forEach((button) => {
      button.addEventListener("click", async () => {
        await globalThis.CompetitorRadarStorage.trackEvent("extension_create_campaign_clicked", { query, count: items.length });
        await globalThis.CompetitorRadarStorage.openDozhim("/");
      });
    });
    panel.querySelector("[data-cr-connect-backend]").addEventListener("click", async (event) => {
      event.currentTarget.textContent = "Подключаю...";
      event.currentTarget.disabled = true;
      await globalThis.CompetitorRadarStorage.connectBackend();
      showToast("Backend: статус обновлен");
      renderPanel(items);
    });
    panel.querySelector("[data-cr-save]").addEventListener("click", async () => {
      await globalThis.CompetitorRadarStorage.saveCompetitors(items);
      await globalThis.CompetitorRadarStorage.trackEvent("extension_competitors_saved", { query, count: items.length });
      showToast(`Сохранено в сводку: ${items.length}`);
      renderPanel(items);
    });

    document.body.append(panel);
  }

  function renderDebugSnippets(snippets) {
    return `
      <details class="cr-radar-debug" open>
        <summary>Debug: DOM вокруг “Промо”</summary>
        ${snippets.map((snippet) => `
          <div class="cr-radar-debug-block">
            <strong>Метка #${snippet.index}: ${escapeHtml(snippet.promoText)}</strong>
            ${snippet.candidates.map((candidate) => `
              <pre>${escapeHtml(JSON.stringify(candidate, null, 2))}</pre>
            `).join("")}
          </div>
        `).join("")}
      </details>
    `;
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
    button.innerHTML = `<span class="cr-radar-target" aria-hidden="true"></span><span>Радар конкурентов</span>`;
    button.addEventListener("click", async () => {
      const items = parseCards();
      await globalThis.CompetitorRadarStorage.saveLatestScan({
        type: "competitors",
        title: "Радар конкурентов",
        query,
        items
      });

      chrome.runtime.sendMessage({ type: "CR_OPEN_SIDE_PANEL" }, (response) => {
        if (!response || !response.ok) renderPanel(items);
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
    const count = (state.competitors || []).length;
    document.querySelectorAll(".cr-radar-badge").forEach((badge) => {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    });
  }

  injectButton();
})();
