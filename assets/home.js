/* ============================================================
   INTELLECT V2 — логика главной
   ============================================================ */
(function () {
  "use strict";
  var I = window.INTELLECT, S = I.store, RM = I.RM;

  I.onReady(function () {
    renderStats();
    I.initChrome();
    I.initParallax();
    factOfDay();
    renderFeature();
    renderTiles();
    renderFeed();
    ctaForm();
    cubeParallax();
  });

  /* ---------- статистика ---------- */
  function renderStats() {
    var st = S.stats();
    set("st-articles", st.articles); set("st-facts", st.facts);
    set("st-cats", st.categories); set("st-days", st.days);
    function set(id, v) { var el = document.getElementById(id); if (el) el.setAttribute("data-count", v); }
  }

  /* ---------- факт дня ---------- */
  function factOfDay() {
    var facts = S.facts();
    var elText = document.getElementById("fact-text");
    var elBtn = document.getElementById("fact-btn");
    var elCount = document.getElementById("fact-count");
    var badge = document.getElementById("fact-badge");
    elCount.textContent = "в базе " + facts.length + " фактов";
    function pick() {
      var seen = S.seenFacts(), pool = [];
      for (var i = 0; i < facts.length; i++) if (seen.indexOf(i) === -1) pool.push(i);
      if (!pool.length) pool = facts.map(function (_, i) { return i; });
      return pool[Math.floor(Math.random() * pool.length)];
    }
    function show(animate) {
      var idx = pick(); S.markFactSeen(idx, facts.length);
      if (animate && !RM) {
        badge.classList.add("spin"); elText.classList.add("swap");
        setTimeout(function () { elText.textContent = facts[idx]; elText.classList.remove("swap"); }, 360);
        setTimeout(function () { badge.classList.remove("spin"); }, 720);
      } else elText.textContent = facts[idx];
    }
    elBtn.addEventListener("click", function () { show(true); });
    show(false);
  }

  /* ---------- главная публикация ---------- */
  function renderFeature() {
    var list = S.articles(), art = null;
    for (var i = 0; i < list.length; i++) if (list[i].featured) { art = list[i]; break; }
    if (!art) art = list[0];
    var el = document.getElementById("feature");
    if (!art || !el) { if (el) el.style.display = "none"; return; }
    el.innerHTML =
      I.coverHTML(art) +
      '<div class="feature-body">' +
        I.chip(art.category, { long: true }) +
        '<h3>' + I.esc(art.title) + '</h3>' +
        '<p>' + I.esc(art.excerpt) + '</p>' +
        '<div class="meta">' + I.esc(art.author) + ' · ' + I.fmtDate(art.date) + ' · ' + art.readMins + ' мин</div>' +
        '<span class="more">Читать статью ' + I.icon("arrow") + '</span>' +
      '</div>';
    el.addEventListener("click", function () { location.href = I.articleUrl(art.id); });
  }

  /* ---------- категории-плитки ---------- */
  function renderTiles() {
    var box = document.getElementById("tiles");
    if (!box) return;
    var cats = S.categories().filter(function (c) { return c.tile; });
    box.innerHTML = cats.map(function (c) {
      var n = S.byCategory(c.id).length;
      return '<a class="tile ct-' + c.id + '" data-cat="' + c.id + '" href="#feed">' +
        '<span class="cov-grid" aria-hidden="true"></span>' +
        '<span class="t-ico">' + I.icon(c.icon) + '</span>' +
        '<span class="t-arrow">' + I.icon("arrow") + '</span>' +
        '<h3>' + I.esc(c.label) + '</h3>' +
        '<span class="t-count">' + n + ' ' + plural(n, ["публикация", "публикации", "публикаций"]) + '</span>' +
      '</a>';
    }).join("");
    box.querySelectorAll(".tile").forEach(function (t) {
      t.addEventListener("click", function (e) {
        e.preventDefault();
        applyFilter(t.getAttribute("data-cat"));
        document.getElementById("feed").scrollIntoView({ behavior: RM ? "auto" : "smooth" });
      });
    });
  }
  function plural(n, f) { var m = n % 100, k = n % 10; return m > 4 && m < 21 ? f[2] : k === 1 ? f[0] : k > 1 && k < 5 ? f[1] : f[2]; }

  /* ---------- лента ---------- */
  var PAGE = 6, active = "all", shown = PAGE;
  function applyFilter(cat) {
    active = cat; shown = PAGE;
    var bar = document.getElementById("filter");
    if (bar) bar.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-cat") === cat); });
    drawFeed();
  }
  function renderFeed() {
    var bar = document.getElementById("filter");
    var pills = [{ id: "all", label: "Все" }].concat(S.categories().map(function (c) { return { id: c.id, label: c.short }; }));
    bar.innerHTML = pills.map(function (p, i) {
      return '<button data-cat="' + p.id + '" class="' + (i === 0 ? "on" : "") + '" role="tab">' + I.esc(p.label) + '</button>';
    }).join("");
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (b) applyFilter(b.getAttribute("data-cat"));
    });
    document.getElementById("feed-more").addEventListener("click", function () { shown += PAGE; drawFeed(); });
    drawFeed();
  }
  function feedList() {
    var all = S.articles();
    return active === "all" ? all : all.filter(function (a) { return a.category === active; });
  }
  function drawFeed() {
    var grid = document.getElementById("feed-grid");
    var items = feedList(), slice = items.slice(0, shown);
    if (!slice.length) grid.innerHTML = '<div class="feed-empty">В этой категории пока нет публикаций.</div>';
    else grid.innerHTML = slice.map(postCard).join("");
    grid.querySelectorAll(".post").forEach(function (c) {
      var go = function () { location.href = I.articleUrl(c.getAttribute("data-id")); };
      c.addEventListener("click", go);
    });
    document.getElementById("feed-more").style.display = items.length > shown ? "" : "none";
  }
  function postCard(a) {
    var c = S.categoryById(a.category);
    return '<article class="post" data-id="' + I.esc(a.id) + '" tabindex="0" role="link" aria-label="' + I.esc(a.title) + '">' +
      I.coverHTML(a) +
      '<div class="post-body">' +
        '<div class="post-meta"><span class="cat">' + I.esc(c.short) + '</span><span>·</span><span>' + I.fmtDate(a.date) + '</span></div>' +
        '<h3>' + I.esc(a.title) + '</h3>' +
        '<p>' + I.esc(a.excerpt) + '</p>' +
      '</div></article>';
  }

  /* ---------- подписка ---------- */
  function ctaForm() {
    var form = document.getElementById("cta-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = document.getElementById("cta-btn");
      btn.disabled = true; btn.textContent = "Готово";
      form.closest(".cta").classList.add("done");
    });
  }

  /* ---------- параллакс куба ---------- */
  function cubeParallax() {
    if (RM) return;
    var stage = document.querySelector(".cube-stage");
    var hero = document.querySelector(".hero");
    if (!stage || !hero) return;
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      stage.style.perspectiveOrigin = (40 + x * 20) + "% " + (35 + y * 30) + "%";
    });
    hero.addEventListener("pointerleave", function () { stage.style.perspectiveOrigin = "50% 40%"; });
  }
})();
