// SNS で貼られたときの絵（og.png 1200×630）を作る。今日の問題（答え）は入れず、遊び方の例だけ（1人が3人に転送すると、4段目は何人？）。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const line = (t, ok) => `<div style="position:relative;font-size:30px;font-weight:700;padding:10px ${ok ? "150px" : "20px"} 10px 20px;border-radius:12px;background:#fff;border:${ok ? "5px solid #b23a24" : "3px solid #1d2a3f55"}">${t}${ok ? `<span style="position:absolute;right:16px;top:50%;transform:translateY(-50%) rotate(-8deg);border:4px solid #83261a;color:#83261a;border-radius:8px;padding:0 10px;font-size:28px;font-weight:900">正解</span>` : ""}</div>`;
  // 1人が3人に転送する木（0〜3段目）
  const W = 420, rows = [];
  for (let i = 0; i <= 3; i++) { const c = 3 ** i; rows.push(Array.from({ length: c }, (_, j) => [((j + 0.5) * W) / c, i * 52 + 20])); }
  let svg = "";
  for (let i = 1; i <= 3; i++) rows[i].forEach(([x, y], j) => { const [px, py] = rows[i - 1][Math.floor(j / 3)]; svg += `<line x1="${px}" y1="${py}" x2="${x}" y2="${y}" stroke="#6b7a90" stroke-width="2"/>`; });
  rows.forEach((r, i) => r.forEach(([x, y]) => { svg += `<circle cx="${x}" cy="${y}" r="${[16, 12, 8, 5][i]}" fill="${i ? "#1f4f7a" : "#b23a24"}"/>`; }));
  await p.setContent(`<body style="margin:0;font-family:'Noto Sans CJK JP','IPAPGothic',sans-serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:40px 56px;background:#f1f0ea;color:#1d2a3f;display:flex;gap:44px;align-items:center">
    <div style="flex:0 0 440px">
      <div style="font-size:30px;color:#123554;letter-spacing:.06em">うわさは木の枝のように</div>
      <div style="font-size:72px;font-weight:900;margin-top:6px;line-height:1.15;color:#123554">転送の<br><span style="color:#1f4f7a">枝分かれ</span></div>
      <svg width="${W}" height="190" viewBox="0 0 ${W} 190" style="margin-top:14px">${svg}</svg>
    </div>
    <div style="flex:1;background:#fffdf7;border:4px solid #1d2a3f;border-radius:8px;overflow:hidden">
      <div style="font-size:30px;font-weight:700;padding:22px 20px 6px">🌳 1人が3人に転送すると、4段目は何人？</div>
      <div style="display:flex;flex-direction:column;gap:10px;padding:16px">${line("12人")}${line("81人", 1)}${line("121人")}</div>
      <div style="font-size:24px;padding:0 20px 18px;color:#4c5568">どこで確かめて止める？</div>
    </div>
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
