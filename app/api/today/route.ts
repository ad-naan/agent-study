import { NextResponse } from "next/server";
import { getTodayTopic, getCatalogMeta } from "@/lib/catalog";

/**
 * GET /api/today
 * 返回今天轮换到的主题（不含 AI 讲义正文，正文由 /api/lesson 生成）。
 */
export const dynamic = "force-dynamic";

export function GET() {
  const today = getTodayTopic();
  const meta = getCatalogMeta();
  return NextResponse.json({
    date: new Date().toISOString().slice(0, 10),
    dayNumber: today.dayNumber,
    index: today.index,
    total: today.total,
    topic: today.topic,
    catalog: meta,
  });
}
