const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "radar.json");

function createDefaultData() {
  return {
    users: [
      {
        id: "user_demo_admin",
        email: "admin@dozim.ai",
        name: "Demo Admin",
        role: "admin",
        createdAt: new Date().toISOString()
      }
    ],
    projects: [
      {
        id: "project_demo_repair",
        userId: "user_demo_admin",
        name: "Ремонт квартир Москва",
        region: "Москва",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    competitors: [],
    keywords: [],
    subscriptions: [],
    radarScans: [],
    radarLeads: [],
    analyticsEvents: []
  };
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(createDefaultData(), null, 2));
  }
}

function readData() {
  ensureDataFile();
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  return normalizeData(data);
}

function writeData(data) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function resolveCorsOrigin(req) {
  const origin = req.headers.origin || "";
  if (!origin) return "";
  if (/^chrome-extension:\/\//.test(origin) || /^moz-extension:\/\//.test(origin)) return origin;
  if (/^https:\/\/(www\.)?yandex\.ru$/.test(origin)) return origin;
  if (origin === "https://ya.ru" || origin === "https://wordstat.yandex.ru") return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1):(3000|8787)$/.test(origin)) return origin;
  return "";
}

function sendJson(res, status, payload) {
  const corsOrigin = res.corsOrigin || "http://localhost:8787";
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": corsOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("payload_too_large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("invalid_json"));
      }
    });
  });
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function normalizeData(data) {
  const defaults = createDefaultData();
  return {
    ...defaults,
    ...data,
    users: Array.isArray(data.users) ? data.users : defaults.users,
    projects: Array.isArray(data.projects) ? data.projects : defaults.projects,
    competitors: Array.isArray(data.competitors) ? data.competitors : [],
    keywords: Array.isArray(data.keywords) ? data.keywords : [],
    subscriptions: Array.isArray(data.subscriptions) ? data.subscriptions : [],
    radarScans: Array.isArray(data.radarScans) ? data.radarScans : [],
    radarLeads: Array.isArray(data.radarLeads) ? data.radarLeads : [],
    analyticsEvents: Array.isArray(data.analyticsEvents) ? data.analyticsEvents : []
  };
}

function getDemoUser(data) {
  return data.users[0];
}

function parseProjectRoute(pathname) {
  const match = pathname.match(/^\/projects\/([^/]+)\/(competitors|keywords)$/);
  if (!match) return null;
  return { projectId: match[1], collection: match[2] };
}

const rateLimitBuckets = new Map();

function getClientKey(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "local").split(",")[0].trim();
}

function checkRateLimit(req, bucket, limit = 30, windowMs = 60_000) {
  const key = `${bucket}:${getClientKey(req)}`;
  const now = Date.now();
  const current = rateLimitBuckets.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > current.resetAt) {
    current.count = 0;
    current.resetAt = now + windowMs;
  }

  current.count += 1;
  rateLimitBuckets.set(key, current);

  return {
    ok: current.count <= limit,
    retryAfterMs: Math.max(0, current.resetAt - now)
  };
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function parseKeywords(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(/[\n,;]/);
  return raw.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 12);
}

function validateScanInput(body) {
  const niche = cleanText(body.niche, 120);
  const site = cleanText(body.site, 180);
  const region = cleanText(body.region || "Москва", 80);
  const keywords = parseKeywords(body.keywords);

  if (!niche && !site && keywords.length === 0) {
    return { error: "Введите нишу, сайт или ключевые фразы." };
  }

  if (site && !/^https?:\/\/|^[a-zа-я0-9.-]+\.[a-zа-я]{2,}/i.test(site)) {
    return { error: "Укажите корректный сайт или оставьте поле пустым." };
  }

  return { value: { niche, site, region, keywords } };
}

