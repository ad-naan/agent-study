/**
 * 知识库“订阅”构建脚本（每日抓取）
 *
 * 思路：不再手写几十个知识点，而是订阅优质教程站的 sitemap.xml，
 * 把它们“全站的知识点页面”都拉进来，构成一个上百条、持续更新的大主题池。
 * 讲义正文仍由 AI 基于抓取到的原文实时生成（见 lib/prompt.ts），本脚本只负责
 * 生成“主题目录”（data/catalog.json）：URL + 方向/分类 + 真实标题 + 摘要。
 *
 * 数据源（均为长期维护、场景/面试导向、可实测抓取的中文技术站）：
 * - JavaGuide（javaguide.cn）：Java / 计算机基础 / 数据库 / 系统设计 / 分布式 / 高性能高可用
 * - 小林 coding（xiaolincoding.com）：图解网络 / 操作系统 / MySQL / Redis / 面试精选 / 大厂面经
 *
 * 运行：node scripts/build-catalog.mjs   （或 npm run catalog）
 * 输出：data/catalog.json
 *
 * 说明：
 * - 只收录“文章页”（以 .html 结尾且命中分类前缀），跳过目录/关于/推广等噪声页。
 * - 真实标题通过抓取页面 <title> 获得（并发受限、失败自动降级为 slug 标题）。
 * - 该脚本可由 cron / GitHub Actions 每日执行，实现“每天自动更新知识点”。
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_FILE = path.join(ROOT, "data", "catalog.json");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 15000;

// —— 礼貌抓取（避免给来源站造成压力）——
// 单站串行 + 每次请求之间强制间隔，整体请求速率被限制在 ~2 req/s。
const CONCURRENCY = 2; // 每个源最多 2 个并发连接
const REQUEST_DELAY_MS = 400; // 每个 worker 两次请求之间至少间隔 400ms
const MAX_RETRY = 1; // 失败最多重试 1 次（配合退避）
const RETRY_BACKOFF_MS = 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 订阅源定义。
 * sections：路径前缀 → 方向/分类。匹配时取“最长前缀”，未命中的页面会被丢弃，
 * 因此不需要显式维护排除名单（关于作者、书单、推广等自然被过滤）。
 */
const FEEDS = [
  {
    key: "javaguide",
    site: "JavaGuide",
    sitemap: "https://javaguide.cn/sitemap.xml",
    titleStrip: /\s*[|｜-]\s*JavaGuide\s*$/i,
    sections: [
      { prefix: "/java/jvm/", track: "后端语言", category: "Java · JVM", difficulty: "高级" },
      { prefix: "/java/concurrent/", track: "后端语言", category: "Java · 并发", difficulty: "高级" },
      { prefix: "/java/collection/", track: "后端语言", category: "Java · 集合", difficulty: "进阶" },
      { prefix: "/java/io/", track: "后端语言", category: "Java · IO", difficulty: "进阶" },
      { prefix: "/java/basis/", track: "后端语言", category: "Java · 基础", difficulty: "入门" },
      { prefix: "/java/new-features/", track: "后端语言", category: "Java · 新特性", difficulty: "进阶" },
      { prefix: "/java/", track: "后端语言", category: "Java", difficulty: "进阶" },
      { prefix: "/cs-basics/network/", track: "计算机基础", category: "计算机网络", difficulty: "进阶" },
      { prefix: "/cs-basics/operating-system/", track: "计算机基础", category: "操作系统", difficulty: "进阶" },
      { prefix: "/cs-basics/data-structure-algorithms/", track: "计算机基础", category: "数据结构与算法", difficulty: "进阶" },
      { prefix: "/cs-basics/", track: "计算机基础", category: "计算机基础", difficulty: "入门" },
      { prefix: "/database/mysql/", track: "数据库", category: "MySQL", difficulty: "进阶" },
      { prefix: "/database/redis/", track: "数据库", category: "Redis", difficulty: "进阶" },
      { prefix: "/database/mongodb/", track: "数据库", category: "MongoDB", difficulty: "进阶" },
      { prefix: "/database/elasticsearch/", track: "中间件与运维", category: "Elasticsearch", difficulty: "进阶" },
      { prefix: "/database/", track: "数据库", category: "数据库基础", difficulty: "入门" },
      { prefix: "/high-performance/message-queue/", track: "中间件与运维", category: "消息队列", difficulty: "高级" },
      { prefix: "/high-performance/", track: "系统设计", category: "高性能", difficulty: "高级" },
      { prefix: "/high-availability/", track: "系统设计", category: "高可用", difficulty: "高级" },
      { prefix: "/distributed-system/", track: "系统设计", category: "分布式", difficulty: "高级" },
      { prefix: "/system-design/", track: "系统设计", category: "系统设计", difficulty: "进阶" },
    ],
  },
  {
    key: "xiaolin",
    site: "小林coding",
    sitemap: "https://www.xiaolincoding.com/sitemap.xml",
    titleStrip: /\s*[|｜-]\s*小林coding.*$/i,
    sections: [
      { prefix: "/network/", track: "计算机基础", category: "计算机网络（图解）", difficulty: "进阶" },
      { prefix: "/os/", track: "计算机基础", category: "操作系统（图解）", difficulty: "进阶" },
      { prefix: "/mysql/", track: "数据库", category: "MySQL（图解）", difficulty: "进阶" },
      { prefix: "/redis/", track: "数据库", category: "Redis（图解）", difficulty: "进阶" },
      { prefix: "/interview/", track: "面试专题", category: "后端面试精选", difficulty: "高级" },
      { prefix: "/backend_interview/", track: "面试专题", category: "大厂面经", difficulty: "高级" },
    ],
  },
];

