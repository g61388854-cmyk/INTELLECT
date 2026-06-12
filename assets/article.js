/* ============================================================
   INTELLECT — страница отдельной статьи
   ============================================================ */
(function () {
  "use strict";
  var I = window.INTELLECT, S = I.store;

  I.onReady(function () {
    I.initChrome();
    render();
  });

  function param(name) {
    var m = new RegExp("[?&]" + name + "=([^&]+)").exec(location.search);
    return m ? decodeURIComponent(m[1]) : "";
  }

  function blockHTML(b) {
    if (typeof b === "string") return "<p>" + I.esc(b) + "</p>";
    switch (b.t) {
      case "h": return "<h2>" + I.esc(b.c) + "</h2>";
      case "q": return "<blockquote>" + I.esc(b.c) + "</blockquote>";
      case "ul": return "<ul>" + b.c.map(function (i) { return "<li>" + I.esc(i) + "</li>"; }).join("") + "</ul>";
      default: return "<p>" + I.esc(b.c) + "</p>";
    }
  }

  function render() {
    var root = document.getElementById("article-root");
    var id = param("id");
    var art = id ? S.byId(id) : null;

    if (!art) {
      document.title = "Статья не найдена — INTELLECT";
      root.innerHTML =
        '<div class="narrow"><div class="notfound">' +
        '<h1>Материал не найден</h1>' +
        '<p>Возможно, публикация была удалена или ссылка устарела.</p>' +
        '<a class="btn btn-primary" href="index.html#feed">Вернуться к ленте</a>' +
        '</div></div>';
      return;
    }

    document.title = art.title + " — INTELLECT";
    var cat = S.categoryById(art.category);
    var bodyHTML = (art.body || []).map(blockHTML).join("");

    var related = S.related(art.id, 3);
    var relHTML = related.length ? (
      '<div class="related narrow"><h3>Похожие материалы</h3><div class="related-grid">' +
      related.map(function (a) {
        return '<article class="related-card" data-id="' + I.esc(a.id) + '" tabindex="0" role="link" aria-label="' + I.esc(a.title) + '">' +
          I.coverHTML(a) +
          '<div class="rc-body">' + I.chip(a.category) +
          '<h4>' + I.esc(a.title) + '</h4>' +
          '<div class="ac-meta"><span>' + I.fmtDate(a.date) + '</span><span>·</span><span>' + a.readMins + ' мин</span></div>' +
          '</div></article>';
      }).join("") +
      '</div></div>'
    ) : "";

    var shareUrl = encodeURIComponent(location.href);
    var shareText = encodeURIComponent(art.title);

    root.innerHTML =
      '<div class="narrow">' +
        '<div class="article-hero reveal visible">' +
          I.coverHTML(art) +
          '<div class="ah-veil"></div>' +
          '<div class="ah-inner">' + I.chip(art.category) +
            '<h1>' + I.esc(art.title) + '</h1>' +
            '<div class="article-meta">' +
              '<span class="who">' + I.esc(art.author) + '</span>' +
              '<span>' + I.fmtDate(art.date) + '</span>' +
              '<span>' + art.readMins + ' мин чтения</span>' +
              '<span>Источник: ' + I.esc(art.source || "—") + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<article class="article-body">' + bodyHTML + '</article>' +
        '<div class="article-share">' +
          '<span>Поделиться:</span>' +
          '<a class="btn btn-ghost btn-small" target="_blank" rel="noopener" href="https://t.me/share/url?url=' + shareUrl + '&text=' + shareText + '">Telegram</a>' +
          '<a class="btn btn-ghost btn-small" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?url=' + shareUrl + '&text=' + shareText + '">X</a>' +
          '<a class="btn btn-tg btn-small" target="_blank" rel="noopener" href="' + I.TELEGRAM + '">Канал проекта ✈</a>' +
        '</div>' +
      '</div>' +
      relHTML;

    root.querySelectorAll(".related-card").forEach(function (c) {
      var go = function () { location.href = I.articleUrl(c.getAttribute("data-id")); };
      c.addEventListener("click", go);
      c.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    });

    var back = document.getElementById("back");
    if (back && document.referrer && /article\.html/.test(document.referrer) === false) {
      back.addEventListener("click", function (e) {
        if (history.length > 1) { e.preventDefault(); history.back(); }
      });
    }
    window.scrollTo(0, 0);
  }
})();
