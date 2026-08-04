// =============================================================================
// js/app.js
// -----------------------------------------------------------------------------
// MAIN APPLICATION ENTRY POINT.
// This file contains:
//   1. Every original interactive behavior from the static site, preserved
//      exactly as-is (theme toggle, mobile nav, scroll progress, cookie
//      notice, calculator logic, the investor-style quiz, newsletter
//      "subscribe" UI, copy-link, table-of-contents scroll-spy, and the
//      reveal-on-scroll animation).
//   2. A small helper that replaces hardcoded dates (e.g. "June 26, 2026")
//      with today's real date wherever a `[data-current-date]` element
//      exists in the markup.
//
// Loaded as: <script type="module" src="js/app.js"></script>
// =============================================================================

// ---------------------------------------------------------------------------
// THEME (dark / light mode toggle) — unchanged from the original site.
// ---------------------------------------------------------------------------
const html = document.documentElement;
const themeIcon = document.getElementById("theme-icon");
const darkToggleBtn = document.getElementById("dark-toggle");
const savedTheme = localStorage.getItem("theme") || "light";
html.setAttribute("data-theme", savedTheme);
if (themeIcon) themeIcon.textContent = savedTheme === "dark" ? "☀️" : "🌙";
if (darkToggleBtn) darkToggleBtn.setAttribute("aria-pressed", savedTheme === "dark" ? "true" : "false");

document.getElementById("dark-toggle")?.addEventListener("click", () => {
  const current = html.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  if (themeIcon) themeIcon.textContent = next === "dark" ? "☀️" : "🌙";
  if (darkToggleBtn) darkToggleBtn.setAttribute("aria-pressed", next === "dark" ? "true" : "false");
});

// ---------------------------------------------------------------------------
// HAMBURGER (mobile nav toggle) — unchanged.
// ---------------------------------------------------------------------------
document.getElementById("hamburger")?.addEventListener("click", (e) => {
  const nav = document.getElementById("main-nav");
  const isOpen = nav?.classList.toggle("open");
  e.currentTarget.setAttribute("aria-expanded", isOpen ? "true" : "false");
});

// ---------------------------------------------------------------------------
// SCROLL (sticky header shadow, back-to-top button, reading progress bar)
// — unchanged.
// ---------------------------------------------------------------------------
window.addEventListener("scroll", () => {
  document.getElementById("site-header")?.classList.toggle("scrolled", scrollY > 50);
  document.getElementById("back-top")?.classList.toggle("visible", scrollY > 400);
  const progressBar = document.getElementById("progress-bar");
  if (progressBar) {
    const pct = Math.min(
      (scrollY / (document.body.scrollHeight - innerHeight)) * 100,
      100
    );
    progressBar.style.width = pct + "%";
  }
});

// ---------------------------------------------------------------------------
// COOKIE / AD CONSENT
// -----------------------------------------------------------------------------
// Accept -> personalized ads. Reject -> non-personalized ads only.
// loadAds() currently returns early (see note inside) because AdSense is
// not yet approved — the site has no publisher ID yet. Once approved,
// remove the early "return" line inside loadAds() and paste the real
// ca-pub-XXXXXXXXXXXXXXXX ID into the script.src line.
// ---------------------------------------------------------------------------
window.acceptCookies = function acceptCookies() {
  document.getElementById("cookie-notice")?.classList.add("hidden");
  localStorage.setItem("adConsent", "granted");
  loadAds();
};

window.rejectCookies = function rejectCookies() {
  document.getElementById("cookie-notice")?.classList.add("hidden");
  localStorage.setItem("adConsent", "denied");
  loadAds(true); // non-personalized fallback
};

function loadAds(nonPersonalized = false) {
  // AdSense not yet approved — site is still under construction and has
  // no publisher ID. Remove this "return" once you have a real
  // ca-pub-XXXXXXXXXXXXXXXX ID and have pasted it into script.src below.
  return;

  if (nonPersonalized) {
    window.adsbygoogle = window.adsbygoogle || [];
    adsbygoogle.requestNonPersonalizedAds = 1;
  }
  const script = document.createElement("script");
  script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=YOUR_PUBLISHER_ID";
  script.async = true;
  script.crossOrigin = "anonymous";
  document.head.appendChild(script);
}

