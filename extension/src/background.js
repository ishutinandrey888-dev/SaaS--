chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["competitorRadarState"], (result) => {
    if (result.competitorRadarState) return;

    chrome.storage.local.set({
      competitorRadarState: {
        activeProject: "Ремонт квартир Москва",
        apiBaseUrl: "http://localhost:8787",
        apiEnabled: false,
        apiToken: null,
        remoteProjectId: null,
        syncStatus: "Локальный режим",
        latestScan: null,
        competitors: [],
        keywords: [],
        leads: [],
        events: [],
        updatedAt: new Date().toISOString()
      }
    });
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;

  if (message.type === "CR_OPEN_POPUP") {
    if (chrome.action && chrome.action.openPopup) {
      chrome.action.openPopup()
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, reason: error.message }));
      return true;
    }

    sendResponse({ ok: false, reason: "open_popup_api_unavailable" });
    return false;
  }

  if (message.type !== "CR_OPEN_SIDE_PANEL") return false;

  sendResponse({ ok: false, reason: "native_side_panel_disabled_for_yandex_browser" });
  return false;
});
