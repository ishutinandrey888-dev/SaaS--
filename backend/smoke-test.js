const { spawn } = require("child_process");

const PORT = Number(process.env.SMOKE_PORT || 8898);
const BASE_URL = `http://localhost:${PORT}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json();
  return { response, payload };
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const { response } = await request("/health");
      if (response.ok) return;
    } catch {
      await wait(150);
    }
  }
  throw new Error("Backend smoke server did not become healthy.");
}

async function expectStatus(label, promise, status) {
  const result = await promise;
  if (result.response.status !== status) {
    throw new Error(`${label}: expected ${status}, got ${result.response.status} ${JSON.stringify(result.payload)}`);
  }
  return result.payload;
}

async function run() {
  const server = spawn(process.execPath, ["server.js"], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore"
  });

  try {
    await waitForHealth();
    const registerPayload = await expectStatus(
      "register user",
      request("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: "Smoke User",
          email: `smoke-${Date.now()}@example.com`,
          password: "password"
        })
      }),
      201
    );
    if (!registerPayload.user || !registerPayload.token || !registerPayload.project) {
      throw new Error(`register user: invalid payload ${JSON.stringify(registerPayload)}`);
    }

    await expectStatus(
      "register invalid email",
      request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: "Bad User", email: "bad-email", password: "password" })
      }),
      400
    );

    const scanPayload = await expectStatus(
      "create scan",
      request("/radar/scans", {
        method: "POST",
        body: JSON.stringify({
          niche: "ремонт квартир",
          site: "example.ru",
          keywords: "ремонт квартир москва\nремонт под ключ",
          region: "Москва"
        })
      }),
      201
    );

    const scanId = scanPayload.scan.id;
    await expectStatus("get scan", request(`/radar/scans/${scanId}`), 200);

    for (const contact of ["@username", "username", "https://t.me/username", "email@example.com"]) {
      const lead = await expectStatus(
        `lead ${contact}`,
        request(`/radar/scans/${scanId}/lead`, {
          method: "POST",
          body: JSON.stringify({ contact, consentAccepted: true, consentVersion: "2026-05-31" })
        }),
        201
      );
      if (contact !== "email@example.com" && lead.lead.contact !== "@username") {
        throw new Error(`Telegram normalization failed for ${contact}: ${lead.lead.contact}`);
      }
    }

    await expectStatus(
      "lead without consent",
      request(`/radar/scans/${scanId}/lead`, {
        method: "POST",
        body: JSON.stringify({ contact: "email@example.com", consentAccepted: false })
      }),
      400
    );

    await expectStatus(
      "analytics event",
      request("/analytics/events", {
        method: "POST",
        body: JSON.stringify({ eventName: "radar_page_view", properties: { smoke: true } })
      }),
      201
    );

    const projectsPayload = await expectStatus("list projects", request("/projects"), 200);
    const projectId = projectsPayload.projects[0].id;

    await expectStatus(
      "extension competitor sync",
      request(`/projects/${projectId}/competitors`, {
        method: "POST",
        body: JSON.stringify({
          items: [{
            source: "yandex_search",
            query: "купить квартиру в москве",
            domain: "example.ru",
            title: "Купить квартиру в Москве",
            description: "Промо. Рассрочка и скидки от застройщика.",
            detectedOffers: ["рассрочка", "скидка"],
            insight: "На что давит конкурент: рассрочка, скидка.",
            hypothesis: "Что протестировать в своей рекламе: гарантию."
          }]
        })
      }),
      201
    );

    await expectStatus(
      "extension keyword sync",
      request(`/projects/${projectId}/keywords`, {
        method: "POST",
        body: JSON.stringify({
          items: [{
            source: "wordstat",
            phrase: "купить квартиру в москве",
            frequency: 1200,
            intent: "commercial",
            signals: ["коммерческий запрос", "высокий потенциал"],
            adGroupHint: "Группа объявлений: гео-запросы."
          }]
        })
      }),
      201
    );

    await expectStatus(
      "extension radar lead",
      request("/radar/leads", {
        method: "POST",
        body: JSON.stringify({ contact: "https://t.me/username", consentAccepted: true, source: "extension_soft_gate" })
      }),
      201
    );

    await expectStatus(
      "extension radar event",
      request("/radar/events", {
        method: "POST",
        body: JSON.stringify({ eventName: "extension_competitors_saved", source: "browser_extension", properties: { count: 1 } })
      }),
      201
    );

    console.log("Backend smoke tests passed.");
  } finally {
    server.kill();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
