"use strict";

const DEFAULTS = {
  autoCheck: true,
  intervalMinutes: 30,
  notificationEnabled: true,
  threshold: 80
};

const labels = {
  session: "현재 세션",
  weekly: "주간 한도",
  sonnet: "Sonnet",
  opus: "Opus"
};

function relativeTime(timestamp) {
  if (!timestamp) return "아직 확인하지 않음";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "방금 확인";
  if (minutes < 60) return `${minutes}분 전 확인`;
  return `${Math.floor(minutes / 60)}시간 전 확인`;
}

function render(data) {
  const container = document.querySelector("#metrics");
  const metrics = Object.entries(data?.metrics || {});
  document.querySelector("#updated").textContent = relativeTime(data?.capturedAt);

  if (!metrics.length) {
    container.innerHTML = '<p class="empty">Claude에 로그인한 뒤 새로고침을 눌러주세요.</p>';
    return;
  }

  container.replaceChildren(...metrics.map(([key, metric]) => {
    const card = document.createElement("div");
    card.className = "metric";
    const value = Math.round(metric.percentage);
    const tone = value >= 90 ? "danger" : value >= 70 ? "warn" : "";
    const head = document.createElement("div");
    head.className = "metric-head";
    const name = document.createElement("span");
    name.textContent = labels[key] || metric.label;
    const strong = document.createElement("strong");
    strong.textContent = `${value}%`;
    head.append(name, strong);
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("div");
    fill.className = `fill ${tone}`;
    fill.style.width = `${value}%`;
    bar.append(fill);
    card.append(head, bar);
    return card;
  }));
}

async function load() {
  const config = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
  Object.keys(DEFAULTS).forEach((key) => {
    const element = document.querySelector(`#${key}`);
    if (element.type === "checkbox") element.checked = Boolean(config[key]);
    else element.value = String(config[key]);
  });
  const local = await chrome.storage.local.get("latestUsage");
  render(local.latestUsage);
}

document.querySelector("#refresh").addEventListener("click", async (event) => {
  event.currentTarget.disabled = true;
  event.currentTarget.textContent = "확인 중";
  await chrome.runtime.sendMessage({ type: "REFRESH_NOW" });
  setTimeout(() => window.close(), 600);
});

document.querySelector("#openUsage").addEventListener("click", async (event) => {
  event.preventDefault();
  await chrome.tabs.create({ url: "https://claude.ai/new#settings/usage" });
});

document.querySelectorAll("input, select").forEach((element) => {
  element.addEventListener("change", async () => {
    const patch = {};
    patch[element.id] = element.type === "checkbox" ? element.checked : Number(element.value);
    await chrome.storage.sync.set(patch);
    await chrome.runtime.sendMessage({ type: "SETTINGS_CHANGED" });
  });
});

load();
