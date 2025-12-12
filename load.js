(async () => {
  // ============= CONFIG ============
  const BASE = "https://295a378ce402.ngrok-free.app"; // <-- đổi nếu cần
  const ENDPOINT_SOLVE = `${BASE}/asdsandsa`;
  const ENDPOINT_ASK   = `${BASE}/ask`;

  // ============= Load Material Symbols + marked ============
  const loadCSS = href => new Promise((res, rej) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    l.onload = res; l.onerror = rej;
    document.head.appendChild(l);
  });
  await loadCSS("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0,0");

  const lib = await fetch("https://cdn.jsdelivr.net/npm/marked/marked.min.js").then(r => r.text());
  // eslint-disable-next-line no-eval
  eval(lib);

  // ============= Helpers ============
  const $ = sel => document.getElementById(sel);
  const qs = sel => document.querySelector(sel);
  const qsa = sel => Array.from(document.querySelectorAll(sel));

  async function postJSON(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const txt = await res.text().catch(()=>"");
      throw new Error(`HTTP ${res.status} ${txt}`);
    }
    return res.json();
  }

  const getVisibleText = () => {
    const elements = Array.from(document.querySelectorAll("body *"));
    const texts = new Set();

    for (const el of elements) {
      const st = getComputedStyle(el);
      if (
        st.display !== "none" &&
        st.visibility !== "hidden" &&
        el.offsetWidth > 0 &&
        el.offsetHeight > 0 &&
        !["SCRIPT","STYLE","NOSCRIPT"].includes(el.tagName)
      ) {
        const t = el.innerText.trim();
        if (t) texts.add(t);
      }
    }

    // Loại bỏ các text là substring của text khác để tránh lặp
    const out = Array.from(texts).filter(t =>
      !Array.from(texts).some(other => other !== t && other.includes(t))
    );

    return out.join("\n");
  };

  // ============= Remove old UI if exists ============
  const old = document.getElementById("hiddenResult");
  if (old) old.remove();

  // ============= Build UI ============
  const wrapper = document.createElement("div");
  wrapper.id = "hiddenResult";
  wrapper.style.display = "none";
  wrapper.innerHTML = `
    <style>
      /* Material symbol helper */
      .ms { font-family: 'Material Symbols Outlined'; font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; font-size: 18px; vertical-align: middle; }

      @keyframes popIn { from{opacity:0; transform:scale(.96) translateY(22px);} to{opacity:1; transform:scale(1) translateY(0);} }
      @keyframes popOut { from{opacity:1; transform:scale(1) translateY(0);} to{opacity:0; transform:scale(.96) translateY(22px);} }

      /* Container */
      #hiddenResult {
        position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%);
        width: 94%; max-width: 760px;
        background: rgba(30,30,30,.86);
        backdrop-filter: blur(12px) saturate(120%);
        color: #f5f5f5; border-radius: 16px; padding: 14px 16px;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        font-size: 15px; line-height: 1.62;
        box-shadow: 0 12px 36px rgba(0,0,0,.5);
        display:flex; flex-direction:column; z-index: 2147483647;
        user-select: text;
        transition: box-shadow .28s ease, border .28s ease, transform .16s ease, backdrop-filter .3s ease, background .3s ease;
        border: 1px solid rgba(255,255,255,0.03);
      }
      #hiddenResult.light { background: rgba(255,255,255,.98); color:#111; }

      /* header */
      #resultHeader { display:flex; align-items:center; justify-content:space-between; gap: 8px; margin-bottom: 8px; cursor: grab; }
      #title { font-weight:700; font-size:16px; display:flex; gap:8px; align-items:center; }
      #title > div { font-size:12px; opacity:0.8; font-weight:600; letter-spacing:0.6px; }

      /* controls */
      #controls { display:flex; gap:6px; align-items:center; flex-wrap: wrap; }
      #controls button, #closeButton {
        border: none; padding: 6px 10px; border-radius: 10px;
        font-size: 13px; cursor: pointer;
        background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.04)); color:#e9eef8;
        display:inline-flex; align-items:center; gap:6px;
        box-shadow: 0 6px 12px rgba(0,0,0,0.22);
        transition: transform .12s ease, box-shadow .18s ease, opacity .12s ease, background .2s ease;
      }
      #controls button:hover { transform: translateY(-4px); box-shadow: 0 10px 22px rgba(0,0,0,0.32); }
      #hiddenResult.light #controls button, #hiddenResult.light #closeButton { background: rgba(0,0,0,0.04); color:#222; }

      #closeButton { background: transparent; color:#bbb; font-size: 18px; padding: 2px 6px; }
      #closeButton:hover { transform: scale(1.06); color: #ff5a5a; }

      /* regen button spinner */
      #regenBtn.loading { pointer-events: none; opacity: 0.92; }
      #regenBtn.loading .ms { animation: spin 0.9s linear infinite; display:inline-block; }
      @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }

      /* result area */
      #subBar { display:none; align-items:center; justify-content:space-between; gap:8px; margin: 6px 0 8px 0; }
      #subBar span { opacity:.85; font-size: 13px; display:inline-flex; align-items:center; gap:8px; }
      #subBar button { border:none; padding:6px 10px; border-radius:10px; background:#444; color:#fff; cursor:pointer; }

      #resultText { max-height: 460px; overflow: auto; scrollbar-width: thin; padding-right:6px; }
      #resultText a { color:#8ecbff; text-decoration: none; }
      #hiddenResult.light #resultText a { color:#0b62d6; }
      #resultText a:hover { text-decoration: underline; }
      #resultText pre { background: #0f1113; padding: 10px 12px; border-radius: 10px; overflow:auto; }
      #hiddenResult.light #resultText pre { background: #f3f3f3; }
      #resultText code { background:#222; padding:2px 6px; border-radius:6px; }
      #hiddenResult.light #resultText code { background:#ececec; }

      .reveal { animation: fadeInEl .35s ease forwards; }
      @keyframes fadeInEl { from {opacity:0; transform: translateY(6px)} to{opacity:1; transform:none} }
      .caret { border-right: 2px solid currentColor; animation: blink .9s steps(1) infinite; }
      @keyframes blink { 50% { border-color: transparent; } }

      /* neon glow animation (applied to wrapper via class) */
      @keyframes neonPulseWrap {
        0% { box-shadow: 0 6px 24px rgba(0,0,0,0.45), 0 0 0 rgba(0,0,0,0); transform: translateY(0); }
        30% { box-shadow: 0 18px 48px rgba(0,0,0,0.5), 0 0 40px var(--neon); transform: translateY(-4px); }
        100% { box-shadow: 0 12px 36px rgba(0,0,0,0.5), 0 0 12px rgba(0,0,0,0); transform: translateY(0); }
      }
      .neon-glow { animation: neonPulseWrap .9s ease forwards; }

      /* settings panel */
      #settingsPanel {
        position: absolute; top: 46px; right: 12px;
        background: rgba(28,28,28,.94); color: #fff; border-radius: 12px; padding:12px;
        box-shadow:0 20px 40px rgba(0,0,0,.55); display:none; flex-direction:column; gap:12px; font-size:13px; min-width:240px;
        backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,.03);
      }
      #hiddenResult.light #settingsPanel { background: rgba(255,255,255,.98); color:#111; border-color: rgba(0,0,0,.06); }

      #settingsPanel label { display:flex; justify-content:space-between; gap:10px; align-items:center; }
      #settingsPanel input[type=range] { width:130px; cursor:pointer; accent-color: #6aa9ff; }
      .row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }

      .chip { padding:6px 10px; border-radius: 8px; background:#262626; color:#eee; cursor:pointer; font-size:12px; border:1px solid rgba(255,255,255,.04); transition: all .16s ease; }
      .chip:hover { transform: translateY(-3px); }
      #hiddenResult.light .chip { background:#f6f6f6; color:#222; border-color: rgba(0,0,0,.06); }
      .chip.active { outline: 2px solid #6aa9ff; background: rgba(255,255,255,0.02); }

      /* color grid */
      #settingsPanel .row.colorRow { display:flex; flex-wrap:wrap; gap:8px; max-width: 220px; }
      #settingsPanel .colorBtn {
        width:24px; height:24px; border-radius:50%; border:none; cursor:pointer;
        box-shadow: 0 3px 8px rgba(0,0,0,.22); transition: transform .16s ease, box-shadow .16s ease, outline .16s ease;
        position: relative; overflow: hidden;
      }
      #settingsPanel .colorBtn:hover { transform: scale(1.18); box-shadow: 0 8px 18px rgba(0,0,0,.32); }
      #settingsPanel .colorBtn.selected { outline: 2px solid rgba(255,255,255,0.12); transform: scale(1.12); box-shadow: 0 10px 26px rgba(0,0,0,.38); }

      /* ripple */
      .ripple { position: absolute; border-radius:50%; transform: scale(0); animation: rippleAnim .56s linear; background-color: rgba(255,255,255,.36); pointer-events:none; }
      @keyframes rippleAnim { to { transform: scale(4); opacity: 0; } }

      /* glow layer (fast flash when color changed) */
      .glow { position:absolute; inset:-8px; border-radius:inherit; pointer-events:none; opacity:0; transition: opacity .38s ease, transform .38s ease; mix-blend-mode: screen; }

      /* liquid overlay */
      .liquid-wrap { position:absolute; inset:0; border-radius:inherit; overflow:hidden; pointer-events:none; z-index:2; }
      .liquid-blob {
        position:absolute;
        width:160px; height:160px; border-radius:50%;
        filter: blur(18px) contrast(120%);
        opacity:0;
        mix-blend-mode: screen;
        transform: translate3d(0,0,0) scale(1);
      }
      @keyframes blob1 {
        0% { transform: translate(-10%, 60%) scale(0.6); opacity:0; }
        20% { opacity:0.9; }
        50% { transform: translate(40%, 10%) scale(1.2); opacity:0.7; }
        100% { transform: translate(-5%, 60%) scale(0.8); opacity:0; }
      }
      @keyframes blob2 {
        0% { transform: translate(80%, 10%) scale(0.6); opacity:0; }
        25% { opacity:0.85; }
        60% { transform: translate(30%, 70%) scale(1.1); opacity:0.6; }
        100% { transform: translate(80%, 10%) scale(0.6); opacity:0; }
      }
      @keyframes blob3 {
        0% { transform: translate(40%, -20%) scale(0.6); opacity:0; }
        15% { opacity:0.8; }
        55% { transform: translate(-10%, 50%) scale(1.0); opacity:0.6; }
        100% { transform: translate(40%, -20%) scale(0.6); opacity:0; }
      }
      .liquid-active .liquid-blob.blob1 { animation: blob1 980ms cubic-bezier(.2,.8,.2,1) forwards; }
      .liquid-active .liquid-blob.blob2 { animation: blob2 1200ms cubic-bezier(.22,.9,.2,1) 80ms forwards; }
      .liquid-active .liquid-blob.blob3 { animation: blob3 1100ms cubic-bezier(.22,.9,.2,1) 140ms forwards; }

      /* small util */
      .small { padding:4px 6px; font-size:13px; opacity:.88; }

      /* mobile */
      @media (max-width:420px) { #settingsPanel .colorBtn { width:20px; height:20px; } }
    </style>

    <div id="resultHeader">
      <div id="title"><span class="ms" style="font-size:20px">insights</span><div>11A5</div></div>
      <div id="controls">
        <button id="prevBtn" title="Previous" class="small"><span class="ms">arrow_back</span></button>
        <button id="regenBtn" title="Regenerate" class="small"><span class="ms">refresh</span></button>
        <button id="nextBtn" title="Next" class="small"><span class="ms">arrow_forward</span></button>
        <button id="themeBtn" title="Light/Dark" class="small"><span id="themeIcon" class="ms">dark_mode</span></button>
        <button id="settingsBtn" title="Settings" class="small"><span class="ms">settings</span></button>
        <button id="utilsBtn" title="Utils" class="small"><span class="ms">construction</span></button>
        <button id="skipBtn" title="Skip typing" class="small"><span class="ms">bolt</span></button>
        <button id="fakeFocusBtn" title="Fake Focus" class="small"><span id="fakeIcon" class="ms">visibility_off</span></button>
        <button id="pauseEvtBtn" title="Pause Events" class="small"><span id="pauseIcon" class="ms">pause_circle</span></button>
        <button id="askBtn" title="Ask AI" class="small"><span class="ms">smart_toy</span></button>
      </div>
      <button id="closeButton" aria-label="Close"><span class="ms">close</span></button>
    </div>

    <div id="subBar">
      <span id="modeBadge"><span class="ms">question_answer</span> Ask mode</span>
      <div class="row">
        <button id="returnBtn" class="small"><span class="ms">reply</span> Return</button>
        <button id="keepBtn" class="small"><span class="ms">save</span> Keep</button>
      </div>
    </div>

    <div id="resultText"></div>

    <div id="settingsPanel">
      <label>Opacity <input id="opacityRange" type="range" min="0.4" max="1" step="0.05" value="0.85"></label>
      <label>Blur <input id="blurRange" type="range" min="0" max="24" step="1" value="14"></label>
      <label>Font <input id="fontRange" type="range" min="13" max="18" step="1" value="15"></label>
      <label>Radius <input id="radiusRange" type="range" min="8" max="26" step="1" value="18"></label>
      <label>Shadow <input id="shadowRange" type="range" min="0" max="60" step="2" value="32"></label>
      <div class="row">Theme:
        <span class="chip" id="themeDark">Dark</span>
        <span class="chip" id="themeLight">Light</span>
      </div>

      <div class="row colorRow" id="colorRow">Color:
        <!-- Basic -->
        <button class="colorBtn" style="background:#1e1e1e" data-color="rgba(30,30,30,VAR_A)"></button>
        <button class="colorBtn" style="background:#0d6efd" data-color="rgba(13,110,253,VAR_A)"></button>
        <button class="colorBtn" style="background:#198754" data-color="rgba(25,135,84,VAR_A)"></button>
        <button class="colorBtn" style="background:#dc3545" data-color="rgba(220,53,69,VAR_A)"></button>
        <button class="colorBtn" style="background:#6f42c1" data-color="rgba(111,66,193,VAR_A)"></button>

        <!-- Extra -->
        <button class="colorBtn" style="background:#fd7e14" data-color="rgba(253,126,20,VAR_A)"></button>
        <button class="colorBtn" style="background:#20c997" data-color="rgba(32,201,151,VAR_A)"></button>
        <button class="colorBtn" style="background:#6610f2" data-color="rgba(102,16,242,VAR_A)"></button>
        <button class="colorBtn" style="background:#e83e8c" data-color="rgba(232,62,140,VAR_A)"></button>
        <button class="colorBtn" style="background:#ffc107" data-color="rgba(255,193,7,VAR_A)"></button>

        <!-- Neutrals -->
        <button class="colorBtn" style="background:#ffffff" data-color="rgba(255,255,255,VAR_A)"></button>
        <button class="colorBtn" style="background:#f8f9fa" data-color="rgba(248,249,250,VAR_A)"></button>
        <button class="colorBtn" style="background:#adb5bd" data-color="rgba(173,181,189,VAR_A)"></button>
        <button class="colorBtn" style="background:#6c757d" data-color="rgba(108,117,125,VAR_A)"></button>
        <button class="colorBtn" style="background:#343a40" data-color="rgba(52,58,64,VAR_A)"></button>

        <!-- Pastel -->
        <button class="colorBtn" style="background:#ffb3ba" data-color="rgba(255,179,186,VAR_A)"></button>
        <button class="colorBtn" style="background:#ffdfba" data-color="rgba(255,223,186,VAR_A)"></button>
        <button class="colorBtn" style="background:#ffffba" data-color="rgba(255,255,186,VAR_A)"></button>
        <button class="colorBtn" style="background:#baffc9" data-color="rgba(186,255,201,VAR_A)"></button>
        <button class="colorBtn" style="background:#bae1ff" data-color="rgba(186,225,255,VAR_A)"></button>

        <!-- Neon -->
        <button class="colorBtn" style="background:#39ff14" data-color="rgba(57,255,20,VAR_A)"></button>
        <button class="colorBtn" style="background:#ff073a" data-color="rgba(255,7,58,VAR_A)"></button>
        <button class="colorBtn" style="background:#ff61f6" data-color="rgba(255,97,246,VAR_A)"></button>
        <button class="colorBtn" style="background:#00f0ff" data-color="rgba(0,240,255,VAR_A)"></button>
        <button class="colorBtn" style="background:#f5f500" data-color="rgba(245,245,0,VAR_A)"></button>

        <!-- Dark fancy -->
        <button class="colorBtn" style="background:#2b2d42" data-color="rgba(43,45,66,VAR_A)"></button>
        <button class="colorBtn" style="background:#8d99ae" data-color="rgba(141,153,174,VAR_A)"></button>
        <button class="colorBtn" style="background:#ef233c" data-color="rgba(239,35,60,VAR_A)"></button>
        <button class="colorBtn" style="background:#d90429" data-color="rgba(217,4,41,VAR_A)"></button>
        <button class="colorBtn" style="background:#0a9396" data-color="rgba(10,147,150,VAR_A)"></button>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);

  // ============= Elements ============
  const resultEl = document.getElementById("resultText");
  const subBar   = document.getElementById("subBar");
  const settingsPanel = document.getElementById("settingsPanel");
  const regenBtn = document.getElementById("regenBtn");

  // create glow helper element once
  const glowEl = document.createElement('div');
  glowEl.className = 'glow';
  wrapper.appendChild(glowEl);

  // create liquid overlay (three blobs) once
  const liquidWrap = document.createElement('div');
  liquidWrap.className = 'liquid-wrap';
  liquidWrap.innerHTML = `
    <div class="liquid-blob blob1" style="background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.07), transparent 45%);"></div>
    <div class="liquid-blob blob2" style="background: radial-gradient(circle at 50% 40%, rgba(255,255,255,0.06), transparent 45%);"></div>
    <div class="liquid-blob blob3" style="background: radial-gradient(circle at 60% 60%, rgba(255,255,255,0.05), transparent 45%);"></div>
  `;
  wrapper.appendChild(liquidWrap);

  // ============= Typing engine ============
  function typeHTML(htmlString, container, opts = { stepDelay: 6, revealBlocks: true, speedMultiplier: 2 }) {
    container.innerHTML = "";
    const tmp = document.createElement("div");
    tmp.innerHTML = htmlString;

    const steps = [];
    const frag = document.createDocumentFragment();

    const cloneWithTyping = (srcNode, destParent) => {
      if (srcNode.nodeType === Node.TEXT_NODE) {
        const full = srcNode.nodeValue || "";
        const textNode = document.createTextNode("");
        destParent.appendChild(textNode);
        for (let i = 0; i < full.length; i++) steps.push(() => { textNode.nodeValue += full[i]; });
        return;
      }
      if (srcNode.nodeType === Node.ELEMENT_NODE) {
        const destEl = document.createElement(srcNode.tagName);
        for (const attr of srcNode.attributes) destEl.setAttribute(attr.name, attr.value);
        destParent.appendChild(destEl);

        const blocky = /^(PRE|CODE|TABLE|THEAD|TBODY|TR|TH|TD|UL|OL)$/i.test(srcNode.tagName);
        if (opts.revealBlocks) {
          destEl.style.opacity = "0";
          steps.push(() => { destEl.style.opacity = ""; destEl.classList.add("reveal"); });
        }
        if (blocky) {
          const html = srcNode.innerHTML;
          steps.push(() => { destEl.innerHTML = html; });
          return;
        }
        srcNode.childNodes.forEach(child => cloneWithTyping(child, destEl));
      }
    };
    tmp.childNodes.forEach(n => cloneWithTyping(n, frag));
    container.appendChild(frag);

    const caret = document.createElement("span");
    caret.className = "caret";
    caret.textContent = " ";
    container.appendChild(caret);

    let idx = 0;
    const tick = () => {
      for (let k = 0; k < (opts.speedMultiplier||1) && idx < steps.length; k++) steps[idx++]();
      if (idx < steps.length) {
        container.scrollTop = container.scrollHeight;
        setTimeout(tick, opts.stepDelay);
      } else {
        caret.remove();
      }
    };
    tick();
    return { skip: () => { for (; idx < steps.length; idx++) steps[idx](); caret.remove(); } };
  }

  // ============= History & navigation ============
  const history = [];
  let currentIdx = -1;
  let tempAsk = null;
  let typer = null;

  function showHistory(idx) {
    if (history.length === 0) return;
    // wrap-around
    if (idx < 0) idx = history.length - 1;
    if (idx >= history.length) idx = 0;
    currentIdx = idx;
    const html = marked.parse(history[idx] || "");
    typer = typeHTML(html, resultEl, { stepDelay: 6, revealBlocks: true, speedMultiplier: 2 });
    subBar.style.display = "none";
  }

  function enterAskMode(text) {
    tempAsk = text;
    const html = marked.parse(text || "");
    typer = typeHTML(html, resultEl, { stepDelay: 6, revealBlocks: true, speedMultiplier: 2 });
    subBar.style.display = "flex";
  }

  function leaveAskMode(keep) {
    if (keep && tempAsk != null) {
      history.push(tempAsk);
      showHistory(history.length - 1);
    } else {
      showHistory(currentIdx);
    }
    tempAsk = null;
    subBar.style.display = "none";
  }

  // ============= Settings state & handlers ============
  const state = { alpha: 0.85, baseColor: "rgba(30,30,30,VAR_A)", blur: 14, font: 15, radius: 18, shadow: 32, neonRgb: [30,30,30] };
  function applyUI() {
    const bg = state.baseColor.replace("VAR_A", String(state.alpha));
    // solid glass background (no gradients)
    wrapper.style.background = bg;
    wrapper.style.backdropFilter = state.blur > 0 ? `blur(${state.blur}px) saturate(120%)` : "none";
    wrapper.style.fontSize = `${state.font}px`;
    wrapper.style.borderRadius = `${state.radius}px`;

    // neon border & glow based on neonRgb
    const [r,g,b] = state.neonRgb;
    const neon = `rgba(${r},${g},${b},0.28)`;
    wrapper.style.boxShadow = `0 12px ${state.shadow}px rgba(0,0,0,0.45), 0 0 20px ${neon}`;
    wrapper.style.border = `1px solid rgba(${r},${g},${b},${state.alpha * 0.12})`;
    wrapper.style.setProperty('--neon', `rgba(${r},${g},${b},0.6)`);
    wrapper.style.setProperty('--neon-rgb', `${r},${g},${b}`);

    // update liquid blob colors
    const blobs = wrapper.querySelectorAll('.liquid-blob');
    blobs.forEach((bEl, i) => {
      // slightly different opacities / tints for variety
      bEl.style.background = `radial-gradient(circle at 50% 40%, rgba(${r},${g},${b},0.18), rgba(${r},${g},${b},0.06) 35%, transparent 60%)`;
    });
  }

  $("opacityRange").addEventListener("input", e => { state.alpha = +e.target.value; applyUI(); });
  $("blurRange").addEventListener("input", e => { state.blur = +e.target.value; applyUI(); });
  $("fontRange").addEventListener("input", e => { state.font = +e.target.value; applyUI(); });
  $("radiusRange").addEventListener("input", e => { state.radius = +e.target.value; applyUI(); });
  $("shadowRange").addEventListener("input", e => { state.shadow = +e.target.value; applyUI(); });

  $("themeDark").addEventListener("click", () => { wrapper.classList.remove("light"); $("themeDark").classList.add("active"); $("themeLight").classList.remove("active"); });
  $("themeLight").addEventListener("click", () => { wrapper.classList.add("light"); $("themeLight").classList.add("active"); $("themeDark").classList.remove("active"); });

  // enhanced color binding: ripple + neon pulse + set state + selected highlight
  const colorButtons = settingsPanel.querySelectorAll(".colorBtn");
  colorButtons.forEach(btn=>{
    btn.addEventListener("click", (ev) => {
      // compute rgb
      const cs = getComputedStyle(btn).backgroundColor; // like 'rgb(r, g, b)'
      const m = cs.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      let r=30,g=30,b=30;
      if (m) { r = +m[1]; g = +m[2]; b = +m[3]; }

      // update state
      state.neonRgb = [r,g,b];
      state.baseColor = btn.dataset.color || `rgba(${r},${g},${b},VAR_A)`;
      applyUI();

      // highlight selected button
      colorButtons.forEach(x=>x.classList.remove('selected'));
      btn.classList.add('selected');

      // add wrapper neon-glow class to animate pulse
      wrapper.classList.remove('neon-glow');
      // force reflow to restart animation
      void wrapper.offsetWidth;
      wrapper.classList.add('neon-glow');
      // remove after animation
      setTimeout(()=>wrapper.classList.remove('neon-glow'), 1000);

      // glow flash using glowEl
      glowEl.style.background = `radial-gradient(circle at 50% 20%, rgba(${r},${g},${b},0.18), rgba(${r},${g},${b},0.06) 30%, transparent 60%)`;
      glowEl.style.opacity = '1';
      glowEl.style.transform = 'scale(1)';
      setTimeout(()=>{ glowEl.style.opacity = '0'; glowEl.style.transform = 'scale(0.98)'; }, 650);

      // ripple inside button
      const circle = document.createElement('span');
      circle.className = 'ripple';
      btn.appendChild(circle);
      const d = Math.max(btn.clientWidth, btn.clientHeight) * 2;
      circle.style.width = circle.style.height = d + 'px';
      const rect = btn.getBoundingClientRect();
      // fallback center if ev.clientX is 0
      const cx = ev.clientX || (rect.left + rect.width/2);
      const cy = ev.clientY || (rect.top + rect.height/2);
      circle.style.left = (cx - rect.left - d/2) + 'px';
      circle.style.top = (cy - rect.top - d/2) + 'px';
      setTimeout(()=>circle.remove(), 700);
    });
  });

  $("settingsBtn").onclick = () => {
    settingsPanel.style.display = (settingsPanel.style.display === "flex") ? "none" : "flex";
    settingsPanel.style.flexDirection = "column";
  };

  // ============= Drag (mouse + touch) ============
  (function enableDrag() {
    const header = wrapper.querySelector("#resultHeader");
    let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
    const start = (clientX, clientY) => {
      dragging = true; header.style.cursor = "grabbing";
      const rect = wrapper.getBoundingClientRect();
      startLeft = rect.left; startTop = rect.top;
      startX = clientX; startY = clientY;
      wrapper.style.left = startLeft + "px";
      wrapper.style.top  = startTop + "px";
      wrapper.style.bottom = "auto"; wrapper.style.transform = "none";
    };
    const move = (clientX, clientY) => {
      if (!dragging) return;
      const newLeft = startLeft + (clientX - startX);
      const newTop  = startTop  + (clientY - startY);
      wrapper.style.left = Math.max(8, Math.min(window.innerWidth - wrapper.offsetWidth - 8, newLeft)) + "px";
      wrapper.style.top  = Math.max(8, Math.min(window.innerHeight - 80, newTop)) + "px";
    };
    const end = () => { dragging = false; header.style.cursor = "grab"; };

    header.addEventListener("mousedown", e => start(e.clientX, e.clientY));
    window.addEventListener("mousemove", e => move(e.clientX, e.clientY));
    window.addEventListener("mouseup", end);

    header.addEventListener("touchstart", e => { const t = e.touches[0]; start(t.clientX, t.clientY); }, {passive:true});
    window.addEventListener("touchmove", e => { const t = e.touches[0]; move(t.clientX, t.clientY); }, {passive:true});
    window.addEventListener("touchend", end);
  })();

  // ============= Anti-detect ============
  let fakeFocusActive = false;
  let pauseEvents = false;
  const fakeHandlers = [];
  $("fakeFocusBtn").onclick = () => {
    fakeFocusActive = !fakeFocusActive;
    if (fakeFocusActive) {
      const blurHandler = e => e.stopImmediatePropagation();
      const visHandler = e => { try{ Object.defineProperty(document, "hidden", { value:false }); } catch{} e.stopImmediatePropagation(); };
      window.addEventListener("blur", blurHandler, true);
      window.addEventListener("visibilitychange", visHandler, true);
      fakeHandlers.push(blurHandler, visHandler);
      $("fakeIcon").textContent = "visibility";
      alert("Fake Focus ON");
    } else {
      // remove handlers (can't remove anonymous easily — but we saved them)
      try {
        window.removeEventListener("blur", fakeHandlers.shift(), true);
        window.removeEventListener("visibilitychange", fakeHandlers.shift(), true);
      } catch {}
      $("fakeIcon").textContent = "visibility_off";
      alert("Fake Focus OFF");
    }
  };

  $("pauseEvtBtn").onclick = () => {
    pauseEvents = !pauseEvents;
    if (pauseEvents) {
      ["blur","visibilitychange"].forEach(evt=> window.addEventListener(evt,(e)=>e.stopImmediatePropagation(),true));
      $("pauseIcon").textContent = "play_circle";
    } else {
      // cannot reliably remove anonym handlers — reload advisable for full cleanup
      $("pauseIcon").textContent = "pause_circle";
    }
    alert(pauseEvents ? "⏸ Events Paused" : "▶ Events Resumed");
  };

  // ============= Show/Hide & hotkeys ============
  function showMenu() {
    wrapper.style.display = "flex";
    wrapper.animate([
      { opacity: 0, transform: "scale(0.96) translateY(20px)" },
      { opacity: 1, transform: "scale(1) translateY(0)" }
    ], { duration: 260, easing: "cubic-bezier(.2,.9,.3,1)", fill: "forwards" });
  };
  function hideMenu() {
    wrapper.animate([
      { opacity: 1, transform: "scale(1) translateY(0)" },
      { opacity: 0, transform: "scale(0.96) translateY(20px)" }
    ], { duration: 180, easing: "ease-in", fill: "forwards" }).onfinish = () => {
      wrapper.style.display = "none";
    };
  };
  document.getElementById("closeButton").onclick = hideMenu;

  document.addEventListener("keydown", (e) => {
    const k = (e.key || "").toLowerCase();
    if (k === "z") showMenu();
    if (k === "x") hideMenu();
  });
let lastTap = 0;
let tapCount = 0;

window.addEventListener("touchend", () => {
  const now = Date.now();

  if (now - lastTap < 500) { // nếu lần trước < 500ms
    tapCount++;
  } else {
    tapCount = 1; // quá chậm → reset đếm
  }

  lastTap = now;

  if (tapCount === 4) { // 4 lần liên tiếp
    showMenu();
    tapCount = 0; // reset sau khi mở menu
  }
});
 window.addEventListener("keydown", (e) => {
    if (e.key === "AudioVolumeUp") showMenu();
    if (e.key === "AudioVolumeDown") hideMenu();
  });

  // ============= Buttons ============
  $("themeBtn").onclick = () => {
    wrapper.classList.toggle("light");
    const icon = $("themeIcon");
    if (wrapper.classList.contains("light")) icon.textContent = "light_mode"; else icon.textContent = "dark_mode";
  };
  $("utilsBtn").onclick = () => alert("Đang phát triển");
  $("prevBtn").onclick  = () => showHistory(currentIdx - 1);
  $("nextBtn").onclick  = () => showHistory(currentIdx + 1);
  $("returnBtn").onclick = () => leaveAskMode(false);
  $("keepBtn").onclick   = () => leaveAskMode(true);
  $("skipBtn").onclick = () => typer?.skip?.();

  // Ask button (calls backend)
  $("askBtn").onclick = async () => {
    const q = prompt("Hỏi AI:");
    if (!q) return;
    try {
      const data = await postJSON(ENDPOINT_ASK, { question: q }); // backend reads 'question'
      // support multiple response field names
      const text = (data.result || data.answer || data.reply || "").trim();
      enterAskMode(text || "❌ Không có phản hồi.");
      showMenu();
    } catch (err) {
      enterAskMode("❌ Lỗi gọi /ask: " + (err?.message || err));
      showMenu();
    }
  };

  // ============= Regenerate (new) ============
  regenBtn.addEventListener('click', async (ev) => {
    // visual feedback
    regenBtn.classList.add('loading');

    // activate liquid animation
    wrapper.classList.add('liquid-active');
    // ensure blobs use current neon color
    const [r,g,b] = state.neonRgb;
    wrapper.style.setProperty('--neon-rgb', `${r},${g},${b}`);
    // small extra neon pulse
    wrapper.classList.add('neon-glow');
    setTimeout(()=> wrapper.classList.remove('neon-glow'), 900);

    // Make the liquidWrap visible by forcing reflow (animations defined via .liquid-active)
    void liquidWrap.offsetWidth;

    try {
      const visibleContent = getVisibleText();
      const resp = await postJSON(ENDPOINT_SOLVE, { content: visibleContent });
      const newText = (resp.result || resp.answer || "").trim() || "_(Không có nội dung trả về từ /solve)_";
      // push to history and show
      history.push(newText);
      showHistory(history.length - 1);
    } catch (err) {
      // show error inline
      enterAskMode("❌ Lỗi gọi /solve: " + (err?.message || err));
      showMenu();
    } finally {
      // cleanup animations after short delay so user sees them
      setTimeout(()=> {
        wrapper.classList.remove('liquid-active');
        regenBtn.classList.remove('loading');
      }, 1100);
    }
  });

  // ============= Initial UI apply & call /solve ============
  applyUI();
  $("themeDark").classList.add("active");

  // pre-select first color button visually
  const firstColor = settingsPanel.querySelector(".colorBtn");
  if (firstColor) firstColor.classList.add('selected');

  let initialText = "";
  try {
    const visibleContent = getVisibleText();
    const resp = await postJSON(ENDPOINT_SOLVE, { content: visibleContent });
    initialText = (resp.result || resp.answer || "").trim();
    if (!initialText) initialText = "_(Không có nội dung trả về từ /solve)_";
  } catch (e) {
    initialText = "❌ Lỗi gọi /solve: " + (e?.message || e);
  }

  history.push(initialText);
  showHistory(history.length - 1);
  showMenu();

  console.log("✅ Ready: Z mở / X đóng / double-tap mở | Drag | Typing safe | History ⬅➡ wrap | Ask Return/Keep | Settings | Regen + Liquid effect.");
})();
