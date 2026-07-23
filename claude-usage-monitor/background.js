"use strict";

const USAGE_URL = "https://claude.ai/new#settings/usage";
const ALARM_NAME = "claude-usage-check";
const DEFAULTS = {
  autoCheck: true,
  intervalMinutes: 30,
  notificationEnabled: true,
  threshold: 80
};

let checkerTabId = null;
let closeTimer = null;

async function settings() {
  return { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
}

function highestMetric(metrics) {
  return Object.values(metrics || {}).reduce((best, metric) =>
    !best || metric.percentage > best.percentage ? metric : best, null);
}

async function updateBadge(data) {
  const highest = highestMetric(data?.metrics);
  if (!highest) {
    await chrome.action.setBadgeText({ text: "?" });
    await chrome.action.setBadgeBackgroundColor({ color: "#777777" });
    return;
  }

  const value = Math.round(highest.percentage);
  const color = value >= 90 ? "#c62828" : value >= 70 ? "#ef6c00" : "#2e7d32";
  await chrome.action.setBadgeText({ text: String(value) });
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setTitle({
    title: `Claude 사용량: 최대 ${value}%\n클릭하여 자세히 보기`
  });
}

async function scheduleAlarm() {
  const config = await settings();
  await chrome.alarms.clear(ALARM_NAME);
  if (config.autoCheck) {
    await chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: 1,
      periodInMinutes: Math.max(5, Number(config.intervalMinutes) || 30)
    });
  }
}

async function performCheck() {
  const existing = await chrome.tabs.query({ url: "https://claude.ai/*" });
  const usageTab = existing.find((tab) => tab.url?.includes("#settings/usage"));

  if (usageTab?.id) {
    await chrome.tabs.reload(usageTab.id);
    return;
  }

  const tab = await chrome.tabs.create({ url: USAGE_URL, active: false });
  checkerTabId = tab.id;
  clearTimeout(closeTimer);
  closeTimer = setTimeout(async () => {
    if (checkerTabId !== null) {
      try { await chrome.tabs.remove(checkerTabId); } catch (_) {}
      checkerTabId = null;
    }
  }, 20000);
}

async function maybeNotify(data) {
  const config = await settings();
  if (!config.notificationEnabled) return;
  const highest = highestMetric(data.metrics);
  if (!highest || highest.percentage < config.threshold) return;

  const state = await chrome.storage.local.get("lastNotification");
  const last = state.lastNotification || {};
  const cooldown = 6 * 60 * 60 * 1000;
  if (last.percentage === highest.percentage && Date.now() - (last.at || 0) < cooldown) return;

  await chrome.notifications.create("claude-usage-threshold", {
    type: "basic",
    iconUrl: "icon.svg",
    title: "Claude 사용량 알림",
    message: `${highest.label}: ${Math.round(highest.percentage)}% 사용 중입니다.`,
    priority: 1
  });
  await chrome.storage.local.set({
    lastNotification: { percentage: highest.percentage, at: Date.now() }
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.sync.set({
    ...DEFAULTS,
    ...(await chrome.storage.sync.get(DEFAULTS))
  });
  await scheduleAlarm();
  const latest = await chrome.storage.local.get("latestUsage");
  await updateBadge(latest.latestUsage);
});

chrome.runtime.onStartup.addListener(async () => {
  await scheduleAlarm();
  const latest = await chrome.storage.local.get("latestUsage");
  await updateBadge(latest.latestUsage);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) performCheck();
});

chrome.notifications.onClicked.addListener(() => chrome.tabs.create({ url: USAGE_URL }));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "USAGE_CAPTURED") {
    (async () => {
      await chrome.storage.local.set({ latestUsage: message.payload });
      await updateBadge(message.payload);
      await maybeNotify(message.payload);
      if (sender.tab?.id === checkerTabId) {
        clearTimeout(closeTimer);
        try { await chrome.tabs.remove(checkerTabId); } catch (_) {}
        checkerTabId = null;
      }
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === "REFRESH_NOW") {
    performCheck().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "SETTINGS_CHANGED") {
    scheduleAlarm().then(() => sendResponse({ ok: true }));
    return true;
  }
});
