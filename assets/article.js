/* ============================================================
   INTELLECT V2 — страница статьи (оглавление, цитаты, факты)
   ============================================================ */
(function () {
  "use strict";
  var I = window.INTELLECT, S = I.store;

  I.onReady(function () { I.initChrome(); render(); });

  function param(name) {
    var m = new RegExp("[?&]" + name + "=([^&]+)").exec(location.search);
    return m ? decodeURIComponent(m[1]) : "";
  }

  function render() {
    var root = document.getElementById("article-root");
    var id = param("id");
    var art = id ? S.byId(id) : null;

    if (!art) {
      document.title = "Статья не найдена — INTELLECT";
      root.innerHTML = '<div class="read"><div class="notfound"><h1>Материал не найден</h1>' +
        '<p>Возможно, публикация удалена или ссылка устарела.</p>' +
        '<a class="btn btn-primary" href="index.html#feed">Вернуться к ленте</a></div></div>';
      return;
    }
    document.title = art.title + " — INTELLECT";

    /* собираем заголовки → оглавление + id для анкоров */
    var headings = [], used = {};
    (art.body || []).forEach(function (b) {
      if (b && b.t === "h") {
        var s = I.slug(b.c); while (used[s]) s += "-x"; used[s] = 1;
        headings.push({ id: s, text: b.c }); b._id = s;
      }
    });
    var bodyHTML = (art.body || []).map(blockHTML).join("");

    var toc = headings.length >= 2 ? (
      '<nav class="toc"><h4>Содержание</h4><ol>' +
      headings.map(function (h) { return '<li><a href="#' + h.id + '">' + I.esc(h.text) + '</a></li>'; }).join("") +
      '</ol></nav>'
    ) : "";

    /* блок фактов по теме */
    var facts = S.facts(), fpick = [], pool = facts.slice();
    for (var i = 0; i < 3 && pool.length; i++) fpick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    var factsBlock = '<aside class="facts-block"><span class="eyebrow">Знаете ли вы</span><ul>' +
      fpick.map(function (f) { return '<li>' + I.esc(f) + '</li>'; }).join("") + '</ul></aside>';

    /* источник */
    var srcLink = art.link ? ' href="' + I.esc(art.link) + '" target="_blank" rel="noopener"' : "";
    var sourceCard =
      '<div class="sources">' +
        '<a class="source-card"' + srcLink + '><span class="s-ico">' + I.esc((art.source || "AI").charAt(0)) + '</span>' +
          '<span class="s-info"><b>' + I.esc(art.source || "Редакция") + '</b><span>Первоисточник материала</span></span></a>' +
        '<a class="source-card" href="' + I.TELEGRAM + '" target="_blank" rel="noopener"><span class="s-ico">' + I.icon("telegram") + '</span>' +
          '<span class="s-info"><b>Telegram проекта</b><span>t.me/ai0090012</span></span></a>' +
      '</div>';

    var related = S.related(art.id, 3);
    var more = related.length ? (
      '<section class="more-articles"><h3>Больше материалов</h3><div class="more-grid">' +
      related.map(function (a) {
        var c = S.categoryById(a.category);
        return '<article class="post" data-id="' + I.esc(a.id) + '" tabindex="0" role="link" aria-label="' + I.esc(a.title) + '">' +
          I.coverHTML(a) +
          '<div class="post-body"><div class="post-meta"><span class="cat">' + I.esc(c.short) + '</span><span>·</span><span>' + I.fmtDate(a.date) + '</span></div>' +
          '<h3>' + I.esc(a.title) + '</h3></div></article>';
      }).join("") + '</div></section>'
    ) : "";

    var shareUrl = encodeURIComponent(location.href), shareText = encodeURIComponent(art.title);
    var initial = (art.author || "И").trim().charAt(0).toUpperCase();

    root.innerHTML =
      '<article class="read">' +
        '<header class="article-head">' +
          I.chip(art.category, { long: true }) +
          '<h1>' + I.esc(art.title) + '</h1>' +
          '<div class="article-byline">' +
            '<span class="av">' + I.esc(initial) + '</span>' +
            '<b>' + I.esc(art.author) + '</b><span class="sep"></span>' +
            '<span>' + I.fmtDate(art.date) + '</span><span class="sep"></span>' +
            '<span>' + art.readMins + ' мин чтения</span>' +
          '</div>' +
        '</header>' +
        '<div class="article-cover">' + I.coverHTML(art) + '</div>' +
        '<div class="read-narrow">' +
          toc +
          '<div class="article-body">' + bodyHTML + '</div>' +
          factsBlock +
          sourceCard +
          '<div class="article-share"><span>Поделиться:</span>' +
            '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://t.me/share/url?url=' + shareUrl + '&text=' + shareText + '">Telegram</a>' +
            '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?url=' + shareUrl + '&text=' + shareText + '">X</a>' +
          '</div>' +
          '<div class="article-cta"><div class="cta"><span class="t-ico" data-ico="telegram"></span>' +
            '<h2>Подписаться на Telegram</h2>' +
            '<p>Новые материалы об искусственном интеллекте — в канале проекта.</p>' +
            '<a class="btn btn-primary" href="' + I.TELEGRAM + '" target="_blank" rel="noopener" style="margin-top:26px">Перейти в Telegram</a></div></div>' +
        '</div>' +
        more +
      '</article>';

    // догружаем иконки внутри только что вставленного DOM
    root.querySelectorAll("[data-ico]").forEach(function (el) { el.innerHTML = I.icon(el.getAttribute("data-ico")); });

    root.querySelectorAll(".post").forEach(function (c) {
      c.addEventListener("click", function () { location.href = I.articleUrl(c.getAttribute("data-id")); });
    });

    // scroll-spy для оглавления
    if (headings.length >= 2) spy(headings);

    var back = document.getElementById("back");
    if (back) back.addEventListener("click", function (e) {
      if (history.length > 1 && document.referrer.indexOf("article.html") === -1) { e.preventDefault(); history.back(); }
    });
    window.scrollTo(0, 0);
  }

  function blockHTML(b) {
    if (typeof b === "string") return "<p>" + I.esc(b) + "</p>";
    switch (b.t) {
      case "h": return '<h2 id="' + (b._id || I.slug(b.c)) + '">' + I.esc(b.c) + "</h2>";
      case "q": return "<blockquote>" + I.esc(b.c) + "</blockquote>";
      case "ul": return "<ul>" + b.c.map(function (i) { return "<li>" + I.esc(i) + "</li>"; }).join("") + "</ul>";
      default: return "<p>" + I.esc(b.c) + "</p>";
    }
  }

  function spy(headings) {
    var links = {};
    document.querySelectorAll(".toc a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          Object.keys(links).forEach(function (k) { links[k].classList.remove("active"); });
          if (links[e.target.id]) links[e.target.id].classList.add("active");
        }
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    headings.forEach(function (h) { var el = document.getElementById(h.id); if (el) io.observe(el); });
  }
})();
