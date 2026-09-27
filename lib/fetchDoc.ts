/**
 * 官方文档抓取与正文提取（零依赖）。
 *
 * 目标：把 references 里的官方文档页面抓下来，抽取出「可读正文」文本，
 * 供 AI 基于真实原文做“导读”，而不是凭空生成。
 *
 * 说明：
 * - 纯正则清洗 HTML，去掉 script/style/nav/footer 等噪声，保留标题与段落文本。
 * - 对每个链接做超时与体积限制，失败不阻塞整体流程（返回空）。
 * - 结果会在路由层缓存，避免重复抓取。
 */

export type DocExcerpt = {
  label: string;
  url: string;
  ok: boolean;
  text: string; // 抽取后的正文（已截断）
  error?: string;
};

const FETCH_TIMEOUT_MS = 12000;
const MAX_HTML_BYTES = 1_500_000; // 1.5MB，超大页面直接放弃解析
const MAX_TEXT_CHARS = 6000; // 单篇文档喂给模型的正文上限

// 用主流浏览器 UA，部分教程/文档站会对“机器人 UA”返回 403
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** 解码常见 HTML 实体 */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16))
    );
}

/**
 * 提取 <pre>/<code> 内的代码，保留换行与缩进。
 * HTML 里代码换行来自真实的 "\n" 或 <br>；行内高亮 <span> 等标签需去掉但不能吞掉换行。
 */
function extractCode(inner: string): string {
  const text = decodeEntities(
    inner
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(div|p|li|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  );
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, "")) // 去行尾空白，保留缩进
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, ""); // 去首尾空行
}

/**
 * 从 HTML 中抽取可读正文。
 * 策略：优先取 <main> / <article>，否则退回 <body>；再逐块去噪。
 */
export function extractReadableText(html: string): string {
  let src = html;

  // 去掉整段噪声容器
  src = src
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // 优先正文容器
  const main =
    src.match(/<main[\s\S]*?<\/main>/i)?.[0] ||
    src.match(/<article[\s\S]*?<\/article>/i)?.[0] ||
    src.match(/<body[\s\S]*?<\/body>/i)?.[0] ||
    src;

  const out: string[] = [];
  // 提取标题与段落/列表/代码块，保留基本结构
  const blockRe =
    /<(h[1-6]|p|li|pre|code|td|th|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(main)) !== null) {
    const tag = m[1].toLowerCase();
    if (tag === "pre" || tag === "code") {
      // 代码块：必须保留换行/缩进，否则整段代码会被压成一行。
      const code = extractCode(m[2]);
      // 单行短内容（多半是行内 <code>）走行内文本，避免噪声
      if (code.includes("\n") || code.length > 24) {
        if (code.trim().length > 0) out.push("```\n" + code + "\n```");
      } else if (code.trim().length > 0) {
        out.push("`" + code.trim() + "`");
      }
      continue;
    }
    const inner = decodeEntities(m[2].replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (!inner) continue;
    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag[1]);
      out.push(`\n${"#".repeat(Math.min(level + 1, 6))} ${inner}`);
    } else if (tag === "li") {
      out.push(`- ${inner}`);
    } else {
      out.push(inner);
    }
  }

  let text = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  // 回退：如果结构化抽取几乎没内容，就整体去标签
  if (text.length < 200) {
    text = decodeEntities(main.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
  }

  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS) + "\n\n…（内容较长，此处截断）";
  }
  return text;
}

/** 抓取单个文档并抽取正文 */
export async function fetchDoc(
  label: string,
  url: string,
  signal?: AbortSignal
): Promise<DocExcerpt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  // 关联外部取消信号
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    if (!res.ok) {
      return { label, url, ok: false, text: "", error: `HTTP ${res.status}` };
    }
    const ctype = res.headers.get("content-type") || "";
    if (!ctype.includes("html") && !ctype.includes("text")) {
      return {
        label,
        url,
        ok: false,
        text: "",
        error: `非 HTML 内容 (${ctype})`,
      };
    }

    // 体积保护
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_HTML_BYTES) {
      return { label, url, ok: false, text: "", error: "页面过大，已跳过" };
    }
    const html = new TextDecoder("utf-8").decode(buf);
    const text = extractReadableText(html);
    if (!text || text.length < 80) {
      return { label, url, ok: false, text: "", error: "未能提取到正文" };
    }
    return { label, url, ok: true, text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { label, url, ok: false, text: "", error: msg };
  } finally {
    clearTimeout(timer);
  }
}

/** 并发抓取多个文档（限制并发，避免被限流） */
export async function fetchDocs(
  refs: { label: string; url: string }[],
  opts: { limit?: number; signal?: AbortSignal } = {}
): Promise<DocExcerpt[]> {
  const limit = opts.limit ?? 3;
  const targets = refs.slice(0, limit);
  return Promise.all(
    targets.map((r) => fetchDoc(r.label, r.url, opts.signal))
  );
}
