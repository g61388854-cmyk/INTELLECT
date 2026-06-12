/* ============================================================
   INTELLECT — админ-панель (хранение в localStorage браузера)
   Примечание: это клиентская панель для демонстрации и наполнения.
   Код доступа не является настоящей защитой сервера.
   ============================================================ */
(function () {
  "use strict";
  var I = window.INTELLECT, S = I.store;
  var PASS = "intellect"; // код по умолчанию

  I.onReady(function () {
    I.initChrome();
    gate();
  });

  function toast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  /* ---------- авторизация ---------- */
  function gate() {
    var gateEl = document.getElementById("gate");
    var shell = document.getElementById("shell");
    var ok = false;
    try { ok = sessionStorage.getItem("intellect-admin") === "1"; } catch (e) {}
    if (ok) return openPanel();

    document.getElementById("gate-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = document.getElementById("gate-pass").value;
      if (v === PASS) {
        try { sessionStorage.setItem("intellect-admin", "1"); } catch (e) {}
        openPanel();
      } else {
        toast("Неверный код доступа");
      }
    });

    function openPanel() {
      gateEl.style.display = "none";
      shell.style.display = "";
      initPanel();
    }
  }

  /* ---------- панель ---------- */
  function initPanel() {
    document.getElementById("logout").addEventListener("click", function () {
      try { sessionStorage.removeItem("intellect-admin"); } catch (e) {}
      location.reload();
    });

    // вкладки
    document.querySelectorAll(".admin-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        document.querySelectorAll(".admin-tab").forEach(function (t) { t.classList.toggle("active", t === tab); });
        var name = tab.getAttribute("data-tab");
        document.querySelectorAll("[data-panel]").forEach(function (p) {
          p.style.display = p.getAttribute("data-panel") === name ? "" : "none";
        });
      });
    });

    fillCategories();
    bindNewsForm();
    bindImage();
    bindFactsForm();
    renderNewsList();
    renderFactsList();

    var today = new Date().toISOString().slice(0, 10);
    document.getElementById("f-date").value = today;
  }

  function fillCategories() {
    var sel = document.getElementById("f-category");
    sel.innerHTML = S.categories().map(function (c) {
      return '<option value="' + c.id + '">' + I.esc(c.label) + '</option>';
    }).join("");
  }

  /* ---------- разбор текста статьи на блоки ---------- */
  function parseBody(text) {
    var lines = String(text || "").replace(/\r/g, "").split("\n");
    var blocks = [], list = null;
    function flushList() { if (list) { blocks.push({ t: "ul", c: list }); list = null; } }
    var para = [];
    function flushPara() { if (para.length) { blocks.push({ t: "p", c: para.join(" ") }); para = []; } }
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].trim();
      if (!ln) { flushList(); flushPara(); continue; }
      if (ln.indexOf("## ") === 0) { flushList(); flushPara(); blocks.push({ t: "h", c: ln.slice(3) }); }
      else if (ln.indexOf("> ") === 0) { flushList(); flushPara(); blocks.push({ t: "q", c: ln.slice(2) }); }
      else if (ln.indexOf("- ") === 0) { flushPara(); (list = list || []).push(ln.slice(2)); }
      else { flushList(); para.push(ln); }
    }
    flushList(); flushPara();
    return blocks;
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

  function slugify(s) {
    var map = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"c",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
    var out = String(s || "").toLowerCase().replace(/[а-яё]/g, function (c) { return map[c] || ""; })
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
    return out || "post";
  }

  /* ---------- форма новости ---------- */
  var currentImage = "";
  function bindNewsForm() {
    var form = document.getElementById("news-form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var id = document.getElementById("f-id").value.trim();
      var title = document.getElementById("f-title").value.trim();
      if (!title) { toast("Введите заголовок"); return; }
      if (!id) id = slugify(title) + "-" + Date.now().toString(36).slice(-4);
      var art = {
        id: id,
        category: document.getElementById("f-category").value,
        source: document.getElementById("f-source").value.trim(),
        title: title,
        excerpt: document.getElementById("f-excerpt").value.trim(),
        author: document.getElementById("f-author").value.trim() || "Редакция INTELLECT",
        date: document.getElementById("f-date").value || new Date().toISOString().slice(0, 10),
        readMins: Math.max(1, parseInt(document.getElementById("f-read").value, 10) || 5),
        featured: !!document.getElementById("f-featured").value,
        image: currentImage || undefined,
        body: parseBody(document.getElementById("f-body").value)
      };
      if (art.featured) clearOtherFeatured(art.id);
      S.saveArticle(art);
      toast("Материал сохранён ✓");
      resetForm();
      renderNewsList();
    });
    document.getElementById("reset-btn").addEventListener("click", resetForm);
  }

  function clearOtherFeatured(keepId) {
    S.articles().forEach(function (a) {
      if (a.featured && a.id !== keepId) S.saveArticle(Object.assign({}, a, { featured: false }));
    });
  }

  function resetForm() {
    document.getElementById("news-form").reset();
    document.getElementById("f-id").value = "";
    document.getElementById("f-date").value = new Date().toISOString().slice(0, 10);
    document.getElementById("form-title").textContent = "Новая публикация";
    document.getElementById("save-btn").textContent = "Опубликовать";
    currentImage = "";
    var pv = document.getElementById("img-preview"); pv.src = ""; pv.classList.remove("show");
  }

  function editArticle(id) {
    var a = S.byId(id); if (!a) return;
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
    currentImage = a.image || "";
    var pv = document.getElementById("img-preview");
    if (currentImage) { pv.src = currentImage; pv.classList.add("show"); } else { pv.classList.remove("show"); }
    document.getElementById("form-title").textContent = "Редактирование";
    document.getElementById("save-btn").textContent = "Сохранить изменения";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- загрузка изображения с ужатием ---------- */
  function bindImage() {
    var drop = document.getElementById("img-drop");
    var input = document.getElementById("f-image");
    drop.addEventListener("click", function () { input.click(); });
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        downscale(reader.result, 1000, function (dataUrl) {
          currentImage = dataUrl;
          var pv = document.getElementById("img-preview");
          pv.src = dataUrl; pv.classList.add("show");
          toast("Изображение загружено");
        });
      };
      reader.readAsDataURL(file);
    });
  }
  function downscale(src, maxW, cb) {
    var img = new Image();
    img.onload = function () {
      var scale = Math.min(1, maxW / img.width);
      var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      var c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      try { cb(c.toDataURL("image/jpeg", 0.82)); } catch (e) { cb(src); }
    };
    img.onerror = function () { cb(src); };
    img.src = src;
  }

  /* ---------- список новостей ---------- */
  function renderNewsList() {
    var box = document.getElementById("news-list");
    var list = S.articles();
    document.getElementById("news-count").textContent = "Всего материалов: " + list.length;
    if (!list.length) { box.innerHTML = '<div class="empty-hint">Пока нет публикаций.</div>'; return; }
    box.innerHTML = list.map(function (a) {
      var cat = S.categoryById(a.category);
      return '<div class="admin-item">' +
        '<div class="thumb cover cv-' + I.esc(a.category) + '"></div>' +
        '<div class="ai-info"><b>' + I.esc(a.title) + '</b>' +
        '<span>' + I.esc(cat.short) + ' · ' + I.fmtDate(a.date) + (a.featured ? ' · ★ дня' : '') + '</span></div>' +
        '<div class="ai-act">' +
          '<button class="icon-btn" data-edit="' + I.esc(a.id) + '" title="Редактировать">✎</button>' +
          '<button class="icon-btn danger" data-del="' + I.esc(a.id) + '" title="Удалить">✕</button>' +
        '</div></div>';
    }).join("");
    box.querySelectorAll("[data-edit]").forEach(function (b) {
      b.addEventListener("click", function () { editArticle(b.getAttribute("data-edit")); });
    });
    box.querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!confirm("Удалить эту публикацию?")) return;
        S.deleteArticle(b.getAttribute("data-del"));
        toast("Публикация удалена");
        renderNewsList();
      });
    });
  }

  /* ---------- факты ---------- */
  function bindFactsForm() {
    document.getElementById("fact-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var inp = document.getElementById("fact-input");
      var v = inp.value.trim();
      if (!v) return;
      S.addFact(v);
      inp.value = "";
      toast("Факт добавлен ✓");
      renderFactsList();
    });
  }
  function renderFactsList() {
    var box = document.getElementById("facts-list");
    var list = S.facts();
    document.getElementById("facts-count").textContent = "Всего фактов: " + list.length;
    box.innerHTML = list.map(function (f) {
      return '<div class="admin-item"><div class="ai-info" style="white-space:normal">' +
        '<b style="white-space:normal;font-weight:500;font-size:13.5px;line-height:1.5">' + I.esc(f) + '</b></div>' +
        '<div class="ai-act"><button class="icon-btn danger" data-fact="' + encodeURIComponent(f) + '" title="Удалить">✕</button></div></div>';
    }).join("");
    box.querySelectorAll("[data-fact]").forEach(function (b) {
      b.addEventListener("click", function () {
        S.removeFact(decodeURIComponent(b.getAttribute("data-fact")));
        toast("Факт удалён");
        renderFactsList();
      });
    });
  }
})();
