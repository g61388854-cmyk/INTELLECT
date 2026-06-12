#!/usr/bin/env node
/* ============================================================
   INTELLECT — ежедневный сбор новостей об ИИ из RSS-лент.
   Пишет data/articles.generated.js и (опционально) шлёт анонсы
   новых статей в Telegram-канал проекта.

   Запуск:  node scripts/fetch-news.mjs
   Зависимостей нет — только встроенный fetch (Node 18+).

   Переменные окружения (необязательны, для Telegram):
     TELEGRAM_BOT_TOKEN  — токен бота
     TELEGRAM_CHAT_ID    — @канал или числовой id
   ============================================================ */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "data", "articles.generated.js");

/* Источники из ТЗ → их RSS и категория по умолчанию */
const SOURCES = [
  { name: "OpenAI",          cat: "ai",       url: "https://openai.com/blog/rss.xml" },
  { name: "Anthropic",       cat: "research", url: "https://www.anthropic.com/rss.xml" },
  { name: "Google DeepMind", cat: "research", url: "https://deepmind.google/blog/rss.xml" },
  { name: "Meta AI",         cat: "neural",   url: "https://ai.meta.com/blog/rss/" },
  { name: "Microsoft AI",    cat: "tech",     url: "https://blogs.microsoft.com/ai/feed/" },
  { name: "NVIDIA",          cat: "tech",     url: "https://blogs.nvidia.com/blog/category/deep-learning/feed/" },
  { name: "Hugging Face",    cat: "ai",       url: "https://huggingface.co/blog/feed.xml" },
  { name: "Stability AI",    cat: "startups", url: "https://stability.ai/news?format=rss" }
];

const MAX_PER_SOURCE = 4;
const MAX_TOTAL = 24;

/* ---------- крошечный парсер RSS/Atom без зависимостей ---------- */
function pick(block, tags) {
  for (const tag of tags) {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    if (m) return clean(m[1]);
    const self = block.match(new RegExp(`<${tag}[^>]*href=["']([^"']+)["']`, "i"));
    if (self) return clean(self[1]);
  }
  return "";
}
function clean(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ").trim();
}
function parseFeed(xml) {
  const items = [];
  const chunks = xml.split(/<item[\s>]|<entry[\s>]/i).slice(1);
  for (const raw of chunks) {
    const block = "<x " + raw;
    const title = pick(block, ["title"]);
    const link = pick(block, ["link"]);
    const desc = pick(block, ["description", "summary", "content"]);
    const date = pick(block, ["pubDate", "updated", "published"]);
    if (title && link) items.push({ title, link, desc, date });
  }
  return items;
}

function slugify(s) {
  return String(s).toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "post";
}
function isoDate(d) {
  const t = Date.parse(d);
  return isNaN(t) ? new Date().toISOString().slice(0, 10) : new Date(t).toISOString().slice(0, 10);
}
function excerpt(s, n = 180) {
  if (!s) return "Подробности — в полном материале на сайте источника.";
  return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s;
}
function readMins(s) {
  return Math.max(2, Math.min(12, Math.round((s || "").split(" ").length / 120) || 3));
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "INTELLECT-news-bot/1.0", "Accept": "application/rss+xml, application/xml, text/xml, */*" }
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
  } finally {
    clearTimeout(to);
  }
}

async function loadExistingIds() {
  try {
    const txt = await readFile(OUT, "utf8");
    const m = txt.match(/INTELLECT_GENERATED\s*=\s*(\[[\s\S]*?\]);/);
    if (!m) return new Set();
    return new Set(JSON.parse(m[1]).map((a) => a.id));
  } catch { return new Set(); }
}

async function main() {
  const existingIds = await loadExistingIds();
  const collected = [];

  for (const src of SOURCES) {
    try {
      const xml = await fetchText(src.url);
      const items = parseFeed(xml).slice(0, MAX_PER_SOURCE);
      for (const it of items) {
        const id = slugify(src.name + "-" + it.title);
        collected.push({
          id,
          category: src.cat,
          source: src.name,
          title: it.title,
          excerpt: excerpt(it.desc),
          author: "Лента " + src.name,
          date: isoDate(it.date),
          readMins: readMins(it.desc),
          link: it.link,
          body: [
            { t: "p", c: excerpt(it.desc, 600) },
            { t: "p", c: "Это автоматически собранный анонс. Полный материал доступен в первоисточнике." }
          ]
        });
      }
      console.log(`✓ ${src.name}: ${items.length}`);
    } catch (e) {
      console.warn(`✗ ${src.name}: ${e.message}`);
    }
  }

  // дедуп по id, сортировка по дате, лимит
  const seen = new Set();
  const unique = collected.filter((a) => (seen.has(a.id) ? false : seen.add(a.id)));
  unique.sort((a, b) => b.date.localeCompare(a.date));
  const finalList = unique.slice(0, MAX_TOTAL);

  if (!finalList.length) {
    console.log("Новых материалов не получено — файл не изменён.");
    return;
  }

  const header =
    "/* Автоматически сгенерировано scripts/fetch-news.mjs — не редактировать вручную. */\n" +
    "/* Обновлено: " + new Date().toISOString() + " */\n";
  const out =
    header +
    "window.INTELLECT_GENERATED = " + JSON.stringify(finalList, null, 2) + ";\n" +
    "window.INTELLECT_GENERATED_AT = " + JSON.stringify(new Date().toISOString()) + ";\n";
  await writeFile(OUT, out, "utf8");
  console.log(`Записано материалов: ${finalList.length} → data/articles.generated.js`);

  // Telegram-анонсы только для действительно новых статей
  const fresh = finalList.filter((a) => !existingIds.has(a.id));
  await postToTelegram(fresh);
}

async function postToTelegram(articles) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    console.log("Telegram не настроен (нет TELEGRAM_BOT_TOKEN/CHAT_ID) — анонсы пропущены.");
    return;
  }
  for (const a of articles.slice(0, 6)) {
    const text =
      `✦ <b>${a.title}</b>\n\n${a.excerpt}\n\n` +
      `Источник: ${a.source}\n${a.link || ""}`;
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: false })
      });
      const ok = res.ok ? "✓" : "✗ " + res.status;
      console.log(`Telegram ${ok}: ${a.title.slice(0, 40)}`);
    } catch (e) {
      console.warn("Telegram ошибка:", e.message);
    }
    await new Promise((r) => setTimeout(r, 1200)); // не упираемся в лимиты
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
