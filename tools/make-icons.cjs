// アプリのアイコン（icon-192.png・icon-512.png）を作る。紺の地に、1人から3人・9人へ広がる枝分かれの木。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#123554"/>
      <g stroke="#cfd8e6" stroke-width="2.5"><path d="M50 20 L20 50 M50 20 L50 50 M50 20 L80 50"/><path d="M20 50 L10 80 M20 50 L20 80 M20 50 L30 80 M50 50 L40 80 M50 50 L50 80 M50 50 L60 80 M80 50 L70 80 M80 50 L80 80 M80 50 L90 80"/></g>
      <circle cx="50" cy="20" r="9" fill="#e0573c"/><g fill="#7fc4ef"><circle cx="20" cy="50" r="7"/><circle cx="50" cy="50" r="7"/><circle cx="80" cy="50" r="7"/></g>
      <g fill="#fffdf7">${[10, 20, 30, 40, 50, 60, 70, 80, 90].map((x) => `<circle cx="${x}" cy="80" r="4"/>`).join("")}</g></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
