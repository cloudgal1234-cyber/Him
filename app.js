(() => {
  "use strict";

  const COLORS = ["#E6396F", "#1E7FD8", "#14935A", "#8B3FD9", "#E07B00", "#0098A8", "#C2185B", "#5D6B00"];
  const STORE_KEY = "budgetGame.v1";
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Number(n).toLocaleString("he-IL") + " ₪";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------------- state ---------------- */
  const defaultSetup = () => ({
    players: [{ name: "שחקן 1", budget: 100 }, { name: "שחקן 2", budget: 100 }],
    productName: PRODUCTS[0].name,
    productEmoji: PRODUCTS[0].emoji,
    items: PRODUCTS[0].items.map(([emoji, name]) => ({ emoji, name })),
    shuffle: false
  });

  let state = load() || { phase: "setup", setup: defaultSetup(), game: null };

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* אין אחסון, לא נורא */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.setup ? s : null;
    } catch (e) { return null; }
  }

  /* ---------------- theme ---------------- */
  $("themeBtn").addEventListener("click", () => {
    const root = document.documentElement;
    const isDark = root.dataset.theme === "dark" ||
      (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.theme = isDark ? "light" : "dark";
    try { localStorage.setItem("budgetGame.theme", root.dataset.theme); } catch (e) {}
  });
  try { const t = localStorage.getItem("budgetGame.theme"); if (t) document.documentElement.dataset.theme = t; } catch (e) {}

  /* ---------------- screens ---------------- */
  function show(phase) {
    state.phase = phase;
    $("setupScreen").hidden = phase !== "setup";
    $("gameScreen").hidden = phase !== "game";
    $("endScreen").hidden = phase !== "end";
    if (phase === "setup") renderSetup();
    if (phase === "game") renderGame(true);
    if (phase === "end") renderEnd();
    save();
    window.scrollTo({ top: 0 });
  }

  /* ================= SETUP ================= */
  function renderSetup() {
    renderPlayers();
    renderChips();
    renderItems();
    $("shuffleChk").checked = !!state.setup.shuffle;
    $("setupError").hidden = true;
  }

  function renderPlayers() {
    const ul = $("playerRows");
    ul.innerHTML = "";
    state.setup.players.forEach((p, i) => {
      const li = document.createElement("li");
      li.className = "player-row";
      li.innerHTML = `
        <span class="swatch" style="background:${COLORS[i % COLORS.length]}"></span>
        <input type="text" id="pname-${i}" value="${esc(p.name)}" aria-label="שם שחקן ${i + 1}" maxlength="24">
        <div class="money-input">
          <input type="number" id="pbudget-${i}" inputmode="numeric" min="0" step="1" value="${p.budget}" aria-label="תקציב של ${esc(p.name)}">
          <span>₪</span>
        </div>
        <button type="button" class="ghost icon-btn" aria-label="הסר שחקן" ${state.setup.players.length <= 2 ? "disabled" : ""}>✕</button>`;
      li.querySelector(`#pname-${i}`).addEventListener("input", (e) => { p.name = e.target.value; save(); });
      li.querySelector(`#pbudget-${i}`).addEventListener("input", (e) => { p.budget = Number(e.target.value); save(); });
      li.querySelector("button").addEventListener("click", () => {
        state.setup.players.splice(i, 1); save(); renderPlayers();
      });
      ul.appendChild(li);
    });
  }

  $("addPlayerBtn").addEventListener("click", () => {
    const n = state.setup.players.length + 1;
    if (n > COLORS.length) return;
    state.setup.players.push({ name: `שחקן ${n}`, budget: Number($("allBudget").value) || 100 });
    save(); renderPlayers();
    $(`pname-${n - 1}`).select();
  });

  $("applyAllBudget").addEventListener("click", () => {
    const v = Number($("allBudget").value);
    if (!(v >= 0)) return;
    state.setup.players.forEach((p) => (p.budget = v));
    save(); renderPlayers();
  });

  function renderChips() {
    const box = $("productChips");
    box.innerHTML = "";
    PRODUCTS.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.setAttribute("aria-pressed", String(state.setup.productName === p.name));
      b.innerHTML = `<span aria-hidden="true">${p.emoji}</span>${esc(p.name)}`;
      b.addEventListener("click", () => selectProduct(p, p.name));
      box.appendChild(b);
    });
  }

  function selectProduct(p, name) {
    state.setup.productName = name;
    state.setup.productEmoji = p.emoji;
    state.setup.items = p.items.map(([emoji, n]) => ({ emoji, name: n }));
    save(); renderChips(); renderItems();
  }

  function makeTopic() {
    const t = $("topicInput").value.trim();
    const hint = $("topicHint");
    if (!t) { hint.hidden = false; hint.textContent = "הקלידו נושא, למשל \"ארוחת חג\"."; return; }
    const res = smartItemsFor(t);
    selectProduct(res.product, t);
    hint.hidden = false;
    hint.textContent = res.matched
      ? `מצאנו רשימה מתאימה ל"${t}". אפשר לערוך אותה למטה.`
      : `אין לנו רשימה מוכנה ל"${t}", אז יצרנו שלד כללי. כדאי למחוק ולהוסיף פריטים משלכם למטה.`;
  }
  $("topicBtn").addEventListener("click", makeTopic);
  $("topicInput").addEventListener("keydown", (e) => { if (e.key === "Enter") makeTopic(); });

  function renderItems() {
    const ol = $("itemList");
    ol.innerHTML = "";
    const items = state.setup.items;
    items.forEach((it, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span aria-hidden="true">${it.emoji}</span><span class="nm">${esc(it.name)}</span>
        <button type="button" class="mini" data-a="up" aria-label="הזז למעלה" ${i === 0 ? "disabled" : ""}>▲</button>
        <button type="button" class="mini" data-a="del" aria-label="מחק">✕</button>`;
      li.querySelector('[data-a="up"]').addEventListener("click", () => {
        [items[i - 1], items[i]] = [items[i], items[i - 1]]; save(); renderItems();
      });
      li.querySelector('[data-a="del"]').addEventListener("click", () => {
        items.splice(i, 1); save(); renderItems();
      });
      ol.appendChild(li);
    });
    $("itemCount").textContent = items.length;
  }

  function addSetupItem() {
    const v = $("newItemInput").value.trim();
    if (!v) return;
    state.setup.items.push({ emoji: "🏷️", name: v });
    $("newItemInput").value = "";
    save(); renderItems();
    $("newItemInput").focus();
  }
  $("addItemBtn").addEventListener("click", addSetupItem);
  $("newItemInput").addEventListener("keydown", (e) => { if (e.key === "Enter") addSetupItem(); });
  $("shuffleChk").addEventListener("change", (e) => { state.setup.shuffle = e.target.checked; save(); });

  $("startBtn").addEventListener("click", startGame);

  function startGame() {
    const s = state.setup;
    const err = $("setupError");
    const players = s.players.map((p, i) => ({ ...p, name: (p.name || "").trim() || `שחקן ${i + 1}` }));
    if (players.some((p) => !(Number(p.budget) > 0))) { err.textContent = "לכל שחקן צריך תקציב גדול מ-0."; err.hidden = false; return; }
    if (!s.items.length) { err.textContent = "אין פריטים למכירה. בחרו תוצר או הוסיפו פריטים."; err.hidden = false; return; }
    let queue = s.items.map((x) => ({ ...x }));
    if (s.shuffle) {
      for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; }
    }
    state.game = {
      productName: s.productName,
      productEmoji: s.productEmoji,
      players: players.map((p, i) => ({ name: p.name, start: Number(p.budget), left: Number(p.budget), color: COLORS[i % COLORS.length], owned: [] })),
      queue,
      index: 0,
      history: [],
      selected: null
    };
    show("game");
  }

  /* ================= GAME ================= */
  function renderGame(animate) {
    const g = state.game;
    if (!g) return show("setup");
    if (g.index >= g.queue.length) return show("end");

    renderScoreboard();
    const item = g.queue[g.index];
    $("productLabel").textContent = `${g.productEmoji || ""} ${g.productName}`;
    $("roundLabel").textContent = `פריט ${g.index + 1} מתוך ${g.queue.length}`;
    $("progressBar").style.width = `${(g.index / g.queue.length) * 100}%`;
    $("itemEmoji").textContent = item.emoji || "🏷️";
    $("itemName").textContent = item.name;
    const next = g.queue[g.index + 1];
    $("nextUp").textContent = next ? `הבא בתור: ${next.name}` : "זה הפריט האחרון!";
    if (animate) {
      const card = $("itemCard");
      card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");
    }

    renderBuyers();
    $("priceInput").value = "";
    $("judgeError").hidden = true;
    $("undoBtn").disabled = g.history.length === 0;
    $("insertBox").hidden = true;
    $("endConfirm").hidden = true;
    renderHistory();
  }

  function renderScoreboard(flashIdx) {
    const g = state.game;
    const box = $("scoreboard");
    box.innerHTML = "";
    g.players.forEach((p, i) => {
      const pct = p.start > 0 ? Math.max(0, (p.left / p.start) * 100) : 0;
      const div = document.createElement("article");
      div.className = "pcard" + (i === flashIdx ? " flash" : "");
      div.style.setProperty("--pc", p.color);
      const owned = p.owned.length
        ? p.owned.map((o) => `<span>${o.emoji || ""} ${esc(o.name)} · ${fmt(o.price)}</span>`).join("")
        : `<span class="none">עוד לא קנה כלום</span>`;
      div.innerHTML = `
        <div class="pcard-head">
          <span class="pcard-name">${esc(p.name)}</span>
          <span class="pcard-left ${pct < 20 ? "low" : ""}">${fmt(p.left)}</span>
        </div>
        <div class="meter" aria-hidden="true"><div style="width:${pct}%"></div></div>
        <div class="pcard-sub">נשאר מתוך ${fmt(p.start)} · ${p.owned.length} פריטים</div>
        <div class="owned">${owned}</div>`;
      box.appendChild(div);
    });
  }

  function renderBuyers() {
    const g = state.game;
    const box = $("buyerButtons");
    box.innerHTML = "";
    g.players.forEach((p, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "buyer";
      b.style.setProperty("--pc", p.color);
      b.setAttribute("aria-pressed", String(g.selected === i));
      b.innerHTML = `${esc(p.name)} <small>(${fmt(p.left)})</small>`;
      b.addEventListener("click", () => {
        g.selected = i; save(); renderBuyers();
        $("judgeError").hidden = true;
        $("priceInput").focus();
      });
      box.appendChild(b);
    });
  }

  function renderHistory() {
    const g = state.game;
    $("historyList").innerHTML = g.history.length
      ? g.history.map((h) => h.player == null
          ? `<li>${esc(h.item.name)}: אף אחד לא לקח</li>`
          : `<li>${esc(h.item.name)}: ${esc(g.players[h.player].name)} שילם ${fmt(h.price)}</li>`).join("")
      : "<li>עוד אין סיבובים</li>";
  }

  function judgeError(msg) { const e = $("judgeError"); e.textContent = msg; e.hidden = false; }

  document.querySelectorAll("#quickAdds button").forEach((b) => {
    b.addEventListener("click", () => {
      const add = Number(b.dataset.add);
      const inp = $("priceInput");
      inp.value = add === 0 ? "" : String((Number(inp.value) || 0) + add);
      inp.focus();
    });
  });

  function confirmRound() {
    const g = state.game;
    if (g.selected == null) return judgeError("בחרו קודם מי לקח את הפריט.");
    const raw = $("priceInput").value.trim();
    const price = Number(raw);
    if (raw === "" || !Number.isFinite(price) || price < 0) return judgeError("הקלידו כמה הוא שילם (מספר, 0 ומעלה).");
    const p = g.players[g.selected];
    if (price > p.left) return judgeError(`ל${p.name} נשארו רק ${fmt(p.left)}. אי אפשר לשלם ${fmt(price)}.`);
    const item = g.queue[g.index];
    p.left -= price;
    p.owned.push({ ...item, price });
    g.history.push({ index: g.index, item, player: g.selected, price });
    const flashIdx = g.selected;
    g.selected = null;
    g.index++;
    save();
    if (g.index >= g.queue.length) return show("end");
    renderGame(true);
    renderScoreboard(flashIdx);
  }

  function skipRound() {
    const g = state.game;
    g.history.push({ index: g.index, item: g.queue[g.index], player: null, price: 0 });
    g.selected = null;
    g.index++;
    save();
    if (g.index >= g.queue.length) return show("end");
    renderGame(true);
  }

  function undoRound() {
    const g = state.game;
    const h = g.history.pop();
    if (!h) return;
    if (h.player != null) {
      const p = g.players[h.player];
      p.left += h.price;
      p.owned.pop();
    }
    g.index = h.index;
    g.selected = h.player;
    save();
    if (state.phase !== "game") { show("game"); } else { renderGame(true); }
    if (h.player != null) $("priceInput").value = String(h.price);
    renderBuyers();
  }

  $("confirmBtn").addEventListener("click", confirmRound);
  $("priceInput").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmRound(); });
  $("skipBtn").addEventListener("click", skipRound);
  $("undoBtn").addEventListener("click", undoRound);

  $("insertBtn").addEventListener("click", () => {
    $("insertBox").hidden = !$("insertBox").hidden;
    if (!$("insertBox").hidden) $("insertInput").focus();
  });
  function insertItem() {
    const v = $("insertInput").value.trim();
    if (!v) return;
    const g = state.game;
    g.queue.splice(g.index + 1, 0, { emoji: "🏷️", name: v });
    $("insertInput").value = "";
    save();
    const keepSel = g.selected, keepPrice = $("priceInput").value;
    renderGame(false);
    g.selected = keepSel; $("priceInput").value = keepPrice; renderBuyers();
  }
  $("insertConfirm").addEventListener("click", insertItem);
  $("insertInput").addEventListener("keydown", (e) => { if (e.key === "Enter") insertItem(); });

  $("endBtn").addEventListener("click", () => { $("endConfirm").hidden = false; });
  $("endNo").addEventListener("click", () => { $("endConfirm").hidden = true; });
  $("endYes").addEventListener("click", () => show("end"));

  /* ================= END ================= */
  function renderEnd() {
    const g = state.game;
    if (!g) return show("setup");
    $("endTitle").textContent = `${g.productEmoji || ""} ${g.productName}`.trim();
    const sold = g.history.filter((h) => h.player != null).length;
    const notOffered = g.queue.length - g.index;
    $("endSub").textContent = `נמכרו ${sold} פריטים` + (notOffered > 0 ? ` · ${notOffered} לא הגיעו למכירה` : "");

    const maxItems = Math.max(...g.players.map((p) => p.owned.length));
    const maxLeft = Math.max(...g.players.map((p) => p.left));
    const box = $("results");
    box.innerHTML = "";
    g.players.forEach((p) => {
      const spent = p.start - p.left;
      const badges = [];
      if (p.owned.length === maxItems && maxItems > 0) badges.push("הכי הרבה פריטים");
      if (p.left === maxLeft && g.players.length > 1) badges.push("הכי חסכן");
      const lines = p.owned.length
        ? p.owned.map((o) => `<div class="line"><span>${o.emoji || ""} ${esc(o.name)}</span><span>${fmt(o.price)}</span></div>`).join("")
        : `<div class="empty">לא קנה כלום</div>`;
      const card = document.createElement("article");
      card.className = "rcard";
      card.style.setProperty("--pc", p.color);
      card.innerHTML = `
        <div class="rcard-head"><h3>${esc(p.name)}</h3>${badges.map((b) => `<span class="badge">${b}</span>`).join("")}</div>
        <div class="receipt">${lines}</div>
        <div class="totals">
          <div><span>פריטים</span><span>${p.owned.length}</span></div>
          <div><span>סה"כ הוצאות</span><span>${fmt(spent)}</span></div>
          <div><span>תקציב התחלתי</span><span>${fmt(p.start)}</span></div>
          <div class="left"><span>נשאר</span><span>${fmt(p.left)}</span></div>
        </div>`;
      box.appendChild(card);
    });

    const skipped = g.history.filter((h) => h.player == null).map((h) => h.item)
      .concat(g.queue.slice(g.index));
    $("skippedBox").hidden = skipped.length === 0;
    $("endUndoBtn").hidden = g.history.length === 0;
    $("skippedList").innerHTML = skipped.map((it) => `<span class="chip">${it.emoji || ""} ${esc(it.name)}</span>`).join("");
  }

  $("replayBtn").addEventListener("click", startGame);
  $("endUndoBtn").addEventListener("click", undoRound);
  $("newProductBtn").addEventListener("click", () => { state.game = null; show("setup"); });

  /* ---------------- לוגו: חזרה לדף הבית ---------------- */
  function goHome() {
    $("homeConfirm").hidden = true;
    state.game = null;
    show("setup");
  }
  $("homeBtn").addEventListener("click", () => {
    // באמצע משחק שכבר נמכרו בו פריטים, מבקשים אישור כדי לא למחוק בטעות
    if (state.phase === "game" && state.game && state.game.history.length > 0) {
      $("homeConfirm").hidden = false;
      $("homeYes").focus();
    } else {
      goHome();
    }
  });
  $("homeYes").addEventListener("click", goHome);
  $("homeNo").addEventListener("click", () => { $("homeConfirm").hidden = true; });

  /* ---------------- boot ---------------- */
  show(state.game ? state.phase : "setup");
})();
