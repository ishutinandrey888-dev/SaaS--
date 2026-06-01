(function () {
  const RADAR_STORAGE_KEY = "competitorRadarState";

  function withChromeStorage(callback) {
    if (!globalThis.chrome || !chrome.storage || !chrome.storage.local) {
      return Promise.resolve(callback(null));
    }

    return new Promise((resolve) => {
      callback(resolve);
    });
  }

  async function getRadarState() {
    const fallbackState = {
      activeProject: "Ремонт квартир Москва",
      apiBaseUrl: "http://localhost:8787",
      appBaseUrl: "http://localhost:3000",
      apiEnabled: false,
      apiToken: null,
      remoteProjectId: null,
      syncStatus: "Локальный режим",
      latestScan: null,
      competitors: [],
      keywords: [],
      leads: [],
      events: [],
      updatedAt: null
    };

    return withChromeStorage((resolve) => {
      if (!resolve) {
        return fallbackState;
      }

      chrome.storage.local.get([RADAR_STORAGE_KEY], (result) => {
        resolve({ ...fallbackState, ...(result[RADAR_STORAGE_KEY] || {}) });
      });
    });
  }

  async function setRadarState(nextState) {
    const state = {
      activeProject: nextState.activeProject || "Ремонт квартир Москва",
      apiBaseUrl: nextState.apiBaseUrl || "http://localhost:8787",
      appBaseUrl: nextState.appBaseUrl || "http://localhost:3000",
      apiEnabled: Boolean(nextState.apiEnabled),
      apiToken: nextState.apiToken || null,
      remoteProjectId: nextState.remoteProjectId || null,
      syncStatus: nextState.syncStatus || "Локальный режим",
      latestScan: nextState.latestScan || null,
      competitors: nextState.competitors || [],
      keywords: nextState.keywords || [],
      leads: nextState.leads || [],
      events: nextState.events || [],
      updatedAt: new Date().toISOString()
    };

    return withChromeStorage((resolve) => {
      if (!resolve) return state;

      chrome.storage.local.set({ [RADAR_STORAGE_KEY]: state }, () => {
        resolve(state);
      });
    });
  }

  function byKey(item) {
    return [
      item.source || "",
      item.query || "",
      item.domain || "",
      item.title || "",
      item.phrase || ""
    ].join("|").toLowerCase();
  }

  async function saveCompetitors(items) {
    const state = await getRadarState();
    const activeProject = inferProjectName({ type: "competitors", items }, state);
    const map = new Map(state.competitors.map((item) => [byKey(item), item]));

    items.forEach((item) => {
      map.set(byKey(item), {
        ...item,
        project: item.project || activeProject,
        savedAt: item.savedAt || new Date().toISOString()
      });
    });

    return setRadarState({
      ...state,
      activeProject,
      competitors: Array.from(map.values()).slice(-200)
    }).then((nextState) => syncCollection(nextState, "competitors", items));
  }

  async function saveKeywords(items) {
    const state = await getRadarState();
    const activeProject = inferProjectName({ type: "keywords", items }, state);
    const map = new Map(state.keywords.map((item) => [byKey(item), item]));

    items.forEach((item) => {
      map.set(byKey(item), {
        ...item,
        project: item.project || activeProject,
        savedAt: item.savedAt || new Date().toISOString()
      });
    });

    return setRadarState({
      ...state,
      activeProject,
      keywords: Array.from(map.values()).slice(-300)
    }).then((nextState) => syncCollection(nextState, "keywords", items));
  }

  async function saveLatestScan(scan) {
    const state = await getRadarState();
    const activeProject = inferProjectName(scan, state);
    return setRadarState({
      ...state,
      activeProject,
      latestScan: {
        ...scan,
        project: scan.project || activeProject,
        capturedAt: scan.capturedAt || new Date().toISOString()
      }
    });
  }

  async function connectBackend() {
    const state = await getRadarState();
    if (!state.apiBaseUrl) return setRadarState({ ...state, apiEnabled: false, syncStatus: "API URL не задан" });

    try {
      const auth = await apiRequest(state, "/auth/demo", { method: "POST" });
      const projectsResponse = await apiRequest({ ...state, apiToken: auth.token }, "/projects");
      const project = findOrCreateProject(state, projectsResponse.projects || []);
      let remoteProjectId = project && project.id;

      if (!remoteProjectId) {
        const created = await apiRequest({ ...state, apiToken: auth.token }, "/projects", {
          method: "POST",
          body: {
            name: state.activeProject,
            region: ""
          }
        });
        remoteProjectId = created.project.id;
      }

      return setRadarState({
        ...state,
        apiEnabled: true,
        apiToken: null,
        remoteProjectId,
        syncStatus: "Backend подключен"
      });
    } catch (error) {
      return setRadarState({
        ...state,
        apiEnabled: false,
        syncStatus: `Backend недоступен: ${error.message}`
      });
    }
  }

  async function syncCollection(state, collection, items) {
    if (!state.apiEnabled || !state.remoteProjectId || !items.length) return state;

    try {
      await apiRequest(state, `/projects/${state.remoteProjectId}/${collection}`, {
        method: "POST",
        body: {
          items: items.map((item) => ({
            ...item,
            project: item.project || state.activeProject
          }))
        }
      });

      return setRadarState({
        ...state,
        syncStatus: `Синхронизировано: ${new Date().toLocaleTimeString("ru-RU")}`
      });
    } catch (error) {
      return setRadarState({
        ...state,
        syncStatus: `Ошибка синхронизации: ${error.message}`
      });
    }
  }

  function inferProjectName(scan, state) {
    const items = Array.isArray(scan.items) ? scan.items : [];
    if (scan.type === "keywords" && items.length) {
      const topKeyword = items
        .slice()
        .sort((a, b) => Number(b.frequency || 0) - Number(a.frequency || 0))[0];
      if (topKeyword && topKeyword.phrase) return topKeyword.phrase;
    }

    if (scan.type === "competitors" && items.length) {
      const query = items.find((item) => item.query) && items.find((item) => item.query).query;
      if (query) return query;
      const title = items.find((item) => item.title) && items.find((item) => item.title).title;
      if (title) return title.slice(0, 80);
    }

    return scan.project || state.activeProject || "Новый проект";
  }

  async function saveLead(lead) {
    const state = await getRadarState();
    const nextLead = {
      contact: String(lead.contact || "").trim().slice(0, 120),
      source: lead.source || "extension_soft_gate",
      consentAccepted: Boolean(lead.consentAccepted),
      consentVersion: lead.consentVersion || "extension-mvp-2026-05-31",
      createdAt: new Date().toISOString()
    };

    const nextState = await setRadarState({
      ...state,
      leads: [...(state.leads || []), nextLead].slice(-50)
    });

    if (nextState.apiEnabled) {
      try {
        await apiRequest(nextState, "/radar/leads", {
          method: "POST",
          body: nextLead
        });
        await setRadarState({ ...nextState, syncStatus: "Лид отправлен в backend" });
      } catch (error) {
        await setRadarState({ ...nextState, syncStatus: `Лид сохранен локально: ${error.message}` });
      }
    }

    return nextState;
  }

  async function trackEvent(eventName, properties = {}) {
    const state = await getRadarState();
    const event = {
      eventName,
      source: "browser_extension",
      properties,
      createdAt: new Date().toISOString()
    };
    const nextState = await setRadarState({
      ...state,
      events: [...(state.events || []), event].slice(-200)
    });

    if (nextState.apiEnabled) {
      try {
        await apiRequest(nextState, "/radar/events", {
          method: "POST",
          body: event
        });
      } catch {
        // Analytics must never break the user flow.
      }
    }

    return nextState;
  }

  function openDozhim(pathname = "/lead-magnet") {
    return getRadarState().then((state) => {
      const base = (state.appBaseUrl || "http://localhost:3000").replace(/\/$/, "");
      const url = `${base}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
      if (globalThis.chrome && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url });
      } else {
        globalThis.open(url, "_blank", "noopener,noreferrer");
      }
      return url;
    });
  }

  function findOrCreateProject(state, projects) {
    return projects.find((project) => project.name === state.activeProject) || null;
  }

  async function apiRequest(state, pathname, options = {}) {
    const response = await fetch(`${state.apiBaseUrl}${pathname}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(state.apiToken ? { Authorization: `Bearer ${state.apiToken}` } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }

    return response.status === 204 ? {} : response.json();
  }

  globalThis.CompetitorRadarStorage = {
    getRadarState,
    setRadarState,
    saveCompetitors,
    saveKeywords,
    saveLatestScan,
    saveLead,
    trackEvent,
    openDozhim,
    connectBackend
  };
})();
