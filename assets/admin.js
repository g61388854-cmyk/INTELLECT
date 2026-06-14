/* ============================================================
   INTELLECT V2 — админ-панель (SaaS), хранение в localStorage
   Клиентская панель для наполнения. Код доступа — не серверная защита.
   ============================================================ */
(function () {
  "use strict";
  var I = window.INTELLECT, S = I.store;

  function getPass() { try { return localStorage.getItem("intellect-pass") || "intellect"; } catch (e) { return "intellect"; } }
  var TITLES = {
    stats: ["Статистика", "Обзор проекта INTELLECT"],
    news: ["Новости", "Создание и редактирование публикаций"],
    facts: ["Факт дня", "Управление базой фактов"],
    cats: ["Категории", "Распределение материалов"],
    tg: ["Telegram", "Канал и автопубликация"],
    settings: ["Настройки", "Параметры панели"]
  };

  I.onReady(function () { I.initChrome(); gate(); });

  function toast(m) {
    var t = document.getElementById("toast"); t.textContent = m; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 2500);
  }

  /* ---------- вход ---------- */
  function gate() {
    var ok = false; try { ok = sessionStorage.getItem("intellect-admin") === "1"; } catch (e) {}
    if (ok) return openPanel();
    document.getElementById("gate-form").addEventListener("submit", function (e) {
      e.preventDefault();
      if (document.getElementById("gate-pass").value === getPass()) {
        try { sessionStorage.setItem("intellect-admin", "1"); } catch (e) {}
        openPanel();
      } else toast("Неверный код доступа");
    });
  }

  function openPanel() {
    document.getElementById("gate").style.display = "none";
    document.getElementById("dash").style.display = "";
    document.getElementById("logout").addEventListener("click", function () {
      try { sessionStorage.removeItem("intellect-admin"); } catch (e) {} location.reload();
    });
    // навигация по разделам
    document.querySelectorAll("#dash-nav [data-pane]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var name = btn.getAttribute("data-pane");
        document.querySelectorAll("#dash-nav [data-pane]").forEach(function (b) { b.classList.toggle("on", b === btn); });
        document.querySelectorAll(".panel").forEach(function (p) { p.classList.toggle("on", p.getAttribute("data-pane") === name); });
        document.getElementById("pane-title").textContent = TITLES[name][0];
        document.getElementById("pane-sub").textContent = TITLES[name][1];
        if (name === "stats") renderStatsPanel();
      });
    });

    fillCategories();
    bindNewsForm(); bindImage(); renderNewsList();
    bindFactsForm(); renderFactsList();
    renderCats(); bindTelegram(); bindSettings(); renderStatsPanel();
    document.getElementById("f-date").value = new Date().toISOString().slice(0, 10);
  }

  /* ---------- статистика ---------- */
  function renderStatsPanel() {
    var st = S.stats();
    setNum("k-articles", st.articles); setNum("k-facts", st.facts);
    setNum("k-cats", st.categories); setNum("k-days", st.days);
    function setNum(id, v) { var el = document.getElementById(id); if (el) { el.setAttribute("data-count", v); el.textContent = v.toLocaleString("ru-RU"); } }

    var arts = S.articles();
    // по категориям
    var cats = S.categories().map(function (c) { return { label: c.short, n: arts.filter(function (a) { return a.category === c.id; }).length }; })
      .sort(function (a, b) { return b.n - a.n; });
    bars("bars-cats", cats);
    // по месяцам
    var M = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
    var buckets = {};
    arts.forEach(function (a) { var d = new Date(a.date + "T00:00:00"); if (!isNaN(d)) { var k = d.getFullYear() + "-" + d.getMonth(); buckets[k] = (buckets[k] || 0) + 1; } });
    var months = Object.keys(buckets).map(function (k) { var p = k.split("-"); return { sort: k, label: M[+p[1]] + " " + p[0].slice(2), n: buckets[k] }; })
      .sort(function (a, b) { return a.sort.localeCompare(b.sort); }).slice(-6);
    bars("bars-months", months);
  }
  function bars(id, rows) {
    var box = document.getElementById(id); if (!box) return;
    var max = Math.max(1, Math.max.apply(null, rows.map(function (r) { return r.n; })));
    box.innerHTML = rows.map(function (r) {
      return '<div class="bar-row"><span class="lbl">' + I.esc(r.label) + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:0%"></span></span>' +
        '<span class="val">' + r.n + '</span></div>';
    }).join("");
    requestAnimationFrame(function () {
      box.querySelectorAll(".bar-row").forEach(function (row, i) {
        row.querySelector(".bar-fill").style.width = (rows[i].n / max * 100) + "%";
      });
    });
  }

  /* ---------- категории ---------- */
  function fillCategories() {
    document.getElementById("f-category").innerHTML = S.categories().map(function (c) {
      return '<option value="' + c.id + '">' + I.esc(c.label) + '</option>';
    }).join("");
  }
  function renderCats() {
    var box = document.getElementById("cats-list"); if (!box) return;
    var arts = S.articles();
    box.innerHTML = S.categories().map(function (c) {
      var n = arts.filter(function (a) { return a.category === c.id; }).length;
      return '<div class="list-item"><span class="iconbtn" style="cursor:default">' + I.icon(c.icon) + '</span>' +
        '<div class="li-info"><b>' + I.esc(c.label) + '</b><span>' + (c.tile ? "плитка на главной · " : "") + n + ' публикаций</span></div></div>';
    }).join("");
  }

  /* ---------- разбор текста ---------- */
  function parseBody(text) {
    var lines = String(text || "").replace(/\r/g, "").split("\n"), blocks = [], list = null, para = [];
    function fl() { if (list) { blocks.push({ t: "ul", c: list }); list = null; } }
    function fp() { if (para.length) { blocks.push({ t: "p", c: para.join(" ") }); para = []; } }
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].trim();
      if (!ln) { fl(); fp(); continue; }
      if (ln.indexOf("## ") === 0) { fl(); fp(); blocks.push({ t: "h", c: ln.slice(3) }); }
      else if (ln.indexOf("> ") === 0) { fl(); fp(); blocks.push({ t: "q", c: ln.slice(2) }); }
      else if (ln.indexOf("- ") === 0) { fp(); (list = list || []).push(ln.slice(2)); }
      else { fl(); para.push(ln); }
    }
    fl(); fp(); return blocks;
  }
  function bodyToText(body) {
    return (body || []).map(function (b) {
      if (typeof b === "string") return b;
      if (b.t === "h") return "## " + b.c;
      if (b.t === "q") return "> " + b.c;
      if (b.t === "ul") return b.c.map(function (i) { return "- " + i; }).join("\n");
      return b.c;
    }).join("\n\n");
  }

  /* ---------- форма новости ---------- */
  var curImg = "";
  function bindNewsForm() {
    document.getElementById("news-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var id = document.getElementById("f-id").value.trim();
      var title = document.getElementById("f-title").value.trim();
      if (!title) { toast("Введите заголовок"); return; }
      if (!id) id = I.slug(title) + "-" + Date.now().toString(36).slice(-4);
      var art = {
        id: id, category: document.getElementById("f-category").value,
        source: document.getElementById("f-source").value.trim(),
        title: title, excerpt: document.getElementById("f-excerpt").value.trim(),
        author: document.getElementById("f-author").value.trim() || "Редакция INTELLECT",
        date: document.getElementById("f-date").value || new Date().toISOString().slice(0, 10),
        readMins: Math.max(1, parseInt(document.getElementById("f-read").value, 10) || 5),
        featured: !!document.getElementById("f-featured").value,
        image: curImg || undefined,
        body: parseBody(document.getElementById("f-body").value)
      };
      if (art.featured) S.articles().forEach(function (a) { if (a.featured && a.id !== art.id) S.saveArticle(Object.assign({}, a, { featured: false })); });
      S.saveArticle(art);
      toast("Материал сохранён"); resetForm(); renderNewsList(); renderStatsPanel();
    });
    document.getElementById("reset-btn").addEventListener("click", resetForm);
  }
  function resetForm() {
    var f = document.getElementById("news-form"); f.reset();
    document.getElementById("f-id").value = "";
    document.getElementById("f-date").value = new Date().toISOString().slice(0, 10);
    document.getElementById("form-title").textContent = "Новая публикация";
    document.getElementById("save-btn").textContent = "Опубликовать";
    curImg = ""; var pv = document.getElementById("img-preview"); pv.src = ""; pv.classList.remove("show");
  }
  function editArticle(id) {
    var a = S.byId(id); if (!a) return;
    document.querySelector('#dash-nav [data-pane="news"]').click();
    document.getElementById("f-id").value = a.id;
    document.getElementById("f-title").value = a.title || "";
    document.getElementById("f-category").value = a.category || "ai";
    document.getElementById("f-source").value = a.source || "";
    document.getElementById("f-author").value = a.author || "";
    document.getElementById("f-date").value = a.date || "";
    document.getElementById("f-read").value = a.readMins || 5;
    document.getElementById("f-featured").value = a.featured ? "1" : "";
    document.getElementById("f-excerpt").value = a.excerpt || "";
    document.getElementById("f-body").value = bodyToText(a.body);
    curImg = a.image || "";
    var pv = document.getElementById("img-preview");
    if (curImg) { pv.src = curImg; pv.classList.add("show"); } else pv.classList.remove("show");
    document.getElementById("form-title").textContent = "Редактирование";
    document.getElementById("save-btn").textContent = "Сохранить изменения";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function bindImage() {
    var drop = document.getElementById("img-drop"), input = document.getElementById("f-image");
    drop.addEventListener("click", function () { input.click(); });
    input.addEventListener("change", function () {
      var file = input.files && input.files[0]; if (!file) return;
      var r = new FileReader();
      r.onload = function () { downscale(r.result, 1000, function (u) { curImg = u; var pv = document.getElementById("img-preview"); pv.src = u; pv.classList.add("show"); toast("Изображение загружено"); }); };
      r.readAsDataURL(file);
    });
  }
  function downscale(src, maxW, cb) {
    var img = new Image();
    img.onload = function () {
      var s = Math.min(1, maxW / img.width), w = Math.round(img.width * s), h = Math.round(img.height * s);
      var c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      try { cb(c.toDataURL("image/jpeg", 0.82)); } catch (e) { cb(src); }
    };
    img.onerror = function () { cb(src); }; img.src = src;
  }
  function renderNewsList() {
    var box = document.getElementById("news-list"), list = S.articles();
    document.getElementById("news-count").textContent = "Всего: " + list.length;
    if (!list.length) { box.innerHTML = '<div class="empty-hint">Пока нет публикаций.</div>'; return; }
    box.innerHTML = list.map(function (a) {
      var c = S.categoryById(a.category);
      var thumb = a.image ? '<img class="thumb" src="' + I.esc(a.image) + '" alt="" style="object-fit:cover">'
        : '<span class="thumb cover ct-' + I.esc(a.category) + '"><span class="cov-tint"></span></span>';
      return '<div class="list-item">' + thumb +
        '<div class="li-info"><b>' + I.esc(a.title) + '</b><span>' + I.esc(c.short) + ' · ' + I.fmtDate(a.date) + (a.featured ? ' · ★' : '') + '</span></div>' +
        '<div class="li-act"><button class="iconbtn" data-edit="' + I.esc(a.id) + '" title="Изменить">' + I.icon("edit") + '</button>' +
        '<button class="iconbtn danger" data-del="' + I.esc(a.id) + '" title="Удалить">' + I.icon("trash") + '</button></div></div>';
    }).join("");
    box.querySelectorAll("[data-edit]").forEach(function (b) { b.addEventListener("click", function () { editArticle(b.getAttribute("data-edit")); }); });
    box.querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!confirm("Удалить публикацию?")) return;
        S.deleteArticle(b.getAttribute("data-del")); toast("Удалено"); renderNewsList(); renderStatsPanel();
      });
    });
  }

  /* ---------- факты ---------- */
  function bindFactsForm() {
    document.getElementById("fact-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var inp = document.getElementById("fact-input"), v = inp.value.trim();
      if (!v) return; S.addFact(v); inp.value = ""; toast("Факт добавлен"); renderFactsList(); renderStatsPanel();
    });
  }
  function renderFactsList() {
    var box = document.getElementById("facts-list"), list = S.facts();
    document.getElementById("facts-count").textContent = "Всего: " + list.length;
    box.innerHTML = list.map(function (f) {
      return '<div class="list-item"><div class="li-info" style="white-space:normal"><b style="white-space:normal;font-weight:500;font-size:13.5px;line-height:1.5">' + I.esc(f) + '</b></div>' +
        '<div class="li-act"><button class="iconbtn danger" data-fact="' + encodeURIComponent(f) + '" title="Удалить">' + I.icon("trash") + '</button></div></div>';
    }).join("");
    box.querySelectorAll("[data-fact]").forEach(function (b) {
      b.addEventListener("click", function () { S.removeFact(decodeURIComponent(b.getAttribute("data-fact"))); toast("Удалено"); renderFactsList(); renderStatsPanel(); });
    });
  }

  /* ---------- telegram ---------- */
  function bindTelegram() {
    var tk = document.getElementById("tg-token"), ch = document.getElementById("tg-chat");
    try { tk.value = localStorage.getItem("intellect-tg-token") || ""; ch.value = localStorage.getItem("intellect-tg-chat") || "@ai0090012"; } catch (e) {}
    document.getElementById("tg-save").addEventListener("click", function () {
      try { localStorage.setItem("intellect-tg-token", tk.value.trim()); localStorage.setItem("intellect-tg-chat", ch.value.trim()); } catch (e) {}
      toast("Настройки Telegram сохранены");
    });
  }

  /* ---------- настройки ---------- */
  function bindSettings() {
    var th = document.getElementById("set-theme");
    try { th.value = localStorage.getItem("intellect-theme") || "light"; } catch (e) {}
    document.getElementById("set-save").addEventListener("click", function () {
      try {
        localStorage.setItem("intellect-theme", th.value);
        var p = document.getElementById("set-pass").value.trim();
        if (p) localStorage.setItem("intellect-pass", p);
      } catch (e) {}
      document.documentElement.dataset.theme = th.value;
      document.getElementById("set-pass").value = "";
      toast("Настройки сохранены");
    });
    document.getElementById("export-btn").addEventListener("click", function () {
      var data = { exportedAt: new Date().toISOString(), articles: S.articles(), facts: S.facts() };
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "intellect-export.json"; a.click(); URL.revokeObjectURL(a.href);
    });
    document.getElementById("reset-btn2").addEventListener("click", function () {
      if (!confirm("Сбросить все ручные правки (публикации и факты, добавленные в панели)?")) return;
      ["intellect-articles-custom", "intellect-articles-edits", "intellect-articles-deleted", "intellect-facts-custom", "intellect-facts-removed"].forEach(function (k) {
        try { localStorage.removeItem(k); } catch (e) {}
      });
      toast("Правки сброшены"); renderNewsList(); renderFactsList(); renderCats(); renderStatsPanel();
    });
  }
})();
