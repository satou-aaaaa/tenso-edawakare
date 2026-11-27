// 転送の枝分かれの問題を作る（ブラウザと node の両方で使う）。
// 1問は、届いた知らせ（うわさ・公的機関の発表）を見て、転送が枝分かれで広がると何段目に何人に届くか・合計は何人か・
// 合計が何人をこえるのは何段目か・どこで止めると何人に届かずにすむかを選ぶ（正解したら2段目「この知らせ、あなたならどうする？」）か、
// 総務省・内閣府・気象庁の資料に書いてあることを選ぶ。
// 枝分かれの決まり（ゲーム用の単純化。実測ではない）：0段目のあなたが N 人に転送し、届いた人もみな N 人に転送する。
//   k 段目に届く人数 = N^k。0段目から k 段目までの合計 = (N^(k+1) − 1) ÷ (N − 1)。
//   m 段目の人が確かめて止めると、その人の先の N + N^2 + … + N^(K−m) 人に届かずにすむ。
// 本物の転送は、同じ人に重ねて届く・転送しない人もいるので、こんなにきれいには増えない。要点は共有フォルダ games/tenso-edawakare-research.md。
// 乱数 R は呼ぶ回数が毎回同じになるように使う（sort の比較の中では引かない）。同じ tag なら、どの端末でも同じ問題になる。
// KINDS・言い回し・知らせの文・まちがいの選び肢は、足すだけでも過去の日の問題が変わる（選ぶ範囲が変わるため）。公開したあとは変えず、変えるときは qa/run.mjs の PINS を作り直して PR に理由を書く。
(function (root) {
  "use strict";
  const LV = ["やさしい", "ふつう", "むずかしい"];

  // 出典（画面の「なぜ」に出す）
  const SRC = {
    soumu: ["総務省「上手にネットと付き合おう！」インターネット上の偽・誤情報", "https://www.soumu.go.jp/use_the_internet_wisely/special/fakenews/"],
    noto: ["総務省「令和6年能登半島地震に関するインターネット上の偽・誤情報にご注意ください。」", "https://www.soumu.go.jp/menu_kyotsuu/important/kinkyu02_000563.html"],
    case21: ["総務省「インターネットトラブル事例集」事例21", "https://www.soumu.go.jp/use_the_internet_wisely/trouble/case/pdf/case21.pdf"],
    hakusho: ["総務省 令和6年版 情報通信白書「災害時における偽・誤情報への対応」", "https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r06/html/nd122c00.html"],
    bousai: ["内閣府 広報誌「ぼうさい」第109号「災害時におけるインターネット上の偽・誤情報について」", "https://www.bousai.go.jp/kohou/kouhoubousai/r05/109/news_03.html"],
    jma: ["気象庁「大地震後の地震活動（余震）について よくある質問」", "https://www.jma.go.jp/jma/kishou/know/jishin/aftershocks/sitsumon_aftershock.html"],
  };

  // 2段目「この知らせ、あなたならどうする？」の3つ。どれが合うかは、知らせの「確かめた」の札で決まる
  const GROUPS = {
    kakunin: { name: "まず確かめる", sub: "公的機関の情報や報道を見る" },
    tomeru: { name: "止める", sub: "転送しない" },
    hiromeru: { name: "広げてよい", sub: "転送する" },
  };
  const GWHY = {
    kakunin: "まだ確かめていない知らせは、広める前に、公的機関の情報や報道で確かめます（総務省）。",
    tomeru: "まちがいと分かった知らせは転送しません。ここで止めれば、あなたの先の枝には届きません。",
    hiromeru: "公的機関の発表と同じだと確かめた知らせです。正しい知らせなら、広げて役に立てられます。",
  };
  // 届いた知らせ（練習のための例。本物の投稿ではない）。ok：公的機関の発表どおりの知らせ。ng：確かめてまちがいと分かったときの札
  const MSGS = [
    { t: "あしたの午後3時に、大きな余震が来るらしい。拡散して！", ok: false, ng: "気象庁は、日時を指定した地震の予知はデマと言える、としている" },
    { t: "この地震は人工地震だって。みんなに知らせて", ok: false },
    { t: "駅前の店に、どろぼうの集団が来ているらしい", ok: false },
    { t: "この口座に寄付を。被災地を助けて！", ok: false },
    { t: "川の堤防が切れたらしい。急いで広めて", ok: false },
    { t: "町の給水は、今日でおしまいだって", ok: false },
    { t: "市の発表：町の小学校に避難所を開きました", ok: true },
    { t: "市の発表：給水車は午後2時に公園へ来ます", ok: true },
    { t: "気象庁の発表：大雨警報が出ました", ok: true },
    { t: "町の発表：川ぞいの道は通行止めです", ok: true },
    { t: "市の発表：あしたのごみの回収は休みです", ok: true },
  ];
  const FROM = ["友だちから転送された", "知らない人の投稿", "グループに流れてきた"];
  const BADGE = { mi: "まだ確かめていない", ng: "確かめた：公的機関の情報に無く、まちがいと分かった", ok: "確かめた：市の公式ページに同じ発表がある" };
  const GRP_OF = { mi: "kakunin", ng: "tomeru", ok: "hiromeru" };

  // part:ri:begin（shared-workflows の template/parts/data/ri.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  // part:ri:end
  // part:shuffle:begin（shared-workflows の template/parts/data/shuffle.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function shuffle(R, a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = ri(R, 0, i); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  // part:shuffle:end
  // part:pickN:begin（shared-workflows の template/parts/data/pickN.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function pickN(R, a, n) { return shuffle(R, a).slice(0, n); }
  // part:pickN:end
  const MEDIA = { dan: "何段目に何人", goukei: "合計は何人", koeru: "何段目でこえる", tomeru: "どこで止める", shiryo: "資料" };

  // 数の書き方：3けたごとに「,」
  const comma = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const ppl = (n) => `${comma(n)}人`;
  const pw = (N, k) => Math.pow(N, k); // k 段目の人数
  const sum = (N, k) => (N === 1 ? k + 1 : (pw(N, k + 1) - 1) / (N - 1)); // 0段目から k 段目までの合計
  const saved = (N, j) => sum(N, j) - 1; // あなたの先 j 段に届く人数（あなたは数えない）

  // 知らせを1つ選び、確かめた札を決める（2段目の答えが決まる）
  // onlyNg：「どこで止める」の問題は、止める話なので、うわさの知らせだけから選ぶ
  function msgOf(R, onlyNg) {
    const ids = MSGS.map((_, i) => i).filter((i) => !onlyNg || !MSGS[i].ok), mi = ids[ri(R, 0, ids.length - 1)], M = MSGS[mi], checked = ri(R, 0, 1) === 1, fi = ri(R, 0, FROM.length - 1);
    const st = checked ? (M.ok ? "ok" : "ng") : "mi";
    return { msg: M.t, from: FROM[fi], st, badge: st === "ng" && M.ng ? "確かめた：" + M.ng : BADGE[st], grp: GRP_OF[st], gwhy: GWHY[GRP_OF[st]], mv: `${mi}.${fi}.${st}` };
  }
  // まちがいの選び肢：trap（いちばんしやすいまちがい）を先に、残りから足す。答えと同じ・0以下・重なりは使わない
  function pickWrong(R, ans, trap, others, n) {
    const ok = (v) => Number.isInteger(v) && v > 0 && v !== ans;
    const t = ok(trap) ? [trap] : [], rest = [...new Set(others.filter((v) => ok(v) && !t.includes(v)))];
    return [...t, ...pickN(R, rest, n - t.length)].slice(0, n);
  }
  const nOpt = (lv) => (lv === 0 ? 2 : 3); // まちがいの数（やさしい2・ほか3）

  // ---- k 段目の人数（id s<N>_<k>）----
  const SSIT = [
    (N, k) => `あなた（0段目）が${N}人に転送し、届いた人もみな${N}人に転送する。${k}段目に届くのは何人？`,
    (N, k) => `1人が${N}人ずつに転送していく。あなたを0段目として、${k}段目は何人？`,
    (N, k) => `この知らせを、みんなが${N}人ずつに転送したら、${k}段目に届くのは何人？`,
  ];
  const S = (lv, N, k) => {
    const a = pw(N, k);
    return { id: `s${N}_${k}`, lv, N, k, num: a, col: "dan", name: `1人が${N}人に・${k}段目：${ppl(a)}`,
      look: `1段進むごとに、人数は${N}倍になります。`, key: `${N}を${k}回かけます。`,
      why: `1段目${N}人、2段目${pw(N, 2)}人と、${N}倍ずつふえます。${k}段目は${N}を${k}回かけて${ppl(a)}。${N * k !== a ? `${N}×${k}＝${N * k}人ではありません。` : ""}`,
      src: ["noto", "case21"],
      make: (R, lv2) => { const si = ri(R, 0, SSIT.length - 1), ds = pickWrong(R, a, N * k, [pw(N, k - 1), pw(N, k + 1), sum(N, k), N + k], nOpt(lv2)), m = msgOf(R);
        return { type: "act", media: MEDIA.dan, q: SSIT[si](N, k), opts: shuffle(R, [a, ...ds]).map(ppl), ans: ppl(a), ...m, v: `${si}:${ds.join(".")}:${m.mv}` }; } };
  };
  // ---- k 段目までの合計（id t<N>_<k>）----
  const TSIT = [
    (N, k) => `あなた（0段目）が${N}人に転送し、届いた人もみな${N}人に転送する。${k}段目まで、あなたもふくめて合計何人？`,
    (N, k) => `1人が${N}人ずつに転送していく。0段目のあなたから${k}段目までで、合計何人？`,
    (N, k) => `みんなが${N}人ずつに転送したら、あなた（0段目）から${k}段目までの合計は何人？`,
  ];
  const T = (lv, N, k) => {
    const a = sum(N, k), parts = Array.from({ length: Math.min(k - 1, 3) + 1 }, (_, i) => comma(pw(N, i))).join("＋"), dots = k > 4 ? "＋…" : "";
    return { id: `t${N}_${k}`, lv, N, k, num: a, col: "goukei", name: `1人が${N}人に・${k}段目までの合計：${ppl(a)}`,
      look: "0段目（あなた）から、各段の人数を足します。", key: `${parts}${dots}＋${comma(pw(N, k))}`,
      why: `${parts}${dots}＋${comma(pw(N, k))}＝${ppl(a)}。式なら（${N}の${k + 1}乗−1）÷（${N}−1）です。`,
      src: ["noto", "case21"],
      make: (R, lv2) => { const si = ri(R, 0, TSIT.length - 1), ds = pickWrong(R, a, pw(N, k), [a - 1, sum(N, k - 1), sum(N, k + 1), N * k + 1], nOpt(lv2)), m = msgOf(R);
        return { type: "act", media: MEDIA.goukei, q: TSIT[si](N, k), opts: shuffle(R, [a, ...ds]).map(ppl), ans: ppl(a), ...m, v: `${si}:${ds.join(".")}:${m.mv}` }; } };
  };
  // ---- 合計が初めて X 人をこえる段（id c<N>_<X>）----
  const CSIT = [
    (N, X) => `1人が${N}人ずつに転送していく。あなた（0段目）もふくめた合計が、初めて${ppl(X)}をこえるのは何段目？`,
    (N, X) => `みんなが${N}人ずつに転送したら、0段目のあなたからの合計が${ppl(X)}をこえるのは何段目？`,
  ];
  const firstOver = (N, X) => { let k = 0; while (sum(N, k) <= X) k++; return k; };
  const C = (lv, N, X) => {
    const a = firstOver(N, X);
    return { id: `c${N}_${X}`, lv, N, k: a, X, num: a, col: "koeru", name: `1人が${N}人に・合計${ppl(X)}をこえる：${a}段目`,
      look: "1段ずつ、合計を足して数えます。", key: `${a - 1}段目までの合計は${ppl(sum(N, a - 1))}です。`,
      why: `${a - 1}段目までで${ppl(sum(N, a - 1))}、${a}段目までで${ppl(sum(N, a))}。初めて${ppl(X)}をこえるのは${a}段目です。`,
      src: ["noto", "case21"],
      make: (R) => { const si = ri(R, 0, CSIT.length - 1), st = Math.max(1, a - ri(R, 0, 3)), m = msgOf(R);
        return { type: "act", media: MEDIA.koeru, q: CSIT[si](N, X), opts: [st, st + 1, st + 2, st + 3].map((x) => `${x}段目`), ans: `${a}段目`, ...m, v: `${si}:${st}:${m.mv}` }; } };
  };
  // ---- どこで止める：m 段目のあなたが止めると、K 段目までで何人に届かずにすむ（id v<N>_<m>_<K>）----
  const VSIT = [
    (N, m, K) => `知らせは${m}段目のあなたに届いた。みんな${N}人ずつに転送する。あなたが止めると、${K}段目までで何人に届かずにすむ？`,
    (N, m, K) => `1人が${N}人ずつに転送。${m}段目のあなたが確かめて止めたら、${K}段目までで何人に届かない？`,
  ];
  const V = (lv, N, m, K) => {
    const j = K - m, a = saved(N, j);
    return { id: `v${N}_${m}_${K}`, lv, N, k: K, m, num: a, col: "tomeru", name: `${m}段目で止める（1人が${N}人に・${K}段目まで）：${ppl(a)}`,
      look: `あなたの先の${j}段だけを数えます。あなたは数えません。`, key: `あなたの1段先は${N}人、${j}段先は${ppl(pw(N, j))}です。`,
      why: `あなたの先は、1段先${N}人${j > 1 ? `…${j}段先${ppl(pw(N, j))}` : ""}。足して${ppl(a)}に届かずにすみます。早く止めるほど多く止まります。`,
      src: ["noto", "case21"],
      make: (R, lv2) => { const si = ri(R, 0, VSIT.length - 1), ds = pickWrong(R, a, pw(N, j), [a + 1, saved(N, K) , N * j, saved(N, j - 1)], nOpt(lv2)), mm = msgOf(R, true);
        return { type: "act", media: MEDIA.tomeru, q: VSIT[si](N, m, K), opts: shuffle(R, [a, ...ds]).map(ppl), ans: ppl(a), ...mm, v: `${si}:${ds.join(".")}:${mm.mv}` }; } };
  };
  // ---- 資料の問題（2段目なし）。ans：答え、ws：まちがいの選び肢の候補、sit：問いの言い方 ----
  function fact(sit, ans, ws) {
    return (R, lv) => {
      const si = ri(R, 0, sit.length - 1), ds = pickN(R, ws, nOpt(lv));
      return { type: "fact", media: MEDIA.shiryo, q: sit[si], opts: shuffle(R, [ans, ...ds]), ans, grp: null, gwhy: "", v: `${si}:${ds.map((d) => ws.indexOf(d)).join(".")}` };
    };
  }
  const F = (id, lv, src, name, look, key, why, sit, ans, ws) => ({ id, lv, num: 0, col: "shiryo", name, look, key, why, src, make: fact(sit, ans, ws) });

  const KINDS = [
    // ---- やさしい ----
    S(0, 2, 2), S(0, 2, 3), S(0, 2, 4), S(0, 2, 5), S(0, 3, 2), S(0, 3, 3), S(0, 3, 4), S(0, 4, 2), S(0, 5, 2), S(0, 10, 2), S(0, 10, 3),
    F("fkaku", 0, ["soumu"], "正しいか分からない情報は、安易に拡散しない", "総務省のすすめです。", "うのみにせず、まず立ち止まります。",
      "総務省は、目にした情報をうのみにせず、正確性が判断できない場合には安易に投稿・拡散しないことが大切、としています。",
      ["正しいか判断できない情報。総務省のすすめは？", "本当か分からない知らせが届いた。総務省がすすめるのは？", "正確性が判断できない情報は、どうする？"],
      "安易に投稿・拡散しない", ["すぐに拡散する", "多くの人に早く送る", "大事そうなら拡散する", "文を少し変えて送る"]),
    F("fkoteki", 0, ["noto"], "真偽の不確かな情報は、公的機関の情報や報道で確かめる", "国や市などの発表を見ます。", "総務省は「公的機関の情報や報道等」で確かめる、としています。",
      "総務省は、真偽の不確かな情報は安易に拡散せず、公的機関の情報や報道等で確かめるよう呼びかけています（能登半島地震のとき）。",
      ["本当か分からない災害の知らせ。何で確かめる？", "真偽の不確かな情報。総務省が言う確かめ先は？", "うわさが本当か、どこで確かめる？"],
      "公的機関の情報や報道", ["転送してきた人の言葉", "「いいね」の数", "同じ文の投稿の多さ", "知らない人の投稿"]),
    F("fochitsuku", 0, ["case21"], "知らせる・広める前に、一度落ち着く", "あわてたときこそです。", "総務省の事例集は「一度落ち着きましょう」と書いています。",
      "災害時に危険を伝える情報を見たら、だれでもあわてます。総務省の事例集は、知らせる・広める前に一度落ち着こう、としています。",
      ["危険を伝える情報を見た。広める前にすることは？", "あわてる知らせが届いた。総務省の事例集のすすめは？", "知らせる・広める前に、まずどうする？"],
      "一度落ち着く", ["すぐに広める", "大きな声で知らせる", "思いつく人全員に送る", "続きを待たずに送る"]),
    // ---- ふつう ----
    S(1, 2, 6), S(1, 2, 8), S(1, 2, 10), S(1, 3, 5), S(1, 3, 6), S(1, 4, 3), S(1, 4, 4), S(1, 5, 3), S(1, 5, 4), S(1, 10, 4), S(1, 10, 5),
    T(1, 2, 2), T(1, 2, 3), T(1, 2, 4), T(1, 3, 2), T(1, 3, 3), T(1, 10, 2), T(1, 10, 3), V(1, 2, 1, 3), V(1, 3, 1, 3), V(1, 2, 2, 4),
    F("fyochi", 1, ["jma"], "日時を指定した地震の予知はデマ", "気象庁の「よくある質問」です。", "今の科学では、日時や場所を決めて予測できません。",
      "気象庁は、今の科学では大きな余震の具体的な日時や場所は予測できず、日時を指定して地震を予知する情報は科学的根拠のないうわさやデマと言える、としています。",
      ["「○月○日に大きな余震」という情報。気象庁は？", "日時を指定した地震の予知。気象庁の答えは？", "「あした大地震が来る」という知らせ。気象庁によると？"],
      "科学的根拠のないうわさやデマ", ["気象庁が出した予知", "よく当たる情報", "専門家の正式な予報", "役所が確かめた情報"]),
    F("fhasshin", 1, ["soumu"], "情報の発信元を確かめる", "だれが書いたかを見ます。", "総務省の「確認方法」の1つです。",
      "総務省は確認方法として、他の情報と比べる・情報の発信元を確かめる・いつ頃書かれたか確かめる・一次情報を確かめる、をあげています。",
      ["総務省があげる、情報の確認方法の1つは？", "うそか本当か。総務省のすすめる確かめ方は？", "偽・誤情報に気をつける確認方法は？"],
      "情報の発信元を確かめる", ["「いいね」の数を見る", "転送した人数を数える", "文の長さを見る", "絵や写真の多さを見る"]),
    F("fyokare", 1, ["case21"], "誤った情報の拡散は、救助のさまたげになる", "救助が必要な人のことです。", "救助が必要な人に届かない場合もあります。",
      "総務省の事例集は、災害時には誤った情報が拡散し、救助のさまたげになり、救助が必要な人に届かない場合もある、としています。",
      ["災害時に誤った情報が広がると、救助はどうなる？", "良かれと思って広めた情報がデマだと、何が起きうる？", "誤った情報の拡散が、救助に与えることは？"],
      "救助のさまたげになる", ["救助が早くなる", "何も変わらない", "救助の人が増える", "救助の場所がよく分かる"]),
    F("fshinrai", 1, ["soumu"], "発信元が分かっても、信頼できるか確かめる", "名前が書いてあっても、です。", "信頼できる人・サイトかを見ます。",
      "総務省は、発信元が明らかであっても、信頼できる人なのか、信頼できるWebサイトなのかを確認しよう、としています。",
      ["発信元の名前が書いてある情報。総務省のすすめは？", "だれが書いたか分かる投稿。それでも見ることは？", "発信元が明らかな情報は、そのまま信じてよい？"],
      "信頼できる人・サイトか確かめる", ["そのまま信じてよい", "すぐ転送してよい", "確かめなくてよい", "有名なら何でも正しい"]),
    F("fyomikurabe", 1, ["soumu"], "複数の情報を読み比べる", "1つだけで決めません。", "総務省の「他の情報と比べてみる」です。",
      "総務省は、ネット検索し、複数の情報を読み比べよう、としています（他の情報と比べてみる）。",
      ["1つの投稿を見た。総務省のすすめは？", "うわさを見たとき、他の情報とは？", "「他の情報と比べてみる」とは？"],
      "複数の情報を読み比べる", ["最初に見た投稿を信じる", "転送の多い投稿を信じる", "1つの投稿だけ読む", "知り合いの話だけ聞く"]),
    // ---- むずかしい ----
    T(2, 2, 6), T(2, 2, 8), T(2, 2, 10), T(2, 3, 4), T(2, 3, 5), T(2, 3, 6), T(2, 4, 3), T(2, 4, 4), T(2, 5, 3), T(2, 5, 4), T(2, 10, 4), T(2, 10, 5),
    C(2, 2, 100), C(2, 2, 1000), C(2, 3, 100), C(2, 3, 1000), C(2, 4, 1000), C(2, 5, 1000), C(2, 10, 10000), C(2, 2, 10000),
    V(2, 2, 1, 6), V(2, 2, 3, 6), V(2, 3, 1, 5), V(2, 3, 2, 5), V(2, 2, 2, 8), V(2, 4, 1, 4), V(2, 5, 1, 4), V(2, 10, 1, 4),
    F("fkyujo", 2, ["hakusho"], "能登半島地震：「救助要請」の投稿は約21,000件", "令和6年版 情報通信白書です。", "1万より多く、10万より少ない数です。",
      "総務省の情報通信白書は、能登半島地震で「救助要請」に関する投稿が約21,000件あったとされる、としています。",
      ["能登半島地震で「救助要請」の投稿は約何件とされる？", "白書の数：能登半島地震の「救助要請」の投稿は？", "能登半島地震、「救助要請」に関する投稿の数は？"],
      "約21,000件", ["約210件", "約2,100件", "約21万件", "約210万件"]),
    F("fjinko", 2, ["hakusho"], "能登半島地震：「人工地震」を含む投稿は約10万件", "令和6年版 情報通信白書です。", "1万より多い数です。",
      "総務省の情報通信白書は、能登半島地震で「人工地震」であるとの言葉を含む投稿が約10万件あった、としています。",
      ["能登半島地震で「人工地震」を含む投稿は約何件？", "白書の数：「人工地震」という言葉を含む投稿は？", "能登半島地震、「人工地震」の投稿の数は？"],
      "約10万件", ["約100件", "約1,000件", "約1万件", "約1,000万件"]),
    F("fkumamoto", 2, ["hakusho"], "熊本地震：救助を求める報告573件のうち偽とみられたのは1件", "令和6年版 情報通信白書です。", "とても少ない数です。",
      "白書は、熊本地震の救助を求める報告（573件）の中で、偽情報とみられたものは1件だった、としています。能登半島地震と比べて書いています。",
      ["熊本地震の救助を求める報告573件。偽とみられたのは？", "白書：熊本地震で、救助の報告のうち偽情報とみられたのは？", "熊本地震の救助を求める報告。偽とみられた数は？"],
      "1件", ["約50件", "約100件", "約300件", "約570件"]),
  ];
  const BY = Object.fromEntries(KINDS.map((k) => [k.id, k]));
  const kindsOf = (lv) => KINDS.filter((k) => k.lv === lv).map((k) => k.id);
  const numKindsOf = (lv) => KINDS.filter((k) => k.lv === lv && k.col !== "shiryo").map((k) => k.id);

  // part:seedOf:begin（shared-workflows の template/parts/data/seedOf.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function seedOf(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // part:seedOf:end
  // part:rng:begin（shared-workflows の template/parts/data/rng.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // part:rng:end

  // 1問を作る。tag は「種類|種」（例 "s3_4|2026-11-27:d0"）。同じ tag ならいつも同じ問題
  function make(tag) {
    const [kind] = String(tag).split("|"), k = Object.prototype.hasOwnProperty.call(BY, kind) ? BY[kind] : null;
    if (!k) return null;
    const p = k.make(rng(seedOf(tag)), k.lv);
    return { tag, kind, lv: k.lv, name: k.name, look: k.look, key: k.key, why: k.why, col: k.col, N: k.N || 0, k: k.k || 0, m: k.m || 0, X: k.X || 0, num: k.num, src: k.src.map((s) => SRC[s]), ...p };
  }
  const keyOf = (P) => `${P.kind}:${P.q}:${P.msg || ""}:${P.st || ""}:${P.opts.slice().sort().join("/")}`;

  // 今日の5問：やさしい2・ふつう2・むずかしい1（むずかしいは数の問題から。核の「どこで止める」「合計」を毎日1問は遊ぶ）
  function dailyTags(date) {
    const R = rng(seedOf("day:" + date)), e = pickN(R, kindsOf(0), 2), n = pickN(R, kindsOf(1), 2), h = pickN(R, numKindsOf(2), 1);
    return [...e, ...n, ...h].map((id, i) => `${id}|${date}:d${i}`);
  }
  function hardTags(date) {
    const dh = dailyTags(date)[4].split("|")[0], R = rng(seedOf("hard:" + date)), h = pickN(R, kindsOf(2).filter((x) => x !== dh), 3);
    return h.map((id, i) => `${id}|${date}:h${i}`);
  }

  const TSE = { KINDS, BY, GROUPS, GWHY, MSGS, BADGE, FROM, LV, SRC, MEDIA, comma, ppl, pw, sum, saved, firstOver, kindsOf, numKindsOf, seedOf, rng, make, keyOf, dailyTags, hardTags, pickN };
  if (typeof module !== "undefined" && module.exports) module.exports = TSE; else root.TSE = TSE;
})(typeof self !== "undefined" ? self : this);