function showBanner() {
  document.getElementById("cookie-notice")?.classList.remove("hidden");
}

const adConsent = localStorage.getItem("adConsent");
if (adConsent === "granted") loadAds();
else if (adConsent === "denied") loadAds(true);
else showBanner();

// ---------------------------------------------------------------------------
// CALCULATOR TABS — unchanged.
// ---------------------------------------------------------------------------
document.querySelectorAll(".calc-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".calc-tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".calc-panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("calc-" + tab.dataset.calc)?.classList.add("active");
  });
});

// ---------------------------------------------------------------------------
// CURRENCY FORMAT HELPERS — unchanged.
// ---------------------------------------------------------------------------
function fmt(n) {
  if (n >= 1e7) return "₹" + (n / 1e7).toFixed(1) + " Cr";
  if (n >= 1e5) return "₹" + (n / 1e5).toFixed(1) + "L";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
function fmtS(n) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

// ---------------------------------------------------------------------------
// SIP CALCULATOR — unchanged.
// ---------------------------------------------------------------------------
function calcSIP() {
  const m = +document.getElementById("sip-amount").value;
  const r = +document.getElementById("sip-rate").value / 100 / 12;
  const mo = +document.getElementById("sip-years").value * 12;
  document.getElementById("sip-amount-val").textContent = fmtS(m);
  document.getElementById("sip-rate-val").textContent =
    (+document.getElementById("sip-rate").value).toFixed(1) + "%";
  document.getElementById("sip-years-val").textContent =
    document.getElementById("sip-years").value + " yrs";
  const tot = m * (((Math.pow(1 + r, mo) - 1) / r) * (1 + r));
  const inv = m * mo;
  const gain = tot - inv;
  document.getElementById("sip-total").textContent = fmt(tot);
  document.getElementById("sip-invested").textContent = fmt(inv);
  document.getElementById("sip-gains").textContent = fmt(gain);
  const circ = 2 * Math.PI * 50;
  const ip = (inv / tot) * circ;
  const gp = (gain / tot) * circ;
  const di = document.getElementById("donut-invested");
  const dg = document.getElementById("donut-gain");
  if (di) di.style.strokeDasharray = `${ip} ${circ}`;
  if (dg) {
    dg.style.strokeDasharray = `${gp} ${circ}`;
    dg.style.strokeDashoffset = `-${ip}`;
  }
}

// ---------------------------------------------------------------------------
// EMI CALCULATOR — unchanged.
// ---------------------------------------------------------------------------
function calcEMI() {
  const P = +document.getElementById("emi-amount").value;
  const a = +document.getElementById("emi-rate").value;
  const y = +document.getElementById("emi-years").value;
  document.getElementById("emi-amount-val").textContent = fmtS(P);
  document.getElementById("emi-rate-val").textContent = a.toFixed(2) + "%";
  document.getElementById("emi-years-val").textContent = y + " yrs";
  const r = a / 100 / 12;
  const n = y * 12;
  const emi = r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const tot = emi * n;
  document.getElementById("emi-val").textContent = fmtS(emi);
  document.getElementById("emi-principal").textContent = fmtS(P);
  document.getElementById("emi-interest").textContent = fmtS(tot - P);
  document.getElementById("emi-total").textContent = fmtS(tot);
}

// ---------------------------------------------------------------------------
// FD CALCULATOR — unchanged.
// ---------------------------------------------------------------------------
function calcFD() {
  const P = +document.getElementById("fd-amount").value;
  const r = +document.getElementById("fd-rate").value / 100;
  const t = +document.getElementById("fd-years").value;
  const n = 4;
  document.getElementById("fd-amount-val").textContent = fmtS(P);
  document.getElementById("fd-rate-val").textContent =
    (+document.getElementById("fd-rate").value).toFixed(2) + "%";
  document.getElementById("fd-years-val").textContent = t + " yrs";
  const mat = P * Math.pow(1 + r / n, n * t);
  document.getElementById("fd-maturity").textContent = fmtS(mat);
  document.getElementById("fd-principal").textContent = fmtS(P);
  document.getElementById("fd-interest").textContent = fmtS(mat - P);
}

// ---------------------------------------------------------------------------
// COMPOUND INTEREST CALCULATOR — unchanged.
// ---------------------------------------------------------------------------
function calcCI() {
  const P = +document.getElementById("ci-amount").value;
  const r = +document.getElementById("ci-rate").value / 100;
  const t = +document.getElementById("ci-years").value;
  document.getElementById("ci-amount-val").textContent = fmtS(P);
  document.getElementById("ci-rate-val").textContent =
    (+document.getElementById("ci-rate").value).toFixed(1) + "%";
  document.getElementById("ci-years-val").textContent = t + " yrs";
  const tot = P * Math.pow(1 + r, t);
  document.getElementById("ci-total").textContent = fmtS(tot);
  document.getElementById("ci-principal").textContent = fmtS(P);
  document.getElementById("ci-interest").textContent = fmtS(tot - P);
}

// ---------------------------------------------------------------------------
// RETIREMENT CALCULATOR — unchanged.
// ---------------------------------------------------------------------------
function calcRetire() {
  const age = +document.getElementById("ret-age").value;
  const exp = +document.getElementById("ret-expense").value;
  const ret = +document.getElementById("ret-return").value / 100;
  document.getElementById("ret-age-val").textContent = age + " yrs";
  document.getElementById("ret-expense-val").textContent = fmtS(exp);
  document.getElementById("ret-return-val").textContent =
    (+document.getElementById("ret-return").value).toFixed(1) + "%";
  const yrs = Math.max(60 - age, 1);
  const adj = exp * Math.pow(1.06, yrs) * 12;
  const corpus = adj / 0.04;
  const r = ret / 12;
  const n = yrs * 12;
  const sip = r === 0 ? corpus / n : (corpus * r) / (Math.pow(1 + r, n) - 1);
  document.getElementById("ret-corpus").textContent = fmt(corpus);
  document.getElementById("ret-years").textContent = yrs + " yrs";
  document.getElementById("ret-sip").textContent = fmtS(sip) + "/mo";
}

// ---------------------------------------------------------------------------
// TAX REGIME CALCULATOR (New vs Old) — unchanged.
// ---------------------------------------------------------------------------
function nRT(t) {
  const s = [
    [400000, 0],
    [800000, 0.05],
    [1200000, 0.1],
    [1600000, 0.15],
    [2000000, 0.2],
    [2400000, 0.25],
    [Infinity, 0.3],
  ];
  let x = 0,
    p = 0;
  for (const [l, r] of s) {
    if (t <= p) break;
    x += (Math.min(t, l) - p) * r;
    p = l;
  }
  if (t <= 1200000) x = 0;
  return x * 1.04;
}
function oRT(t) {
  const s = [
    [250000, 0],
    [500000, 0.05],
    [1000000, 0.2],
    [Infinity, 0.3],
  ];
  let x = 0,
    p = 0;
  for (const [l, r] of s) {
    if (t <= p) break;
    x += (Math.min(t, l) - p) * r;
    p = l;
  }
  if (t <= 500000) x = 0;
  return x * 1.04;
}
function calcTax() {
  const inc = +document.getElementById("tax-income").value;
  const ded = +document.getElementById("tax-deductions").value;
  const hra = +document.getElementById("tax-hra").value;
  document.getElementById("tax-income-val").textContent = fmtS(inc);
  document.getElementById("tax-deductions-val").textContent = fmtS(ded);
  document.getElementById("tax-hra-val").textContent = fmtS(hra);
  const nT = nRT(Math.max(inc - 75000, 0));
  const oT = oRT(Math.max(inc - 50000 - Math.min(ded, 150000) - hra, 0));
  document.getElementById("tax-new-amount").textContent = fmt(nT);
  document.getElementById("tax-old-amount").textContent = fmt(oT);
  const nc = document.getElementById("tax-new-card");
  const oc = document.getElementById("tax-old-card");
  const nb = document.getElementById("tax-new-badge");
  const ob = document.getElementById("tax-old-badge");
  nc.classList.remove("winner");
  oc.classList.remove("winner");
  nb.style.display = "none";
  ob.style.display = "none";
  const diff = Math.abs(nT - oT);
  const v = document.getElementById("tax-verdict");
  if (nT < oT) {
    nc.classList.add("winner");
    nb.style.display = "inline-block";
    v.innerHTML = `The <strong>New Regime</strong> saves you ${fmt(diff)} vs the Old Regime.`;
  } else if (oT < nT) {
    oc.classList.add("winner");
    ob.style.display = "inline-block";
    v.innerHTML = `The <strong>Old Regime</strong> saves you ${fmt(diff)} vs the New Regime.`;
  } else {
    v.innerHTML = "Both regimes result in the same tax at this income and deduction level.";
  }
}

// ---------------------------------------------------------------------------
// GOAL PLANNER CALCULATOR — unchanged.
// ---------------------------------------------------------------------------
function setGoalPreset(btn) {
  document.querySelectorAll(".goal-preset-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("goal-amount").value = btn.dataset.amount;
  document.getElementById("goal-years").value = btn.dataset.years;
  calcGoal();
}
function calcGoal() {
  const g = +document.getElementById("goal-amount").value;
  const y = +document.getElementById("goal-years").value;
  const rate = +document.getElementById("goal-rate").value / 100;
  document.getElementById("goal-amount-val").textContent = fmtS(g);
  document.getElementById("goal-years-val").textContent = y + " yrs";
  document.getElementById("goal-rate-val").textContent =
    (+document.getElementById("goal-rate").value).toFixed(1) + "%";
  const r = rate / 12;
  const n = y * 12;
  const sip = r === 0 ? g / n : (g * r) / ((Math.pow(1 + r, n) - 1) * (1 + r));
  const inv = sip * n;
  document.getElementById("goal-sip").textContent = fmtS(sip) + "/mo";
  document.getElementById("goal-invested").textContent = fmt(inv);
  document.getElementById("goal-gains").textContent = fmt(Math.max(g - inv, 0));
  document.getElementById("goal-target").textContent = fmt(g);
}

// Expose calculator functions globally since the existing HTML calls them
// via inline oninput="calcSIP()" etc. attributes — preserving the original
// markup exactly as requested (no HTML structure changes required here).
window.calcSIP = calcSIP;
window.calcEMI = calcEMI;
window.calcFD = calcFD;
window.calcCI = calcCI;
window.calcRetire = calcRetire;
window.calcTax = calcTax;
window.setGoalPreset = setGoalPreset;
window.calcGoal = calcGoal;

// Run all calculators once on load so result panels show correct defaults.
// Guarded: these calculators only exist on the homepage, so on article/
// legal pages this would otherwise throw on the very first missing input
// element and silently stop every script below this point from running
// (including the FAQ accordion, date stamping, etc). Each call is wrapped
// so a missing element on one calculator can't take down the others or
// anything that runs after this block.
[calcSIP, calcEMI, calcFD, calcCI, calcRetire, calcTax, calcGoal].forEach((fn) => {
  try {
    fn();
  } catch (e) {
    // Calculator not present on this page — nothing to do.
  }
});

// ---------------------------------------------------------------------------
// INVESTOR-STYLE QUIZ — unchanged.
// ---------------------------------------------------------------------------
const QS = [
  {
    text: "A friend offers you a 'guaranteed' investment tip. What's your first move?",
    opts: [
      { l: "Politely decline — I don't take stock tips", t: "saver" },
      { l: "Ask which mutual fund category it falls under", t: "builder" },
      { l: "Research it myself before deciding", t: "grower" },
      { l: "Pull up the company's financials right away", t: "analyst" },
    ],
  },
  {
    text: "Markets just dropped 15% in a month. What do you do?",
    opts: [
      { l: "Move money to FDs to feel safe", t: "saver" },
      { l: "Keep my SIPs running and don't check the app", t: "builder" },
      { l: "See it as a buying opportunity", t: "grower" },
      { l: "Dig into why it dropped and which sectors got hit", t: "analyst" },
    ],
  },
  {
    text: "How do you feel about checking your portfolio?",
    opts: [
      { l: "Rarely — it stresses me out", t: "saver" },
      { l: "Monthly, to track progress toward a goal", t: "builder" },
      { l: "Occasionally, mostly to rebalance", t: "grower" },
      { l: "Often — I genuinely enjoy following the market", t: "analyst" },
    ],
  },
  {
    text: "Pick your ideal investment horizon for new money.",
    opts: [
      { l: "Under 2 years — I want quick access", t: "saver" },
      { l: "3–7 years, tied to a specific goal", t: "builder" },
      { l: "10+ years — I can ride out the ups and downs", t: "grower" },
      { l: "Depends entirely on the opportunity", t: "analyst" },
    ],
  },
  {
    text: "Which sentence sounds most like you?",
    opts: [
      { l: '"I just want my money safe and growing a little."', t: "saver" },
      { l: '"I want a plan to reach specific goals."', t: "builder" },
      { l: '"I\'m fine with ups and downs for bigger growth."', t: "grower" },
      { l: '"I like understanding exactly what I\'m investing in."', t: "analyst" },
    ],
  },
];

const RES = {
  saver: {
    icon: "🛡️",
    title: "The Cautious Saver",
    desc: "Safety and stability come first for you — a completely valid foundation. Build rock-solid fundamentals before taking on market risk.",
    links: [
      { s: "emergency-fund-planning-guide", l: "Emergency Fund Planning Guide" },
      { s: "tax-saving-india-guide", l: "Tax Saving in India: Beginner Guide" },
    ],
  },
  builder: {
    icon: "🎯",
    title: "The Steady Builder",
    desc: "You think in goals, not just numbers. You're well suited to structured, goal-based investing with a clear timeline for each rupee.",
    links: [
      { s: "how-much-invest-in-sip-every-month", l: "How Much to Invest in SIP Every Month?" },
      { s: "best-mutual-funds-for-beginners-india", l: "Mutual Funds for Beginners" },
    ],
  },
  grower: {
    icon: "🌱",
    title: "The Growth Seeker",
    desc: "You can stomach volatility because you're playing the long game. With a 10+ year horizon, you're positioned to benefit from equity's compounding power.",
    links: [
      { s: "fundamental-analysis-stock-market-india", l: "How to Analyse a Stock Before Buying" },
      { s: "best-mutual-funds-for-beginners-india", l: "Mutual Funds: Complete Guide" },
    ],
  },
  analyst: {
    icon: "📊",
    title: "The Hands-On Investor",
    desc: "You don't just want to invest — you want to understand what you're investing in. You'd enjoy going deeper into company analysis and market mechanics.",
    links: [
      { s: "fundamental-analysis-stock-market-india", l: "Fundamental Analysis: Beginner Guide" },
      { s: "tax-saving-india-guide", l: "Tax Saving: Complete Guide" },
    ],
  },
};

let ans = [];
let step = 0;

function quizStart() {
  ans = [];
  step = 0;
  document.getElementById("quiz-intro-view").style.display = "none";
  document.getElementById("quiz-result-view").style.display = "none";
  document.getElementById("quiz-question-view").style.display = "block";
  quizRender();
}
function quizRender() {
  const q = QS[step];
  document.getElementById("quiz-progress").innerHTML = QS.map(
    (_, i) => `<div class="quiz-progress-dot ${i < step ? "done" : ""}"></div>`
  ).join("");
  document.getElementById("quiz-question-text").textContent = q.text;
  document.getElementById("quiz-options").innerHTML = q.opts
    .map((o) => `<button class="quiz-option" onclick="quizAns('${o.t}')">${o.l}</button>`)
    .join("");
}
function quizAns(t) {
  ans.push(t);
  step++;
  if (step < QS.length) {
    quizRender();
  } else {
    const c = {};
    ans.forEach((t) => {
      c[t] = (c[t] || 0) + 1;
    });
    let w = ans[0];
    let m = 0;
    Object.keys(c).forEach((t) => {
      if (c[t] > m) {
        m = c[t];
        w = t;
      }
    });
    const r = RES[w];
    document.getElementById("quiz-question-view").style.display = "none";
    document.getElementById("quiz-result-view").style.display = "block";
    document.getElementById("quiz-result-icon").textContent = r.icon;
    document.getElementById("quiz-result-title").textContent = r.title;
    document.getElementById("quiz-result-desc").textContent = r.desc;
    document.getElementById("quiz-result-links").innerHTML = r.links
      .map((l) => `<a href="articles/${l.s}.html">${l.l}<span>→</span></a>`)
      .join("");
  }
}

window.quizStart = quizStart;
window.quizAns = quizAns;

// ---------------------------------------------------------------------------
// NEWSLETTER SUBSCRIBE BUTTON FEEDBACK — unchanged.
// ---------------------------------------------------------------------------
window.subscribeNewsletter = function subscribeNewsletter(e) {
  e.preventDefault();
  const b = e.target.querySelector("button[type=submit]");
  const i = e.target.querySelector("input[type=email]");
  if (b) {
    b.textContent = "✅ Subscribed!";
    b.disabled = true;
  }
  if (i) i.value = "";
  setTimeout(() => {
    if (b) {
      b.textContent = "Subscribe Free";
      b.disabled = false;
    }
  }, 3000);
};

// ---------------------------------------------------------------------------
// COPY LINK BUTTON — unchanged.
// ---------------------------------------------------------------------------
document.getElementById("copy-link")?.addEventListener("click", () => {
  navigator.clipboard.writeText(location.href).then(() => {
    const b = document.getElementById("copy-link");
    b.textContent = "✅";
    setTimeout(() => {
      b.textContent = "🔗";
    }, 2000);
  });
});

// ---------------------------------------------------------------------------
// TABLE OF CONTENTS SCROLL-SPY — unchanged.
// ---------------------------------------------------------------------------
const tocLinks = document.querySelectorAll(".toc-link");
const tocObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        tocLinks.forEach((l) => l.classList.remove("active"));
        document.querySelector(`.toc-link[href="#${e.target.id}"]`)?.classList.add("active");
      }
    });
  },
  { threshold: 0.4, rootMargin: "-60px 0px -40% 0px" }
);
document.querySelectorAll(".article-section[id]").forEach((s) => tocObserver.observe(s));