/** 带超时的 fetch，并对失败/限流做退避重试 */
async function fetchText(url, attempt = 0) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: ctrl.signal,
    });
    // 命中限流：尊重 Retry-After（或用退避），并重试一次
    if (res.status === 429 || res.status === 503) {
      if (attempt < MAX_RETRY) {
        const ra = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : RETRY_BACKOFF_MS * (attempt + 1);
        clearTimeout(timer);
        await sleep(wait);
        return fetchText(url, attempt + 1);
      }
      return { ok: false, status: res.status, text: "" };
    }
    if (!res.ok) return { ok: false, status: res.status, text: "" };
    return { ok: true, status: res.status, text: await res.text() };
  } catch (err) {
    if (attempt < MAX_RETRY) {
      clearTimeout(timer);
      await sleep(RETRY_BACKOFF_MS * (attempt + 1));
      return fetchText(url, attempt + 1);
    }
    return { ok: false, status: 0, text: "", error: String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

/** 从 sitemap.xml 抽取 { loc, lastmod } */
function parseSitemap(xml) {
  const out = [];
  const re = /<url>([\s\S]*?)<\/url>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const loc = block.match(/<loc>\s*([\s\S]*?)\s*<\/loc>/i)?.[1]?.trim();
    if (!loc) continue;
    const lastmod = block.match(/<lastmod>\s*([\s\S]*?)\s*<\/lastmod>/i)?.[1]?.trim() || null;
    out.push({ loc, lastmod });
  }
  return out;
}

/** 命中最长分类前缀 */
function matchSection(feed, pathname) {
  let best = null;
  for (const s of feed.sections) {
    if (pathname.startsWith(s.prefix) && (!best || s.prefix.length > best.prefix.length)) {
      best = s;
    }
  }
  return best;
}

/** slug 兜底标题：把 URL 末段变成可读文字 */
function slugTitle(pathname) {
  const seg = pathname.replace(/\.html$/, "").split("/").filter(Boolean).pop() || "";
  return seg.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** 从 HTML 抽取标题与描述 */
function extractMeta(html, titleStrip) {
  let title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "";
  title = decodeEntities(title).replace(/\s+/g, " ").trim();
  if (titleStrip) title = title.replace(titleStrip, "").trim();

  let desc =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i)?.[1] ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["']/i)?.[1] ||
    "";
  desc = decodeEntities(desc).replace(/\s+/g, " ").trim();
  if (desc.length > 90) desc = desc.slice(0, 90) + "…";
  return { title, desc };
}

/** 并发池（每次请求后强制间隔，控制对来源站的速率） */
async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let i = 0;
  let done = 0;
  const total = items.length;
  async function next() {
    const idx = i++;
    if (idx >= total) return;
    results[idx] = await worker(items[idx], idx);
    done++;
    if (done % 25 === 0 || done === total) {
      process.stdout.write(`\r  抓取标题 ${done}/${total} …`);
    }
    // 礼貌间隔：避免短时间内高频请求同一站点
    if (idx < total - concurrency) await sleep(REQUEST_DELAY_MS);
    return next();
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, next));
  process.stdout.write("\n");
  return results;
}

