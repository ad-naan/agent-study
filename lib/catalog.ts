/**
 * 主题池（Catalog）
 *
 * 组合两部分数据：
 * 1. 手写精选主题（lib/knowledge.ts 的 topics）——质量高、带学习路径。
 * 2. 订阅抓取的大主题池（data/catalog.json）——由 scripts/build-catalog.mjs 每日
 *    从 JavaGuide / 小林 coding 的 sitemap 全站抓取，数量可达数百条。
 *
 * 运行期只读取 catalog.json（快），不做网络请求；讲义正文仍由 /api/lesson 在
 * 用户点击时基于原文实时生成。若 catalog.json 不存在（未跑过抓取脚本），则自动
 * 退回到手写精选主题，保证站点始终可用。
 */

import fs from "node:fs";
import path from "node:path";
import { topics as curatedTopics, dayIndex, formatDate, type Topic } from "@/lib/knowledge";

export type { Topic } from "@/lib/knowledge";
export { formatDate } from "@/lib/knowledge";

type CatalogFile = {
  generatedAt: string;
  sources: { key: string; site: string; count: number }[];
  total: number;
  topics: Topic[];
};

let _all: Topic[] | null = null;
let _meta: { generatedAt: string | null; sources: CatalogFile["sources"] } = {
  generatedAt: null,
  sources: [],
};

function loadCatalogFile(): Topic[] {
  try {
    const p = path.join(process.cwd(), "data", "catalog.json");
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as CatalogFile;
    _meta = { generatedAt: parsed.generatedAt ?? null, sources: parsed.sources ?? [] };
    return Array.isArray(parsed.topics) ? parsed.topics : [];
  } catch {
    _meta = { generatedAt: null, sources: [] };
    return [];
  }
}

/** 合并「手写精选 + 订阅抓取」，按首个参考链接去重。手写主题优先。 */
export function getAllTopics(): Topic[] {
  if (_all) return _all;
  const dynamic = loadCatalogFile();
  const seen = new Set<string>();
  const merged: Topic[] = [];
  for (const t of [...curatedTopics, ...dynamic]) {
    const key = t.references?.[0]?.url ?? t.id;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(t);
  }
  _all = merged;
  return merged;
}

export function getCatalogMeta() {
  getAllTopics(); // 确保已加载
  return _meta;
}

export const allTopics: Topic[] = getAllTopics();
export const tracks: string[] = Array.from(new Set(allTopics.map((t) => t.track)));

/** 以“距离纪元的天数”作索引，保证每天轮换、当天稳定。 */
export function getTodayTopic(date: Date = new Date()): {
  topic: Topic;
  index: number;
  total: number;
  dayNumber: number;
} {
  const list = getAllTopics();
  const total = list.length;
  const dn = dayIndex(date);
  const index = ((dn % total) + total) % total;
  return { topic: list[index], index, total, dayNumber: dn + 1 };
}

export function getTopicById(id: string): Topic | undefined {
  return getAllTopics().find((t) => t.id === id);
}
