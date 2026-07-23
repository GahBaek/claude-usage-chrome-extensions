(function (root) {
  "use strict";

  const LABELS = [
    { key: "session", patterns: ["current session", "session limit", "현재 세션"] },
    { key: "weekly", patterns: ["weekly limit", "all models", "주간 한도", "모든 모델"] },
    { key: "sonnet", patterns: ["sonnet only", "sonnet", "소넷"] },
    { key: "opus", patterns: ["opus only", "opus", "오푸스"] }
  ];

  function clean(text) {
    return String(text || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
  }

  function nearbyUsage(lines, index) {
    for (let offset = 0; offset <= 4 && index + offset < lines.length; offset += 1) {
      const match = lines[index + offset].match(
        /(\d{1,3}(?:\.\d+)?)\s*%\s*(?:used|사용(?:됨|되었| 중)?)/i
      );
      if (match) {
        return {
          percentage: Math.min(100, Number(match[1])),
          distance: offset
        };
      }
    }
    return null;
  }

  function parseUsageText(text) {
    const lines = clean(text).split(/\n+/).map(clean).filter(Boolean);
    const metrics = {};

    for (const label of LABELS) {
      const candidates = [];
      lines.forEach((line, index) => {
        if (!label.patterns.some((pattern) => line.toLowerCase().includes(pattern))) return;
        const usage = nearbyUsage(lines, index);
        if (usage) candidates.push({ index, ...usage });
      });

      candidates.sort((a, b) => a.distance - b.distance || b.index - a.index);
      const best = candidates[0];
      if (best) {
        metrics[label.key] = {
          label: lines[best.index].slice(0, 80),
          percentage: best.percentage
        };
      }
    }

    if (!Object.keys(metrics).length) {
      lines.forEach((line, index) => {
        const usage = nearbyUsage(lines, index);
        if (usage && /limit|usage|session|week|사용|한도/i.test(line)) {
          const key = `usage${Object.keys(metrics).length + 1}`;
          metrics[key] = { label: line.slice(0, 80), percentage: usage.percentage };
        }
      });
    }

    return metrics;
  }

  const api = { parseUsageText };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ClaudeUsageParser = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
