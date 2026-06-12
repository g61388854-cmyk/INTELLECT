/* ============================================================
   INTELLECT — логика главной страницы
   ============================================================ */
(function () {
  "use strict";
  var I = window.INTELLECT, S = I.store, RM = I.RM;

  I.onReady(function () {
    I.initChrome();
    welcome();
    heroRobot();
    factOfDay();
    renderStats();
    renderTicker();
    renderFeatured();
    renderFeed();
    digestForm();
    accordion();
  });

  /* ---------- экран приветствия ---------- */
  function welcome() {
    var el = document.getElementById("welcome");
    if (!el) return;
    var done = false;
    try { done = localStorage.getItem("intellect-welcomed") === "1"; } catch (e) {}
    if (done || RM) { el.remove(); return; }
    document.body.classList.add("locked");
    var stage = el.querySelector(".w-stage");
    for (var i = 0; i < 34; i++) {
      var p = document.createElement("span");
      p.className = "w-p";
      var ang = Math.random() * 6.2832, rad = 110 + Math.random() * 130;
      p.style.setProperty("--dx", Math.cos(ang) * rad + "px");
      p.style.setProperty("--dy", Math.sin(ang) * rad + "px");
      p.style.setProperty("--d", (i * 28) + "ms");
      stage.appendChild(p);
    }
    var closed = false;
    function close() {
      if (closed) return; closed = true;
      el.classList.add("out");
      document.body.classList.remove("locked");
      try { localStorage.setItem("intellect-welcomed", "1"); } catch (e) {}
      setTimeout(function () { el.remove(); }, 900);
    }
    requestAnimationFrame(function () { el.classList.add("s1"); });
    setTimeout(function () { el.classList.add("s2"); }, 1500);
    setTimeout(function () { el.classList.add("s3"); }, 2000);
    setTimeout(close, 3400);
    el.addEventListener("click", close);
  }

  /* ---------- робот в hero ---------- */
  var heroBot;
  function heroRobot() {
    var box = document.getElementById("hero-robot");
    if (!box) return;
    heroBot = I.mountRobot(box, { hoverText: "Привет! Я помогу найти новости 🤖", bubbleId: "hero-bubble" });
    setTimeout(function () {
      heroBot.wave();
      heroBot.say("Привет! Я — робот <b>INTELLECT</b>. Покажу тебе новости и факты об ИИ.", 5200);
    }, RM ? 200 : 1200);
  }

  /* ---------- факт дня ---------- */
  function factOfDay() {
    var facts = S.facts();
    var elText = document.getElementById("fact-text");
    var elBtn = document.getElementById("fact-btn");
    var elCount = document.getElementById("fact-count");
    var deck = document.getElementById("fact-deck");
    var botBox = document.getElementById("fact-robot");
    var bot = I.mountRobot(botBox, { bubble: false });
    var robotEl = bot.svg;
    robotEl.classList.add("fact-robot");
    robotEl.style.width = "120px";

    elCount.textContent = "в базе " + facts.length + " фактов";

    function pickIndex() {
      var seen = S.seenFacts();
      var pool = [];
      for (var i = 0; i < facts.length; i++) if (seen.indexOf(i) === -1) pool.push(i);
      if (!pool.length) pool = facts.map(function (_, i) { return i; });
      return pool[Math.floor(Math.random() * pool.length)];
    }
    function show(animate) {
      var idx = pickIndex();
      S.markFactSeen(idx, facts.length);
      if (animate && !RM) {
        deck.classList.add("shuffling");
        robotEl.classList.add("shuffle");
        elText.classList.add("swap");
        setTimeout(function () {
          elText.textContent = facts[idx];
          elText.classList.remove("swap");
        }, 420);
        setTimeout(function () {
          deck.classList.remove("shuffling");
          robotEl.classList.remove("shuffle");
        }, 800);
      } else {
        elText.textContent = facts[idx];
      }
    }
    elBtn.addEventListener("click", function () { show(true); });
    // первый факт — сразу, без анимации
    show(false);
  }

  /* ---------- статистика ---------- */
  function renderStats() {
    var st = S.stats();
    set("stat-articles", st.articles);
    set("stat-facts", st.facts);
    set("stat-categories", st.categories);
    set("stat-days", st.days);
    function set(id, v) {
      var el = document.getElementById(id);
      if (el) { el.setAttribute("data-count", v); if (RM) el.textContent = v.toLocaleString("ru-RU"); }
    }
  }

  /* ---------- бегущая строка из заголовков ---------- */
  function renderTicker() {
    var track = document.getElementById("ticker");
    if (!track) return;
    var items = S.articles().slice(0, 6).map(function (a) { return a.title; });
    if (!items.length) items = ["Добро пожаловать в INTELLECT"];
    function group() {
      var g = document.createElement("div");
      g.className = "ticker-group";
      items.forEach(function (t) {
        var s = document.createElement("span"); s.className = "item"; s.textContent = t;
        var sep = document.createElement("span"); sep.className = "sep"; sep.textContent = "✦";
        g.appendChild(s); g.appendChild(sep);
      });
      return g;
    }
    track.appendChild(group());
    var g2 = group(); g2.setAttribute("aria-hidden", "true"); track.appendChild(g2);
  }

  /* ---------- материал дня ---------- */
  function renderFeatured() {
    var list = S.articles();
    var art = null;
    for (var i = 0; i < list.length; i++) if (list[i].featured) { art = list[i]; break; }
    if (!art) art = list[0];
    var wrap = document.getElementById("featured");
    var body = document.getElementById("featured-body");
    if (!art || !body) { if (wrap) wrap.style.display = "none"; return; }
    body.innerHTML =
      I.chip(art.category) +
      '<h3>' + I.esc(art.title) + '</h3>' +
      '<p>' + I.esc(art.excerpt) + '</p>' +
      '<div class="meta">' + I.esc(art.author) + ' · ' + I.fmtDate(art.date) + ' · ' + art.readMins + ' мин чтения</div>' +
      '<a class="more" href="' + I.articleUrl(art.id) + '">Читать полностью <span>→</span></a>';
    wrap.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      location.href = I.articleUrl(art.id);
    });
    if (I.FINE && !RM) {
      wrap.addEventListener("pointermove", function (e) {
        var r = wrap.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        wrap.style.transform = "perspective(1100px) rotateX(" + (-y * 3) + "deg) rotateY(" + (x * 3) + "deg)";
      });
      wrap.addEventListener("pointerleave", function () { wrap.style.transform = ""; });
    }
  }

  /* ---------- лента + фильтр категорий ---------- */
  var PAGE = 6;
  function renderFeed() {
    var grid = document.getElementById("feed-grid");
    var bar = document.getElementById("filterbar");
    var moreBtn = document.getElementById("feed-more");
    if (!grid) return;
    var cats = S.categories();
    var active = "all", shown = PAGE;

    var pills = [{ id: "all", label: "Все" }].concat(cats.map(function (c) { return { id: c.id, label: c.short }; }));
    bar.innerHTML = pills.map(function (p, i) {
      return '<button class="filter-pill' + (i === 0 ? " active" : "") + '" data-cat="' + p.id + '" role="tab">' + I.esc(p.label) + '</button>';
    }).join("");

    function list() {
      var all = S.articles();
      return active === "all" ? all : all.filter(function (a) { return a.category === active; });
    }
    function draw() {
      var items = list();
      var slice = items.slice(0, shown);
      if (!slice.length) {
        grid.innerHTML = '<div class="feed-empty">В этой категории пока нет публикаций.</div>';
      } else {
        grid.innerHTML = slice.map(card).join("");
      }
      bindCards(grid);
      moreBtn.style.display = items.length > shown ? "" : "none";
    }
    function card(a) {
      return '<article class="article-card reveal visible" data-id="' + I.esc(a.id) + '" tabindex="0" role="link" aria-label="' + I.esc(a.title) + '">' +
        I.coverHTML(a).replace('class="cover', 'class="cover') +
        '<div class="ac-body">' + I.chip(a.category) +
        '<h4>' + I.esc(a.title) + '</h4>' +
        '<p>' + I.esc(a.excerpt) + '</p>' +
        '<div class="ac-meta"><span>' + I.fmtDate(a.date) + '</span><span>·</span><span>' + a.readMins + ' мин</span></div>' +
        '</div></article>';
    }
    bar.addEventListener("click", function (e) {
      var b = e.target.closest(".filter-pill"); if (!b) return;
      active = b.getAttribute("data-cat"); shown = PAGE;
      bar.querySelectorAll(".filter-pill").forEach(function (x) { x.classList.toggle("active", x === b); });
      draw();
    });
    moreBtn.addEventListener("click", function () { shown += PAGE; draw(); });
    draw();
  }
  function bindCards(scope) {
    scope.querySelectorAll(".article-card").forEach(function (c) {
      var go = function () { location.href = I.articleUrl(c.getAttribute("data-id")); };
      c.addEventListener("click", go);
      c.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    });
  }

  /* ---------- форма подписки ---------- */
  function digestForm() {
    var form = document.getElementById("digest-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = document.getElementById("digest-btn");
      btn.disabled = true; btn.textContent = "Готово ✓";
      form.closest(".digest").classList.add("done");
    });
  }

  /* ---------- аккордеон ---------- */
  function accordion() {
    var acc = document.getElementById("accordion");
    if (!acc) return;
    var head = document.getElementById("acc-head");
    var body = document.getElementById("acc-body");
    head.addEventListener("click", function () {
      var open = acc.classList.toggle("open");
      head.setAttribute("aria-expanded", open ? "true" : "false");
      body.style.maxHeight = open ? body.scrollHeight + "px" : "0px";
    });
  }
})();