// ---------------------------------------------------------------------------
// REVEAL-ON-SCROLL ANIMATION — unchanged.
// ---------------------------------------------------------------------------
const revealEls = document.querySelectorAll(
  ".article-card,.cat-card,.art-list-item,.market-card,.tl-item,.related-card,.pillar-card"
);
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.style.opacity = "1";
        e.target.style.transform = "translateY(0)";
      }
    });
  },
  { threshold: 0.05 }
);
revealEls.forEach((el) => {
  el.style.opacity = "0";
  el.style.transform = "translateY(12px)";
  el.style.transition = "opacity .45s ease,transform .45s ease";
  revealObserver.observe(el);
});

// ---------------------------------------------------------------------------
// FAQ ACCORDION (used on article/guide pages under articles/*.html) —
// ported from the standalone content build's script.js since those pages
// no longer load their own script.js (everything now runs through this
// single app.js). Click a question to expand/collapse its answer; CSS
// (see "ARTICLE & GUIDE PAGES" block in css/style.css) handles the
// max-height transition and the rotating "+" icon via the .open class.
// ---------------------------------------------------------------------------
document.querySelectorAll(".faq-item").forEach((item) => {
  const btn = item.querySelector(".faq-question");
  const answer = item.querySelector(".faq-answer");
  btn?.addEventListener("click", () => {
    const isOpen = item.classList.contains("open");
    item.classList.toggle("open", !isOpen);
    if (answer) answer.style.maxHeight = isOpen ? null : answer.scrollHeight + "px";
  });
});

// ---------------------------------------------------------------------------
// CURRENT DATE — replaces all hardcoded dates automatically.
// Any element with [data-current-date] gets today's date in "June 27,
// 2026" style. Any element with [data-current-date="short"] gets a
// shorter "Jun 27, 2026" form.
// ---------------------------------------------------------------------------
function renderCurrentDates() {
  const today = new Date();
  const long = today.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const short = today.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const year = String(today.getFullYear());

  document.querySelectorAll("[data-current-date]").forEach((el) => {
    const format = el.getAttribute("data-current-date");
    if (format === "short") el.textContent = short;
    else if (format === "year") el.textContent = year;
    else el.textContent = long;
  });
}

// ---------------------------------------------------------------------------
// renderCurrentDates() covers every hardcoded date on the page (article
// dateline, footer copyright year context, etc.) so nothing manual is
// left behind. Live market/news/timeline modules were removed.
// ---------------------------------------------------------------------------
renderCurrentDates();