async function buildFeed(feed, prevByUrl) {
  console.log(`\n[${feed.site}] 拉取 sitemap: ${feed.sitemap}`);
  const sm = await fetchText(feed.sitemap);
  if (!sm.ok) {
    console.warn(`  ✗ sitemap 抓取失败 (status ${sm.status})，跳过该源`);
    return [];
  }
  const entries = parseSitemap(sm.text);
  console.log(`  sitemap 共 ${entries.length} 条 URL`);

  // 过滤：仅保留命中分类前缀、且是 .html 文章页（跳过目录/首页）
  const candidates = [];
  for (const e of entries) {
    let u;
    try {
      u = new URL(e.loc);
    } catch {
      continue;
    }
    const pathname = u.pathname;
    if (!pathname.endsWith(".html")) continue;
    const section = matchSection(feed, pathname);
    if (!section) continue;
    candidates.push({ url: e.loc, pathname, lastmod: e.lastmod, section });
  }

  // 增量：URL 已收录且 lastmod 未变 → 直接复用旧标题，跳过网络请求（大幅降低对来源站的压力）
  // 例外：若旧标题只是「slug 兜底」（上次抓取失败留下的英文/驼峰占位，如 "Aqs"），
  //       则强制重新抓取，避免坏标题被永久复用。
  const toFetch = candidates.filter((c) => {
    const prev = prevByUrl.get(c.url);
    const canReuse =
      prev && prev.lastmod && c.lastmod && prev.lastmod === c.lastmod && prev.title;
    if (!canReuse) return true;
    // 旧标题恰好等于 slug 兜底 → 说明上次没拿到真实标题，需要重抓
    if (prev.title === slugTitle(c.pathname)) return true;
    return false;
  });
  const reusedCount = candidates.length - toFetch.length;
  console.log(
    `  命中分类的文章页：${candidates.length} 条（复用 ${reusedCount} 条，需抓取 ${toFetch.length} 条）`
  );

  const fetchedByUrl = new Map();
  if (toFetch.length > 0) {
    const fetched = await runPool(
      toFetch,
      async (c) => {
        const page = await fetchText(c.url);
        let title = slugTitle(c.pathname);
        let desc = "";
        if (page.ok) {
          const meta = extractMeta(page.text, feed.titleStrip);
          if (meta.title && meta.title.length >= 2) title = meta.title;
          desc = meta.desc;
        }
        return { url: c.url, title, desc };
      },
      CONCURRENCY
    );
    for (const f of fetched) fetchedByUrl.set(f.url, f);
  }

  const topics = candidates.map((c) => {
    const prev = prevByUrl.get(c.url);
    const got = fetchedByUrl.get(c.url);
    const title = got?.title || prev?.title || slugTitle(c.pathname);
    const desc = got?.desc || "";
    const slug = c.pathname.replace(/^\//, "").replace(/\.html$/, "").replace(/[\/]+/g, "-");
    const id = `${feed.key}-${slug}`;
    return {
      id,
      track: c.section.track,
      category: c.section.category,
      title,
      difficulty: c.section.difficulty || "进阶",
      focus:
        desc ||
        prev?.focus ||
        `${c.section.category}｜结合真实场景与面试视角掌握「${title}」。`,
      source: feed.site,
      lastmod: c.lastmod,
      references: [{ label: `${feed.site} · ${title}`, url: c.url, type: "tutorial" }],
    };
  });

  console.log(`  ✓ ${feed.site} 收录 ${topics.length} 个知识点`);
  return topics;
}

/** 读取上一次的 catalog.json，构建 url → { title, focus, lastmod } 映射，用于增量复用 */
async function loadPrevByUrl() {
  const map = new Map();
  try {
    const raw = await fs.readFile(OUT_FILE, "utf8");
    const parsed = JSON.parse(raw);
    for (const t of parsed.topics || []) {
      const url = t.references?.[0]?.url;
      if (url) map.set(url, { title: t.title, focus: t.focus, lastmod: t.lastmod ?? null });
    }
  } catch {
    // 首次运行没有旧文件，正常
  }
  return map;
}

async function main() {
  const started = Date.now();
  const prevByUrl = await loadPrevByUrl();
  if (prevByUrl.size > 0) {
    console.log(`已加载上次目录 ${prevByUrl.size} 条，将增量复用未变更的页面（减少对来源站的请求）`);
  }
  const all = [];
  const sources = [];
  for (const feed of FEEDS) {
    const topics = await buildFeed(feed, prevByUrl);
    sources.push({ key: feed.key, site: feed.site, count: topics.length });
    all.push(...topics);
  }

  // 按方向/分类稳定排序，便于浏览
  all.sort((a, b) =>
    a.track === b.track
      ? a.category === b.category
        ? a.title.localeCompare(b.title, "zh")
        : a.category.localeCompare(b.category, "zh")
      : a.track.localeCompare(b.track, "zh")
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    sources,
    total: all.length,
    topics: all,
  };

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(payload, null, 2), "utf8");

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n✅ 已写入 ${path.relative(ROOT, OUT_FILE)}`);
  console.log(`   共 ${all.length} 个知识点，来源：${sources.map((s) => `${s.site}(${s.count})`).join("、")}`);
  console.log(`   耗时 ${secs}s`);
}

main().catch((err) => {
  console.error("构建目录失败：", err);
  process.exit(1);
});