function validateLeadInput(body) {
  const rawContact = cleanText(body.contact, 120);
  const consentAccepted = Boolean(body.consentAccepted);
  const contact = rawContact.replace(/^https?:\/\/t\.me\//i, "").replace(/^t\.me\//i, "");
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  const telegramUsername = contact.replace(/^@/, "");
  const isTelegram = /^[a-zA-Z0-9_]{4,32}$/.test(telegramUsername);

  if (!rawContact) return { error: "Укажите Telegram или email." };
  if (!isEmail && !isTelegram) {
    return { error: "Укажите корректный email или Telegram." };
  }
  if (!consentAccepted) return { error: "Нужно согласие на обработку персональных данных." };

  return {
    value: {
      contact: isEmail ? contact : `@${telegramUsername}`,
      contactType: isEmail ? "email" : "telegram",
      consentAccepted,
      consentVersion: cleanText(body.consentVersion || "2026-05-31", 40)
    }
  };
}

function validateRegisterInput(body) {
  const name = cleanText(body.name, 100);
  const email = cleanText(body.email, 140).toLowerCase();
  const password = String(body.password || "");

  if (!name) return { error: "Укажите имя." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Укажите корректный email." };
  if (password.length < 6) return { error: "Пароль должен быть не короче 6 символов." };

  return { value: { name, email, password } };
}

function validateProjectInput(body) {
  const name = cleanText(body.name || "Новый проект", 120);
  const region = cleanText(body.region || "", 80);
  if (name.length < 2) return { error: "project_name_required" };
  return { value: { name, region } };
}

function validateCollectionItems(body, collection) {
  const incomingItems = Array.isArray(body.items) ? body.items : [body];
  const items = incomingItems.slice(0, 50).map((item) => {
    const base = {
      source: cleanText(item.source || "", 50),
      sourceType: cleanText(item.sourceType || "", 80),
      query: cleanText(item.query || item.seedQuery || "", 160),
      project: cleanText(item.project || "", 120),
      capturedAt: cleanText(item.capturedAt || new Date().toISOString(), 40)
    };

    if (collection === "competitors") {
      return {
        ...base,
        domain: cleanText(item.domain || "", 180),
        title: cleanText(item.title || "", 220),
        description: cleanText(item.description || "", 600),
        adLabel: cleanText(item.adLabel || "Промо", 40),
        detectedOffers: Array.isArray(item.detectedOffers) ? item.detectedOffers.map((offer) => cleanText(offer, 80)).slice(0, 20) : [],
        insight: cleanText(item.insight || "", 360),
        hypothesis: cleanText(item.hypothesis || "", 360),
        qualityScore: Number(item.qualityScore || 0)
      };
    }

    return {
      ...base,
      phrase: cleanText(item.phrase || "", 180),
      frequency: Number(item.frequency || 0),
      intent: cleanText(item.intent || "mixed", 40),
      signals: Array.isArray(item.signals) ? item.signals.map((signal) => cleanText(signal, 80)).slice(0, 12) : [],
      adGroupHint: cleanText(item.adGroupHint || "", 220)
    };
  }).filter((item) => collection === "competitors" ? item.title || item.domain : item.phrase);

  if (!items.length) return { error: "items_required" };
  return { value: { items } };
}

function validateSubscriptionInput(body) {
  const handle = cleanText(body.handle || body.contact || "", 80).replace(/^https?:\/\/t\.me\//i, "").replace(/^@/, "");
  const consentAccepted = body.consentAccepted === undefined ? true : Boolean(body.consentAccepted);
  if (!/^[a-zA-Z0-9_]{4,32}$/.test(handle)) return { error: "telegram_handle_invalid" };
  return { value: { handle: `@${handle}`, consentAccepted } };
}

function validateEventInput(body) {
  const eventName = cleanText(body.eventName || body.name, 80);
  if (!/^[a-z0-9_:-]{3,80}$/i.test(eventName)) return { error: "event_name_invalid" };
  return {
    value: {
      eventName,
      source: cleanText(body.source || "browser_extension", 80),
      properties: body.properties && typeof body.properties === "object" ? body.properties : {}
    }
  };
}

function buildRadarResult(input) {
  const base = input.niche || input.keywords[0] || "ваша ниша";
  const normalizedSite = input.site.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const competitorDomains = [
    normalizedSite ? `top-${normalizedSite}` : "market-leader.ru",
    "direct-offer.ru",
    "quick-client.ru",
    "region-pro.ru",
    "result-plus.ru"
  ];

  const offerPool = [
    "бесплатная консультация",
    "фиксированная цена",
    "гарантия результата",
    "рассрочка",
    "срочный выезд",
    "аудит в подарок"
  ];

  const competitors = competitorDomains.slice(0, 5).map((domain, index) => {
    const primaryOffer = offerPool[(index + input.keywords.length) % offerPool.length];
    const secondaryOffer = offerPool[(index + input.keywords.length + 2) % offerPool.length];
    return {
      id: id("competitor"),
      domain,
      title: `${base}: предложение #${index + 1}`,
      offer: `${primaryOffer}, ${secondaryOffer}`,
      weakness: index % 2 === 0
        ? "Оффер похож на рынок и не объясняет, почему выбрать именно эту компанию."
        : "Много обещаний, но мало конкретики по срокам, цене и доказательствам.",
      activityScore: 88 - index * 9,
      sourceType: "web_lead_magnet_mock"
    };
  });

  const offers = competitors.map((item) => item.offer);
  const weaknesses = competitors.map((item) => item.weakness).slice(0, 4);
  const ideas = [
    `Вынести конкретный результат по запросу "${base}" в первый экран объявления.`,
    `Добавить отдельный крючок для региона "${input.region}": срок, цена или гарантия.`,
    "Сравнить себя с типовым предложением рынка через 2-3 понятных отличия.",
    "Сделать лид-магнит: быстрый расчет, чек-лист или мини-аудит перед заявкой.",
    "Проверить связку объявление -> посадочная: обещание в рекламе должно повторяться на первом экране."
  ];

  return { competitors, offers, weaknesses, ideas };
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  res.corsOrigin = resolveCorsOrigin(req);

  if (req.headers.origin && !res.corsOrigin) {
    sendJson(res, 403, { error: "cors_origin_not_allowed" });
    return;
  }

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  try {
    if (req.method === "GET" && pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        service: "dozhim-radar-backend",
        time: new Date().toISOString()
      });
      return;
    }

    if (req.method === "POST" && pathname === "/auth/demo") {
      const data = readData();
      const user = getDemoUser(data);
      sendJson(res, 200, {
        token: id("session"),
        user
      });
      return;
    }

    if (req.method === "POST" && pathname === "/auth/register") {
      const limited = checkRateLimit(req, "auth_register", 10, 60_000);
      if (!limited.ok) {
        sendJson(res, 429, { error: "rate_limited", retryAfterMs: limited.retryAfterMs });
        return;
      }

      const body = await readBody(req);
      const validation = validateRegisterInput(body);
      if (validation.error) {
        sendJson(res, 400, { error: validation.error });
        return;
      }

      const data = readData();
      const existingUser = data.users.find((item) => item.email.toLowerCase() === validation.value.email);
      if (existingUser) {
        sendJson(res, 409, { error: "Пользователь с таким email уже зарегистрирован." });
        return;
      }

      const now = new Date().toISOString();
      const user = {
        id: id("user"),
        email: validation.value.email,
        name: validation.value.name,
        role: "user",
        createdAt: now
      };
      const project = {
        id: id("project"),
        userId: user.id,
        name: "Первый проект",
        region: "Москва",
        createdAt: now,
        updatedAt: now
      };

      data.users.push(user);
      data.projects.push(project);
      writeData(data);
      sendJson(res, 201, {
        token: id("session"),
        user,
        project
      });
      return;
    }

    if (req.method === "GET" && pathname === "/projects") {
      const data = readData();
      sendJson(res, 200, { projects: data.projects });
      return;
    }

    if (req.method === "POST" && pathname === "/projects") {
      const limited = checkRateLimit(req, "projects_create", 20, 60_000);
      if (!limited.ok) {
        sendJson(res, 429, { error: "rate_limited", retryAfterMs: limited.retryAfterMs });
        return;
      }

      const body = await readBody(req);
      const validation = validateProjectInput(body);
      if (validation.error) {
        sendJson(res, 400, { error: validation.error });
        return;
      }

      const data = readData();
      const project = {
        id: id("project"),
        userId: getDemoUser(data).id,
        name: validation.value.name,
        region: validation.value.region,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      data.projects.push(project);
      writeData(data);
      sendJson(res, 201, { project });
      return;
    }

    const projectRoute = parseProjectRoute(pathname);
    if (projectRoute && req.method === "GET") {
      const data = readData();
      const items = data[projectRoute.collection].filter((item) => item.projectId === projectRoute.projectId);
      sendJson(res, 200, { items });
      return;
    }

    if (projectRoute && req.method === "POST") {
      const limited = checkRateLimit(req, `project_${projectRoute.collection}`, 60, 60_000);
      if (!limited.ok) {
        sendJson(res, 429, { error: "rate_limited", retryAfterMs: limited.retryAfterMs });
        return;
      }

      const body = await readBody(req);
      const validation = validateCollectionItems(body, projectRoute.collection);
      if (validation.error) {
        sendJson(res, 400, { error: validation.error });
        return;
      }

      const data = readData();
      const project = data.projects.find((item) => item.id === projectRoute.projectId);
      if (!project) {
        sendJson(res, 404, { error: "project_not_found" });
        return;
      }

      const now = new Date().toISOString();
      const items = validation.value.items.map((item) => ({
        ...item,
        id: item.id || id(projectRoute.collection === "competitors" ? "competitor" : "keyword"),
        projectId: project.id,
        createdAt: item.createdAt || now,
        updatedAt: now
      }));

      data[projectRoute.collection].push(...items);
      project.updatedAt = now;
      writeData(data);
      sendJson(res, 201, { items });
      return;
    }

    if (req.method === "POST" && pathname === "/subscriptions/telegram") {
      const limited = checkRateLimit(req, "subscriptions_telegram", 8, 60_000);
      if (!limited.ok) {
        sendJson(res, 429, { error: "rate_limited", retryAfterMs: limited.retryAfterMs });
        return;
      }

      const body = await readBody(req);
      const validation = validateSubscriptionInput(body);
      if (validation.error) {
        sendJson(res, 400, { error: validation.error });
        return;
      }

      const data = readData();
      const now = new Date().toISOString();
      const subscription = {
        id: id("subscription"),
        channel: "telegram",
        handle: validation.value.handle,
        userId: getDemoUser(data).id,
        consentAccepted: validation.value.consentAccepted,
        consentAt: validation.value.consentAccepted ? now : null,
        status: "pending_verification",
        createdAt: now
      };
      data.subscriptions.push(subscription);
      writeData(data);
      sendJson(res, 201, { subscription });
      return;
    }

    if (req.method === "POST" && pathname === "/radar/scans") {
      const limited = checkRateLimit(req, "radar_scans", 12, 60_000);
      if (!limited.ok) {
        sendJson(res, 429, { error: "rate_limited", retryAfterMs: limited.retryAfterMs });
        return;
      }

      const body = await readBody(req);
      const validation = validateScanInput(body);
      if (validation.error) {
        sendJson(res, 400, { error: validation.error });
        return;
      }

      const data = readData();
      const now = new Date().toISOString();
      const result = buildRadarResult(validation.value);
      const scan = {
        id: id("scan"),
        ...validation.value,
        status: "completed",
        result,
        createdAt: now,
        updatedAt: now
      };
      data.radarScans.push(scan);
      writeData(data);
      sendJson(res, 201, { scan });
      return;
    }

    const scanMatch = pathname.match(/^\/radar\/scans\/([^/]+)$/);
    if (req.method === "GET" && scanMatch) {
      const data = readData();
      const scan = data.radarScans.find((item) => item.id === scanMatch[1]);
      if (!scan) {
        sendJson(res, 404, { error: "scan_not_found" });
        return;
      }
      sendJson(res, 200, { scan });
      return;
    }

    const leadMatch = pathname.match(/^\/radar\/scans\/([^/]+)\/lead$/);
    if (req.method === "POST" && leadMatch) {
      const limited = checkRateLimit(req, "radar_leads", 8, 60_000);
      if (!limited.ok) {
        sendJson(res, 429, { error: "rate_limited", retryAfterMs: limited.retryAfterMs });
        return;
      }

      const body = await readBody(req);
      const validation = validateLeadInput(body);
      if (validation.error) {
        sendJson(res, 400, { error: validation.error });
        return;
      }

      const data = readData();
      const scan = data.radarScans.find((item) => item.id === leadMatch[1]);
      if (!scan) {
        sendJson(res, 404, { error: "scan_not_found" });
        return;
      }

      const now = new Date().toISOString();
      const lead = {
        id: id("lead"),
        scanId: scan.id,
        source: "radar_web_lead_magnet",
        contact: validation.value.contact,
        contactType: validation.value.contactType,
        consentAccepted: validation.value.consentAccepted,
        consentVersion: validation.value.consentVersion,
        consentAt: now,
        createdAt: now
      };
      data.radarLeads.push(lead);
      scan.leadId = lead.id;
      scan.updatedAt = now;
      writeData(data);
      sendJson(res, 201, { lead });
      return;
    }

    if (req.method === "POST" && pathname === "/radar/leads") {
      const limited = checkRateLimit(req, "extension_radar_leads", 8, 60_000);
      if (!limited.ok) {
        sendJson(res, 429, { error: "rate_limited", retryAfterMs: limited.retryAfterMs });
        return;
      }

      const body = await readBody(req);
      const validation = validateLeadInput(body);
      if (validation.error) {
        sendJson(res, 400, { error: validation.error });
        return;
      }

      const data = readData();
      const now = new Date().toISOString();
      const lead = {
        id: id("lead"),
        source: cleanText(body.source || "browser_extension_soft_gate", 80),
        contact: validation.value.contact,
        contactType: validation.value.contactType,
        consentAccepted: validation.value.consentAccepted,
        consentVersion: validation.value.consentVersion,
        consentAt: now,
        context: body.context && typeof body.context === "object" ? body.context : {},
        createdAt: now
      };
      data.radarLeads.push(lead);
      writeData(data);
      sendJson(res, 201, { lead });
      return;
    }

    if (req.method === "POST" && pathname === "/analytics/events") {
      const limited = checkRateLimit(req, "analytics_events", 120, 60_000);
      if (!limited.ok) {
        sendJson(res, 429, { error: "rate_limited", retryAfterMs: limited.retryAfterMs });
        return;
      }

      const body = await readBody(req);
      const allowedEvents = new Set([
        "radar_page_view",
        "radar_scan_submitted",
        "radar_result_viewed",
        "radar_lead_submitted",
        "radar_full_audit_cta_clicked"
      ]);
      const eventName = cleanText(body.eventName, 80);
      if (!allowedEvents.has(eventName)) {
        sendJson(res, 400, { error: "unsupported_event" });
        return;
      }

      const data = readData();
      const event = {
        id: id("event"),
        eventName,
        source: cleanText(body.source || "radar_web_lead_magnet", 80),
        properties: body.properties && typeof body.properties === "object" ? body.properties : {},
        createdAt: new Date().toISOString()
      };
      data.analyticsEvents.push(event);
      writeData(data);
      sendJson(res, 201, { event });
      return;
    }

    if (req.method === "POST" && pathname === "/radar/events") {
      const limited = checkRateLimit(req, "extension_radar_events", 180, 60_000);
      if (!limited.ok) {
        sendJson(res, 429, { error: "rate_limited", retryAfterMs: limited.retryAfterMs });
        return;
      }

      const body = await readBody(req);
      const validation = validateEventInput(body);
      if (validation.error) {
        sendJson(res, 400, { error: validation.error });
        return;
      }

      const data = readData();
      const event = {
        id: id("event"),
        eventName: validation.value.eventName,
        source: validation.value.source,
        properties: validation.value.properties,
        createdAt: new Date().toISOString()
      };
      data.analyticsEvents.push(event);
      writeData(data);
      sendJson(res, 201, { event });
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    const status = error.message === "invalid_json" ? 400 : 500;
    sendJson(res, status, { error: error.message || "server_error" });
  }
}

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  ensureDataFile();
  console.log(`Dozhim Radar backend listening on http://localhost:${PORT}`);
});
