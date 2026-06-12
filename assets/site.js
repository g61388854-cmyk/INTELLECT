/* ============================================================
   INTELLECT — общий скрипт: хранилище, интерфейс, робот
   ============================================================ */
(function (g) {
  "use strict";

  var RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FINE = window.matchMedia("(pointer: fine)").matches;
  var LAUNCH = new Date("2025-09-01T00:00:00Z");
  var TELEGRAM = "https://t.me/ai0090012";

  /* ---------------- ХРАНИЛИЩЕ КОНТЕНТА ---------------- */
  var K = {
    custom: "intellect-articles-custom",
    edits: "intellect-articles-edits",
    deleted: "intellect-articles-deleted",
    factsCustom: "intellect-facts-custom",
    factsRemoved: "intellect-facts-removed",
    seenFacts: "intellect-facts-seen"
  };
  function readJSON(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }

  var Store = {
    categories: function () { return (g.INTELLECT_CATEGORIES || []).slice(); },
    categoryById: function (id) {
      var list = g.INTELLECT_CATEGORIES || [];
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return { id: id || "ai", label: "Новости", short: "Новости" };
    },
    /* объединяем seed + кастомные + правки − удалённые, сортируем по дате */
    articles: function () {
      var seed = (g.INTELLECT_ARTICLES || []).slice();
      var generated = (g.INTELLECT_GENERATED || []).slice();
      var custom = readJSON(K.custom, []);
      var edits = readJSON(K.edits, {});
      var deleted = readJSON(K.deleted, []);
      var all = custom.concat(generated, seed);
      var seen = {}, out = [];
      for (var i = 0; i < all.length; i++) {
        var a = all[i];
        if (!a || !a.id || seen[a.id]) continue;
        seen[a.id] = 1;
        if (deleted.indexOf(a.id) !== -1) continue;
        if (edits[a.id]) a = Object.assign({}, a, edits[a.id]);
        out.push(a);
      }
      out.sort(function (x, y) { return (y.date || "").localeCompare(x.date || ""); });
      return out;
    },
    byId: function (id) {
      var list = this.articles();
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },
    related: function (id, n) {
      var cur = this.byId(id); if (!cur) return [];
      var list = this.articles().filter(function (a) { return a.id !== id; });
      var same = list.filter(function (a) { return a.category === cur.category; });
      var rest = list.filter(function (a) { return a.category !== cur.category; });
      return same.concat(rest).slice(0, n || 3);
    },
    isSeed: function (id) {
      var seed = (g.INTELLECT_ARTICLES || []).concat(g.INTELLECT_GENERATED || []);
      for (var i = 0; i < seed.length; i++) if (seed[i].id === id) return true;
      return false;
    },
    /* --- админка: запись --- */
    saveArticle: function (art) {
      if (this.isSeed(art.id)) {
        var edits = readJSON(K.edits, {}); edits[art.id] = art; writeJSON(K.edits, edits);
      } else {
        var custom = readJSON(K.custom, []);
        var found = false;
        for (var i = 0; i < custom.length; i++) if (custom[i].id === art.id) { custom[i] = art; found = true; break; }
        if (!found) custom.unshift(art);
        writeJSON(K.custom, custom);
      }
    },
    deleteArticle: function (id) {
      if (this.isSeed(id)) {
        var deleted = readJSON(K.deleted, []);
        if (deleted.indexOf(id) === -1) { deleted.push(id); writeJSON(K.deleted, deleted); }
      } else {
        var custom = readJSON(K.custom, []).filter(function (a) { return a.id !== id; });
        writeJSON(K.custom, custom);
      }
    },
    /* --- факты --- */
    facts: function () {
      var seed = (g.INTELLECT_FACTS || []).slice();
      var removed = readJSON(K.factsRemoved, []);
      var custom = readJSON(K.factsCustom, []);
      var base = seed.filter(function (f) { return removed.indexOf(f) === -1; });
      return base.concat(custom);
    },
    addFact: function (text) {
      var custom = readJSON(K.factsCustom, []); custom.push(text); writeJSON(K.factsCustom, custom);
    },
    removeFact: function (text) {
      var custom = readJSON(K.factsCustom, []);
      var idx = custom.indexOf(text);
      if (idx !== -1) { custom.splice(idx, 1); writeJSON(K.factsCustom, custom); return; }
      var removed = readJSON(K.factsRemoved, []);
      if (removed.indexOf(text) === -1) { removed.push(text); writeJSON(K.factsRemoved, removed); }
    },
    seenFacts: function () { return readJSON(K.seenFacts, []); },
    markFactSeen: function (i, total) {
      var seen = readJSON(K.seenFacts, []);
      seen.push(i);
      while (seen.length > Math.min(40, Math.floor(total * 0.6))) seen.shift();
      writeJSON(K.seenFacts, seen);
    },
    stats: function () {
      var days = Math.max(1, Math.floor((Date.now() - LAUNCH.getTime()) / 86400000));
      return {
        articles: this.articles().length,
        facts: this.facts().length,
        categories: this.categories().length,
        days: days
      };
    }
  };

  /* ---------------- ХЕЛПЕРЫ ОТРИСОВКИ ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDate(iso) {
    var M = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
    var d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso || "";
    return d.getDate() + " " + M[d.getMonth()] + " " + d.getFullYear();
  }
  function articleUrl(id) {
    var base = location.pathname.indexOf("/news/") !== -1 ? "../article.html" : "article.html";
    return base + "?id=" + encodeURIComponent(id);
  }
  function coverHTML(art) {
    var cat = Store.categoryById(art.category);
    if (art.image) {
      return '<div class="cover cv-' + esc(art.category) + '">' +
        '<img src="' + esc(art.image) + '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0">' +
        '</div>';
    }
    var mark = (art.source || cat.short || "AI").charAt(0).toUpperCase();
    return '<div class="cover cv-' + esc(art.category) + '"><span class="orb"></span><span class="glyph">' + esc(mark) + '</span></div>';
  }
  function chip(catId) {
    var c = Store.categoryById(catId);
    return '<span class="chip cat-' + esc(catId) + '">' + esc(c.label) + '</span>';
  }

  /* ---------------- ОБЩИЙ ИНТЕРФЕЙС ---------------- */
  function initChrome() {
    var year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();

    /* прогресс + тень навигации */
    var progress = document.getElementById("progress");
    var nav = document.getElementById("nav");
    function onScroll() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      if (progress) progress.style.transform = "scaleX(" + (max > 0 ? h.scrollTop / max : 0) + ")";
      if (nav) nav.classList.toggle("scrolled", h.scrollTop > 24);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    /* мобильное меню */
    var burger = document.getElementById("burger");
    if (burger) {
      burger.addEventListener("click", function () { document.body.classList.toggle("menu-open"); });
      document.querySelectorAll("#mobile-menu a").forEach(function (a) {
        a.addEventListener("click", function () { document.body.classList.remove("menu-open"); });
      });
    }

    /* reveal */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });

    initCursor();
    initGlow();
    initNetwork();
    initCounters();
  }

  /* курсор-самолёт */
  function initCursor() {
    if (!FINE || RM) return;
    var cur = document.getElementById("cursor");
    if (!cur) return;
    document.documentElement.classList.add("custom-cursor");
    var cx = innerWidth / 2, cy = innerHeight / 2, mx = cx, my = cy, ang = -45;
    window.addEventListener("pointermove", function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });
    document.addEventListener("pointerover", function (e) {
      var t = e.target.closest ? e.target.closest("a,button,input,textarea,select,.card,.trend,.article-card,.related-card,.filter-pill") : null;
      cur.classList.toggle("grow", !!t);
    });
    window.addEventListener("pointerdown", function (e) {
      cur.classList.add("press");
      var ring = document.createElement("span");
      ring.className = "click-pulse";
      ring.style.left = e.clientX + "px"; ring.style.top = e.clientY + "px";
      document.body.appendChild(ring);
      ring.addEventListener("animationend", function () { ring.remove(); });
    });
    window.addEventListener("pointerup", function () { cur.classList.remove("press"); });
    (function loop() {
      var dx = mx - cx, dy = my - cy;
      cx += dx * 0.16; cy += dy * 0.16;
      var speed = Math.hypot(dx, dy);
      var target = speed > 2.5 ? Math.atan2(dy, dx) * 57.2958 : -45;
      var diff = ((target - ang + 540) % 360) - 180;
      ang += diff * 0.14;
      cur.style.transform = "translate(" + cx + "px," + cy + "px) rotate(" + ang + "deg)";
      requestAnimationFrame(loop);
    })();
  }

  function initGlow() {
    var glow = document.getElementById("glow");
    if (!glow) return;
    if (!FINE || RM) { glow.style.display = "none"; return; }
    var gx = innerWidth / 2, gy = innerHeight / 3, tx = gx, ty = gy;
    window.addEventListener("pointermove", function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });
    (function loop() {
      gx += (tx - gx) * 0.08; gy += (ty - gy) * 0.08;
      glow.style.transform = "translate(" + (gx - 320) + "px," + (gy - 320) + "px)";
      requestAnimationFrame(loop);
    })();
  }

  /* фоновая нейросеть */
  function initNetwork() {
    if (RM) return;
    var c = document.getElementById("net");
    if (!c) return;
    var ctx = c.getContext("2d");
    var W = 0, H = 0, P = [], mouse = { x: -1e4, y: -1e4 };
    var NODES = [[212,160,23],[229,229,229],[180,58,94]];
    var LINES = ["212,160,23", "229,229,229"];
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = c.clientWidth; H = c.clientHeight;
      c.width = W * dpr; c.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize(); window.addEventListener("resize", resize);
    var N = Math.max(30, Math.min(80, Math.floor(W * H / 22000)));
    for (var i = 0; i < N; i++) P.push({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3,
      r: Math.random() * 1.5 + .6, c: NODES[i % 3]
    });
    window.addEventListener("pointermove", function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    var LINK = 128;
    (function tick() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < P.length; i++) {
        var p = P[i]; p.x += p.vx; p.y += p.vy;
        if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
      }
      for (var i = 0; i < P.length; i++) {
        for (var j = i + 1; j < P.length; j++) {
          var a = P[i], b = P[j], dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy;
          if (d < LINK * LINK) {
            var al = (1 - Math.sqrt(d) / LINK) * .2;
            ctx.strokeStyle = "rgba(" + LINES[(i + j) % 2] + "," + al + ")";
            ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        var p = P[i], mdx = p.x - mouse.x, mdy = p.y - mouse.y, md = mdx * mdx + mdy * mdy;
        if (md < 28900) {
          var ma = (1 - Math.sqrt(md) / 170) * .4;
          ctx.strokeStyle = "rgba(212,160,23," + ma + ")"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
      for (var i = 0; i < P.length; i++) {
        var p = P[i];
        ctx.fillStyle = "rgba(" + p.c[0] + "," + p.c[1] + "," + p.c[2] + ",.8)";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      }
      requestAnimationFrame(tick);
    })();
  }

  /* анимированные счётчики */
  function initCounters() {
    var els = document.querySelectorAll("[data-count]");
    if (!els.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var el = e.target, end = +el.getAttribute("data-count"), dur = 1400, t0 = 0;
        if (RM) { el.textContent = end.toLocaleString("ru-RU"); return; }
        (function step(ts) {
          if (!t0) t0 = ts;
          var k = Math.min(1, (ts - t0) / dur);
          var eased = 1 - Math.pow(1 - k, 3);
          el.textContent = Math.round(end * eased).toLocaleString("ru-RU");
          if (k < 1) requestAnimationFrame(step);
        })(0);
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- РОБОТ-ПЕРСОНАЖ ---------------- */
  function robotSVG() {
    return '' +
'<svg class="robot" viewBox="0 0 220 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Робот INTELLECT">' +
  '<defs>' +
    '<linearGradient id="rbody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2a30"/><stop offset="1" stop-color="#191920"/></linearGradient>' +
    '<linearGradient id="rhead" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#33333b"/><stop offset="1" stop-color="#1e1e25"/></linearGradient>' +
    '<linearGradient id="rgold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F2D27C"/><stop offset="1" stop-color="#D4A017"/></linearGradient>' +
    '<radialGradient id="rvisor" cx="50%" cy="42%" r="60%"><stop offset="0" stop-color="#2a1420"/><stop offset="1" stop-color="#120b10"/></radialGradient>' +
  '</defs>' +
  '<ellipse class="r-shadow" cx="110" cy="226" rx="62" ry="10" fill="#000" opacity="0.5"/>' +
  '<line x1="110" y1="44" x2="110" y2="20" stroke="url(#rgold)" stroke-width="3"/>' +
  '<circle class="r-antenna-tip" cx="110" cy="15" r="7" fill="url(#rgold)"/>' +
  /* руки */
  '<rect class="r-arm-l" x="20" y="120" width="20" height="64" rx="10" fill="url(#rbody)" stroke="rgba(212,160,23,.4)" stroke-width="1.5"/>' +
  '<rect class="r-arm-r" x="180" y="120" width="20" height="64" rx="10" fill="url(#rbody)" stroke="rgba(212,160,23,.5)" stroke-width="1.5"/>' +
  /* корпус */
  '<rect x="48" y="118" width="124" height="96" rx="26" fill="url(#rbody)" stroke="rgba(212,160,23,.45)" stroke-width="2"/>' +
  '<circle cx="110" cy="166" r="22" fill="none" stroke="url(#rgold)" stroke-width="2.5" opacity=".9"/>' +
  '<path d="M110 150 l5 13 13 3 -13 3 -5 13 -5 -13 -13 -3 13 -3z" fill="url(#rgold)"/>' +
  /* голова */
  '<rect x="58" y="44" width="104" height="80" rx="28" fill="url(#rhead)" stroke="rgba(212,160,23,.5)" stroke-width="2"/>' +
  '<rect x="70" y="58" width="80" height="52" rx="22" fill="url(#rvisor)" stroke="rgba(212,160,23,.25)" stroke-width="1.5"/>' +
  '<circle class="r-eye r-eye-l" cx="93" cy="84" r="8.5" fill="url(#rgold)"/>' +
  '<circle class="r-eye r-eye-r" cx="127" cy="84" r="8.5" fill="url(#rgold)"/>' +
  '<rect x="84" y="102" width="52" height="4" rx="2" fill="rgba(212,160,23,.5)"/>' +
'</svg>';
  }

  /* монтирует робота в контейнер, навешивает реакцию на мышь и приветствие */
  function mountRobot(container, opts) {
    opts = opts || {};
    container.innerHTML = robotSVG() + (opts.bubble === false ? "" : '<div class="robot-bubble" id="' + (opts.bubbleId || "robot-bubble") + '"></div>');
    var svg = container.querySelector(".robot");
    var bubble = container.querySelector(".robot-bubble");
    var eyes = container.querySelectorAll(".r-eye");

    if (FINE && !RM) {
      window.addEventListener("pointermove", function (e) {
        var r = svg.getBoundingClientRect();
        var cxp = r.left + r.width / 2, cyp = r.top + r.height * 0.35;
        var dx = Math.max(-3, Math.min(3, (e.clientX - cxp) / 60));
        var dy = Math.max(-2.5, Math.min(2.5, (e.clientY - cyp) / 60));
        eyes.forEach(function (ey) { ey.style.transform = "translate(" + dx + "px," + dy + "px)"; });
      }, { passive: true });
      svg.addEventListener("pointerenter", function () {
        svg.classList.add("wave");
        setTimeout(function () { svg.classList.remove("wave"); }, 1000);
        if (bubble && opts.hoverText) say(bubble, opts.hoverText, 2600);
      });
    }
    return { svg: svg, bubble: bubble, say: function (t, ms) { if (bubble) say(bubble, t, ms); }, wave: function () {
      svg.classList.add("wave"); setTimeout(function () { svg.classList.remove("wave"); }, 1000);
    } };
  }
  var bubbleTimer;
  function say(bubble, text, ms) {
    bubble.innerHTML = text;
    bubble.classList.add("show");
    clearTimeout(bubbleTimer);
    if (ms) bubbleTimer = setTimeout(function () { bubble.classList.remove("show"); }, ms);
  }

  g.INTELLECT = {
    store: Store, RM: RM, FINE: FINE, TELEGRAM: TELEGRAM,
    esc: esc, fmtDate: fmtDate, articleUrl: articleUrl, coverHTML: coverHTML, chip: chip,
    initChrome: initChrome, mountRobot: mountRobot,
    onReady: function (fn) {
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
      else fn();
    }
  };
})(window);
