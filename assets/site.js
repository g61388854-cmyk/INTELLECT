/* ============================================================
   INTELLECT V2 — общий скрипт: хранилище, помощники, интерфейс
   ============================================================ */
(function (g) {
  "use strict";

  var RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var LAUNCH = new Date("2025-09-01T00:00:00Z");
  var TELEGRAM = "https://t.me/ai0090012";

  /* ---------------- ХРАНИЛИЩЕ ---------------- */
  var K = {
    custom: "intellect-articles-custom",
    edits: "intellect-articles-edits",
    deleted: "intellect-articles-deleted",
    factsCustom: "intellect-facts-custom",
    factsRemoved: "intellect-facts-removed",
    seenFacts: "intellect-facts-seen"
  };
  function readJSON(key, fb) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
  function writeJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }

  var Store = {
    categories: function () { return (g.INTELLECT_CATEGORIES || []).slice(); },
    categoryById: function (id) {
      var list = g.INTELLECT_CATEGORIES || [];
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return { id: id || "ai", label: "Новости", short: "Новости", icon: "network" };
    },
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
    byId: function (id) { var l = this.articles(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; },
    byCategory: function (cat) { return this.articles().filter(function (a) { return a.category === cat; }); },
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
    saveArticle: function (art) {
      if (this.isSeed(art.id)) { var e = readJSON(K.edits, {}); e[art.id] = art; writeJSON(K.edits, e); }
      else {
        var c = readJSON(K.custom, []), found = false;
        for (var i = 0; i < c.length; i++) if (c[i].id === art.id) { c[i] = art; found = true; break; }
        if (!found) c.unshift(art);
        writeJSON(K.custom, c);
      }
    },
    deleteArticle: function (id) {
      if (this.isSeed(id)) { var d = readJSON(K.deleted, []); if (d.indexOf(id) === -1) { d.push(id); writeJSON(K.deleted, d); } }
      else writeJSON(K.custom, readJSON(K.custom, []).filter(function (a) { return a.id !== id; }));
    },
    facts: function () {
      var seed = (g.INTELLECT_FACTS || []).slice();
      var removed = readJSON(K.factsRemoved, []);
      var custom = readJSON(K.factsCustom, []);
      return seed.filter(function (f) { return removed.indexOf(f) === -1; }).concat(custom);
    },
    addFact: function (t) { var c = readJSON(K.factsCustom, []); c.push(t); writeJSON(K.factsCustom, c); },
    removeFact: function (t) {
      var c = readJSON(K.factsCustom, []), i = c.indexOf(t);
      if (i !== -1) { c.splice(i, 1); writeJSON(K.factsCustom, c); return; }
      var r = readJSON(K.factsRemoved, []); if (r.indexOf(t) === -1) { r.push(t); writeJSON(K.factsRemoved, r); }
    },
    seenFacts: function () { return readJSON(K.seenFacts, []); },
    markFactSeen: function (i, total) {
      var s = readJSON(K.seenFacts, []); s.push(i);
      while (s.length > Math.min(40, Math.floor(total * 0.6))) s.shift();
      writeJSON(K.seenFacts, s);
    },
    stats: function () {
      return {
        articles: this.articles().length,
        facts: this.facts().length,
        categories: this.categories().length,
        days: Math.max(1, Math.floor((Date.now() - LAUNCH.getTime()) / 86400000))
      };
    }
  };

  /* ---------------- ИКОНКИ (минимальные, currentColor) ---------------- */
  var P = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">';
  var ICONS = {
    network: P + '<circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="7" r="2.4"/><circle cx="12" cy="17" r="2.4"/><path d="M8 7.5l2.5 7M16 9l-3 6M8 6.6l8 .5"/></svg>',
    layers: P + '<path d="M12 4l8 4-8 4-8-4 8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 16l8 4 8-4" opacity=".5"/></svg>',
    cpu: P + '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v2M14 3v2M10 19v2M14 19v2M3 10h2M3 14h2M19 10h2M19 14h2"/></svg>',
    hex: P + '<path d="M12 3l7.5 4.3v9.4L12 21l-7.5-4.3V7.3L12 3z"/><circle cx="12" cy="12" r="2.6"/></svg>',
    flask: P + '<path d="M9 3h6M10 3v6l-4.5 8.5A2 2 0 007.3 21h9.4a2 2 0 001.8-3.5L14 9V3"/><path d="M8 15h8"/></svg>',
    trend: P + '<path d="M4 17l5-5 3 3 7-7"/><path d="M15 8h5v5"/></svg>',
    compass: P + '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5 5-2z"/></svg>',
    doc: P + '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    quote: P + '<path d="M7 7h4v4c0 2.2-1.3 3.6-3.5 4M14 7h4v4c0 2.2-1.3 3.6-3.5 4"/></svg>',
    grid: P + '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
    calendar: P + '<rect x="4" y="5" width="16" height="16" rx="2.5"/><path d="M4 9h16M8 3v4M16 3v4"/></svg>',
    bolt: P + '<path d="M12 3v7M12 14v7M5 8l7 6 7-6"/></svg>',
    arrow: P + '<path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    sun: P + '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: P + '<path d="M20 14.5A8 8 0 119.5 4 6.5 6.5 0 0020 14.5z"/></svg>',
    plus: P + '<path d="M12 5v14M5 12h14"/></svg>',
    edit: P + '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
    trash: P + '<path d="M4 7h16M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13"/></svg>',
    settings: P + '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 00-2-1.2L14 2h-4l-.5 2.4a7 7 0 00-2 1.2l-2.4-1-2 3.5 2 1.5A7 7 0 005 12a7 7 0 00.1 1.2l-2 1.5 2 3.5 2.4-1a7 7 0 002 1.2L10 22h4l.5-2.4a7 7 0 002-1.2l2.4 1 2-3.5-2-1.5A7 7 0 0019 12z"/></svg>',
    chart: P + '<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-7"/></svg>',
    news: P + '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h6M7 13h10M7 17h10" opacity=".7"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 3.6 2.9 10.8c-1 .4-.97 1.4.06 1.7l4.6 1.45 1.77 5.4c.3.9 1.06 1.05 1.7.4l2.5-2.4 4.7 3.4c.8.5 1.6.2 1.8-.8l3-15.2c.3-1.2-.5-1.7-1.53-1.15Z"/></svg>',
    logo: '<svg viewBox="0 0 32 32" fill="none"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E7D6AE"/><stop offset="1" stop-color="#9A7B33"/></linearGradient></defs><path d="M16 2.5l11.7 6.75v13.5L16 29.5 4.3 22.75V9.25L16 2.5z" stroke="url(#lg)" stroke-width="1.4"/><path d="M16 9v14M16 9l6 3.5M16 9l-6 3.5M16 23l6-3.5M16 23l-6-3.5" stroke="url(#lg)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="16" r="2.1" fill="url(#lg)"/></svg>'
  };
  function icon(name) { return ICONS[name] || ICONS.network; }
  function catIcon(catId) { return icon(Store.categoryById(catId).icon || "network"); }

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
  function articleUrl(id) { return "article.html?id=" + encodeURIComponent(id); }
  function slug(s) {
    var map = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"c",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
    return String(s || "").toLowerCase().replace(/[а-яё]/g, function (c) { return map[c] || ""; })
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "post";
  }
  function coverHTML(art) {
    var cls = "cover ct-" + esc(art.category);
    var inner =
      '<span class="cov-tint"></span><span class="cov-grid"></span><span class="cov-sheen"></span>' +
      '<span class="cov-ico" aria-hidden="true">' + catIcon(art.category) + '</span>';
    if (art.image) inner += '<img src="' + esc(art.image) + '" alt="">';
    return '<div class="' + cls + '">' + inner + '</div>';
  }
  function chip(catId, opts) {
    var c = Store.categoryById(catId);
    var label = (opts && opts.long) ? c.label : c.short;
    return '<span class="cat-badge">' + catIcon(catId) + esc(label) + '</span>';
  }

  /* ---------------- ТЕМА ---------------- */
  function initTheme() {
    var root = document.documentElement;
    function apply(t) { root.dataset.theme = t; try { localStorage.setItem("intellect-theme", t); } catch (e) {} }
    // data-theme уже выставлен пре-пейнт скриптом; здесь только переключатель
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        apply(root.dataset.theme === "dark" ? "light" : "dark");
      });
    });
  }

  /* ---------------- ОБЩИЙ ИНТЕРФЕЙС ---------------- */
  function initChrome() {
    var year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();

    initTheme();

    // лого-марки и иконки
    document.querySelectorAll("[data-logo]").forEach(function (el) { el.innerHTML = icon("logo"); });
    document.querySelectorAll("[data-ico]").forEach(function (el) { el.innerHTML = icon(el.getAttribute("data-ico")); });
    document.querySelectorAll("[data-tg]").forEach(function (el) { el.insertAdjacentHTML("afterbegin", icon("telegram")); });
    document.querySelectorAll("[data-tg-fab]").forEach(function (el) { el.innerHTML = icon("telegram"); });

    // прогресс + тень навигации
    var progress = document.getElementById("progress");
    var nav = document.getElementById("nav");
    function onScroll() {
      var h = document.documentElement, max = h.scrollHeight - h.clientHeight;
      if (progress) progress.style.transform = "scaleX(" + (max > 0 ? h.scrollTop / max : 0) + ")";
      if (nav) nav.classList.toggle("scrolled", h.scrollTop > 12);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // мобильное меню
    var burger = document.getElementById("burger");
    if (burger) {
      burger.addEventListener("click", function () { document.body.classList.toggle("menu-open"); });
      document.querySelectorAll("#mobile-menu a").forEach(function (a) {
        a.addEventListener("click", function () { document.body.classList.remove("menu-open"); });
      });
    }

    // reveal
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });

    initCounters();
  }

  function initCounters() {
    var els = document.querySelectorAll("[data-count]");
    if (!els.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var el = e.target, end = +el.getAttribute("data-count"), dur = 1500, t0 = 0;
        if (RM) { el.textContent = end.toLocaleString("ru-RU"); return; }
        (function step(ts) {
          if (!t0) t0 = ts;
          var k = Math.min(1, (ts - t0) / dur), eased = 1 - Math.pow(1 - k, 3);
          el.textContent = Math.round(end * eased).toLocaleString("ru-RU");
          if (k < 1) requestAnimationFrame(step);
        })(0);
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* subtle parallax по data-parallax (скорость) */
  function initParallax() {
    if (RM) return;
    var els = [].slice.call(document.querySelectorAll("[data-parallax]"));
    if (!els.length) return;
    var ticking = false;
    function upd() {
      var vh = window.innerHeight;
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var prog = (r.top + r.height / 2 - vh / 2) / vh;
        var sp = parseFloat(el.getAttribute("data-parallax")) || 0.1;
        el.style.transform = "translateY(" + (prog * sp * -100) + "px)";
      });
      ticking = false;
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  }

  g.INTELLECT = {
    store: Store, RM: RM, TELEGRAM: TELEGRAM,
    esc: esc, fmtDate: fmtDate, articleUrl: articleUrl, coverHTML: coverHTML, chip: chip,
    icon: icon, catIcon: catIcon, slug: slug,
    initChrome: initChrome, initParallax: initParallax,
    onReady: function (fn) {
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
      else fn();
    }
  };
})(window);
