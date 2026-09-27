import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { streamChatDeltas, isAIConfigured } from "@/lib/ai";
import { buildLessonMessages } from "@/lib/prompt";
import { getTopicById } from "@/lib/catalog";
import { fetchDocs } from "@/lib/fetchDoc";

// 需要文件系统与流式响应，使用 Node.js 运行时
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_DIR = path.join(process.cwd(), ".cache", "lessons");

async function readCache(id: string): Promise<string | null> {
  try {
    const file = path.join(CACHE_DIR, `${id}.md`);
    const txt = await fs.readFile(file, "utf8");
    return txt.length > 0 ? txt : null;
  } catch {
    return null;
  }
}

async function writeCache(id: string, content: string): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(path.join(CACHE_DIR, `${id}.md`), content, "utf8");
  } catch {
    // 缓存失败不影响主流程
  }
}

function textStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

/**
 * 「原文导读」：未配置 AI 时的兜底。
 * 抓取该主题的参考原文，抽取正文，拼成一份可直接阅读的 Markdown 讲义，
 * 保证没有 AI 也能读到真实内容（而不是一句“请配置 AI”）。
 */
async function buildRawReadingLesson(
  topic: ReturnType<typeof getTopicById> & object,
  signal?: AbortSignal
): Promise<string> {
  const docs = await fetchDocs(topic.references, { limit: 2, signal });
  const ok = docs.filter((d) => d.ok && d.text);

  const head = [
    `# ${topic.title}`,
    "",
    `> ${topic.track} · ${topic.category} · 难度：${topic.difficulty}`,
    "",
    topic.focus ? `**本篇聚焦**：${topic.focus}` : "",
    "",
    "> ℹ️ 当前为「原文导读」模式（未配置 AI）。以下内容摘自来源站原文；" +
      "配置 AI 后点“重新生成”可获得结构化精讲与要点提炼。",
    "",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const body =
    ok.length > 0
      ? ok
          .map(
            (d) =>
              `\n---\n\n## 📖 ${d.label}\n\n${d.text}\n\n[👉 阅读原文](${d.url})`
          )
          .join("\n")
      : "\n---\n\n> ⚠️ 暂时未能抓取到原文正文，可直接点击下方链接前往来源站阅读。";

  const refs =
    "\n\n---\n\n### 参考文档\n" +
    topic.references.map((r) => `- [${r.label}](${r.url})`).join("\n");

  return `${head}${body}${refs}`;
}

/**
 * GET /api/lesson?topic=<id>&refresh=1
 * 以纯文本流(Markdown)返回讲义。命中缓存直接返回；否则调用 AI 生成并写缓存。
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("topic") ?? "";
  const refresh = searchParams.get("refresh") === "1";

  const topic = getTopicById(id);
  if (!topic) {
    return new Response("未找到该主题", { status: 404 });
  }

  // 1) 命中缓存（非强制刷新）：直接返回
  if (!refresh) {
    const cached = await readCache(id);
    if (cached) {
      return new Response(textStream(cached), {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "X-Lesson-Source": "cache",
        },
      });
    }
  }

  // 2) 未配置 AI：不再只给一句提示，而是直接抓取来源原文、抽取正文，
  //    生成一份「原文导读」——保证没配 AI 也能读到真实内容。
  if (!isAIConfigured()) {
    const md = await buildRawReadingLesson(topic, req.signal);
    // 原文导读也写入缓存，避免重复抓取；配置 AI 后点“重新生成”会覆盖
    if (md.trim().length > 0) await writeCache(id, md);
    return new Response(textStream(md), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "X-Lesson-Source": "raw",
      },
    });
  }

  // 3) 抓取该主题的参考原文（tutorial 在前，优先取前 3 篇），供模型做导读
  const docs = await fetchDocs(topic.references, { limit: 3, signal: req.signal });
  const messages = buildLessonMessages(topic, docs);
  const encoder = new TextEncoder();
  let full = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of streamChatDeltas(messages, {
          signal: req.signal,
        })) {
          full += delta;
          controller.enqueue(encoder.encode(delta));
        }
        controller.close();
        if (full.trim().length > 0) {
          await writeCache(id, full);
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "AI 生成失败，请稍后重试";
        controller.enqueue(encoder.encode(`\n\n> ❌ 生成中断：${msg}`));
        controller.close();
      }
    },
    cancel() {
      // 客户端断开时，req.signal 会中止上游请求
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Lesson-Source": "ai",
    },
  });
}
