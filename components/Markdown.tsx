"use client";

import { useMemo } from "react";

/**
 * 轻量 Markdown 渲染器（零依赖）。
 * 支持：标题、粗体/行内代码、有序/无序列表、代码块、表格、引用、水平线、段落。
 * 目的是把 AI 返回的讲义 Markdown 渲染得可读，而不引入额外依赖。
 */

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "code"; lang: string; code: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "hr" }
  | { type: "p"; text: string };

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 代码块
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      i++; // 跳过结尾 ```
      blocks.push({ type: "code", lang, code: code.join("\n") });
      continue;
    }

    // 空行
    if (line.trim() === "") {
      i++;
      continue;
    }

    // 水平线
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      blocks.push({ type: "heading", level: h[1].length, text: h[2].trim() });
      i++;
      continue;
    }

    // 引用
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", text: buf.join(" ") });
      continue;
    }

    // 表格：当前行含 | 且下一行是分隔行
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const splitRow = (s: string) =>
        s
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // 段落（合并连续非空行）
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ type: "p", text: buf.join(" ") });
  }

  return blocks;
}

/** 行内：**粗体**、`代码`、[文本](链接) */
function renderInline(text: string, keyPrefix: string) {
  // 先按代码切分，代码内不再解析
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code
          key={`${keyPrefix}-c-${idx}`}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-rose-600"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    // 处理链接与粗体
    const nodes: React.ReactNode[] = [];
    let rest = part;
    let guard = 0;
    while (rest.length > 0 && guard < 200) {
      guard++;
      const link = rest.match(/\[([^\]]+)\]\(([^)]+)\)/);
      const bold = rest.match(/\*\*([^*]+)\*\*/);
      // 选择最先出现的标记
      const linkIdx = link ? rest.indexOf(link[0]) : -1;
      const boldIdx = bold ? rest.indexOf(bold[0]) : -1;

      if (linkIdx === -1 && boldIdx === -1) {
        nodes.push(rest);
        break;
      }

      const useLink =
        linkIdx !== -1 && (boldIdx === -1 || linkIdx < boldIdx);

      if (useLink && link) {
        if (linkIdx > 0) nodes.push(rest.slice(0, linkIdx));
        nodes.push(
          <a
            key={`${keyPrefix}-l-${idx}-${guard}`}
            href={link[2]}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-dark underline decoration-brand/40 underline-offset-2 hover:text-brand"
          >
            {link[1]}
          </a>
        );
        rest = rest.slice(linkIdx + link[0].length);
      } else if (bold) {
        if (boldIdx > 0) nodes.push(rest.slice(0, boldIdx));
        nodes.push(
          <strong key={`${keyPrefix}-b-${idx}-${guard}`} className="font-semibold text-ink">
            {bold[1]}
          </strong>
        );
        rest = rest.slice(boldIdx + bold[0].length);
      }
    }
    return <span key={`${keyPrefix}-s-${idx}`}>{nodes}</span>;
  });
}

export default function Markdown({ content }: { content: string }) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-ink-soft">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading": {
            const size =
              b.level === 1
                ? "text-2xl"
                : b.level === 2
                ? "text-xl mt-8"
                : "text-lg mt-6";
            return (
              <h3
                key={i}
                className={`${size} font-bold text-ink border-l-4 border-brand/40 pl-3`}
              >
                {renderInline(b.text, `h-${i}`)}
              </h3>
            );
          }
          case "code":
            return (
              <div
                key={i}
                className="overflow-hidden rounded-xl bg-slate-900 text-[13px] leading-relaxed text-slate-100"
              >
                {b.lang && (
                  <div className="border-b border-white/10 px-4 py-2 text-[11px] uppercase tracking-wide text-slate-400">
                    {b.lang}
                  </div>
                )}
                <pre className="overflow-x-auto p-4">
                  <code className="block whitespace-pre font-mono">
                    {b.code}
                  </code>
                </pre>
              </div>
            );
          case "ul":
            return (
              <ul key={i} className="ml-1 space-y-1.5">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-brand/60" />
                    <span>{renderInline(it, `ul-${i}-${j}`)}</span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="ml-1 space-y-1.5">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand-dark">
                      {j + 1}
                    </span>
                    <span>{renderInline(it, `ol-${i}-${j}`)}</span>
                  </li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="rounded-r-xl border-l-4 border-brand/40 bg-brand/5 px-4 py-3 text-ink-soft"
              >
                {renderInline(b.text, `q-${i}`)}
              </blockquote>
            );
          case "table":
            return (
              <div key={i} className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      {b.header.map((h, j) => (
                        <th
                          key={j}
                          className="border border-slate-200 px-3 py-2 text-left font-semibold text-ink"
                        >
                          {renderInline(h, `th-${i}-${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, ri) => (
                      <tr key={ri} className="odd:bg-white even:bg-slate-50/60">
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className="border border-slate-200 px-3 py-2 align-top"
                          >
                            {renderInline(cell, `td-${i}-${ri}-${ci}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "hr":
            return <hr key={i} className="border-slate-200" />;
          case "p":
            return (
              <p key={i} className="leading-7">
                {renderInline(b.text, `p-${i}`)}
              </p>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
