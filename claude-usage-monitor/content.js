(() => {
  "use strict";

  const USAGE_HASH = "#settings/usage";
  let sentSignature = "";
  let timer;

  function isUsagePage() {
    return location.hash.startsWith(USAGE_HASH) ||
      /usage|limit|session|week|사용량|한도/i.test(document.body?.innerText || "");
  }

  function collect() {
    if (!isUsagePage()) return;
    const metrics = ClaudeUsageParser.parseUsageText(document.body?.innerText || "");
    if (!Object.keys(metrics).length) return;

    const signature = JSON.stringify(metrics);
    if (signature === sentSignature) return;
    sentSignature = signature;

    chrome.runtime.sendMessage({
      type: "USAGE_CAPTURED",
      payload: {
        metrics,
        capturedAt: Date.now(),
        sourceUrl: location.href
      }
    });
  }

  function scheduleCollect() {
    clearTimeout(timer);
    timer = setTimeout(collect, 700);
  }

  scheduleCollect();
  setTimeout(collect, 2500);
  setTimeout(collect, 6000);
  new MutationObserver(scheduleCollect).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });
})();
