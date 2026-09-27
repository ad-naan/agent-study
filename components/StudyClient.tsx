"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Topic } from "@/lib/knowledge";
import Markdown from "@/components/Markdown";

type Props = {
  todayTopicId: string;
  dayNumber: number;
  total: number;
  dateLabel: string;
  topics: Topic[];
  tracks: string[];
};

type Progress = {
  learnedIds: string[];
  lastLearnedDate: string | null;
  streak: number;
};

const STORAGE_KEY = "study-progress-v2";

const difficultyStyle: Record<string, string> = {
  入门: "bg-emerald-100 text-emerald-700 ring-emerald-600/20",
  进阶: "bg-amber-100 text-amber-700 ring-amber-600/20",
  高级: "bg-rose-100 text-rose-700 ring-rose-600/20",
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function loadProgress(): Progress {
  if (typeof window === "undefined") {
    return { learnedIds: [], lastLearnedDate: null, streak: 0 };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { learnedIds: [], lastLearnedDate: null, streak: 0 };
    const p = JSON.parse(raw) as Progress;
    return {
      learnedIds: p.learnedIds ?? [],
      lastLearnedDate: p.lastLearnedDate ?? null,
      streak: p.streak ?? 0,
    };
  } catch {
    return { learnedIds: [], lastLearnedDate: null, streak: 0 };
  }
}

function daysBetween(a: string, b: string): number {
  const pa = a.split("-").map(Number);
  const pb = b.split("-").map(Number);
  const da = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const db = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((db - da) / (24 * 60 * 60 * 1000));
}

export default function StudyClient({
  todayTopicId,
  dayNumber,
  total,
  dateLabel,
  topics,
  tracks,
}: Props) {
  const [progress, setProgress] = useState<Progress>({
    learnedIds: [],
    lastLearnedDate: null,
    streak: 0,
  });
  const [mounted, setMounted] = useState(false);

  const [activeId, setActiveId] = useState(todayTopicId);
  const [trackFilter, setTrackFilter] = useState<string>("全部");
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [lesson, setLesson] = useState("");
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const activeTopic = useMemo(
    () => topics.find((t) => t.id === activeId) ?? topics[0],
    [topics, activeId]
  );

  useEffect(() => {
    setProgress(loadProgress());
    setMounted(true);
  }, []);

  const loadLesson = useCallback(
    async (id: string, refresh = false) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setLesson("");
      setSource("");
      try {
        const res = await fetch(
          `/api/lesson?topic=${encodeURIComponent(id)}${refresh ? "&refresh=1" : ""}`,
          { signal: ctrl.signal }
        );
        setSource(res.headers.get("X-Lesson-Source") ?? "");
        if (!res.body) {
          setLesson(await res.text());
          setLoading(false);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setLesson(acc);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setLesson(
            (prev) => prev + `\n\n> ❌ 加载失败：${(err as Error).message}`
          );
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // 切换主题时加载讲义
  useEffect(() => {
    loadLesson(activeId);
    return () => abortRef.current?.abort();
  }, [activeId, loadLesson]);

  // 打开抽屉时锁定 body 滚动（移动端体验）
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const isLearned = progress.learnedIds.includes(activeId);

  function markLearned() {
    setProgress((prev) => {
      if (prev.learnedIds.includes(activeId)) return prev;
      const tk = todayKey();
      let streak = prev.streak;
      if (prev.lastLearnedDate === null) {
        streak = 1;
      } else {
        const gap = daysBetween(prev.lastLearnedDate, tk);
        if (gap === 0) streak = prev.streak === 0 ? 1 : prev.streak;
        else if (gap === 1) streak = prev.streak + 1;
        else streak = 1;
      }
      const next: Progress = {
        learnedIds: [...prev.learnedIds, activeId],
        lastLearnedDate: tk,
        streak,
      };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const learnedCount = progress.learnedIds.length;
  const percent = useMemo(
    () => Math.min(100, Math.round((learnedCount / total) * 100)),
    [learnedCount, total]
  );

  const filteredTopics = useMemo(() => {
    const q = query.trim().toLowerCase();
    return topics.filter((t) => {
      const trackOk = trackFilter === "全部" || t.track === trackFilter;
      if (!trackOk) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.track.toLowerCase().includes(q)
      );
    });
  }, [topics, trackFilter, query]);

  const badge = difficultyStyle[activeTopic.difficulty] ?? difficultyStyle["进阶"];

  function selectTopic(id: string) {
    setActiveId(id);
    setDrawerOpen(false);
  }

  // 目录（侧栏 / 抽屉共用）
  const catalog = (
    <div className="flex h-full flex-col">
      {/* 搜索 */}
      <div className="relative mb-3">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="9" cy="9" r="6" />
          <path d="m14 14 3 3" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索知识点…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-brand/50 focus:ring-2 focus:ring-brand/20"
        />
      </div>

      {/* 轨道过滤 */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {["全部", ...tracks].map((t) => (
          <button
            key={t}
            onClick={() => setTrackFilter(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              trackFilter === t
                ? "bg-brand text-white shadow-sm shadow-brand/30"
                : "bg-white text-ink-soft ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 列表 */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200/80 lg:max-h-[calc(100vh-13rem)]">
        {filteredTopics.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-ink-muted">
            没有匹配的知识点
          </p>
        )}
        {filteredTopics.map((t) => {
          const done = mounted && progress.learnedIds.includes(t.id);
          const active = t.id === activeId;
          return (
            <button
              key={t.id}
              onClick={() => selectTopic(t.id)}
              className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                active
                  ? "bg-brand/10 ring-1 ring-brand/30"
                  : "hover:bg-slate-50 active:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 flex-none rounded-full ${
                    done ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                />
                <span className="text-sm font-medium text-ink line-clamp-1">
                  {t.title}
                </span>
                {t.id === todayTopicId && (
                  <span className="ml-auto flex-none rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-dark">
                    今日
                  </span>
                )}
              </div>
              <div className="mt-0.5 pl-3.5 text-xs text-ink-muted">
                {t.track} · {t.category}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* 顶部栏：粘性，移动端紧凑 */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-slate-50/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2 flex-none">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-soft opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
              </span>
              <span className="truncate text-sm font-semibold text-ink">
                全栈知识每日精讲
              </span>
              <span className="hidden flex-none rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand-dark sm:inline">
                Day {dayNumber}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {dateLabel} · 前端 / 后端 / 数据库 / 中间件 / AI Agent
            </p>
          </div>

          {/* 统计：紧凑 chips */}
          <div className="flex flex-none items-center gap-2">
            <div className="rounded-xl bg-white px-3 py-1.5 text-center shadow-sm ring-1 ring-slate-200/80">
              <span className="text-base font-bold leading-none text-brand-dark">
                {mounted ? progress.streak : "—"}
              </span>
              <span className="ml-1 text-xs text-ink-muted">🔥</span>
            </div>
            <div className="rounded-xl bg-white px-3 py-1.5 text-center shadow-sm ring-1 ring-slate-200/80">
              <span className="text-base font-bold leading-none text-ink">
                {mounted ? learnedCount : "—"}
              </span>
              <span className="text-xs font-normal text-ink-muted">
                /{total}
              </span>
            </div>
          </div>
        </div>

        {/* 进度条紧贴顶部栏底部 */}
        <div className="h-1 w-full bg-slate-200">
          <div
            className="h-full bg-gradient-to-r from-brand-soft to-brand-dark transition-all duration-700"
            style={{ width: `${mounted ? percent : 0}%` }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-5 sm:py-8">
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* 桌面侧栏 */}
          <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
            {catalog}
          </aside>

          {/* 主内容：讲义 */}
          <article className="min-w-0 animate-fade-up rounded-2xl bg-white p-5 shadow-xl shadow-slate-200/50 ring-1 ring-slate-200/80 sm:rounded-3xl sm:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-ink-soft">
                {activeTopic.track} · {activeTopic.category}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${badge}`}
              >
                {activeTopic.difficulty}
              </span>
              {activeId === todayTopicId && (
                <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand-dark">
                  今日推荐
                </span>
              )}
              <button
                onClick={() => loadLesson(activeId, true)}
                disabled={loading}
                className="ml-auto rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-ink-soft transition hover:bg-slate-50 disabled:opacity-50"
              >
                {loading ? "生成中…" : "🔄 重新生成"}
              </button>
            </div>

            <h2 className="text-xl font-bold text-ink sm:text-2xl">
              {activeTopic.title}
            </h2>
            <p className="mt-2 rounded-2xl bg-brand/5 p-4 text-sm leading-relaxed text-ink-soft ring-1 ring-brand/10">
              🎯 本篇目标：{activeTopic.focus}
            </p>

            {/* Lesson body */}
            <div className="mt-6 min-h-[120px]">
              {lesson ? (
                <Markdown content={lesson} />
              ) : loading ? (
                <div className="flex items-center gap-3 text-sm text-ink-muted">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
                  AI 正在为你梳理讲义…
                </div>
              ) : (
                <p className="text-sm text-ink-muted">暂无内容。</p>
              )}
              {loading && lesson && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-brand align-middle" />
              )}
            </div>

            {source === "ai" && (
              <p className="mt-4 text-xs text-ink-muted">
                内容由 AI 基于官方文档实时生成，仅供学习参考，请以官方文档为准。
              </p>
            )}

            {/* References */}
            {activeTopic.references.length > 0 && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                <h3 className="mb-2 text-sm font-semibold text-ink">
                  📚 官方文档（延伸阅读）
                </h3>
                <ul className="space-y-1">
                  {activeTopic.references.map((ref) => (
                    <li key={ref.url}>
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-brand-dark underline decoration-brand/40 underline-offset-2 hover:text-brand"
                      >
                        {ref.label} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action */}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={markLearned}
                disabled={isLearned}
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                  isLearned
                    ? "cursor-default bg-emerald-100 text-emerald-700"
                    : "bg-brand text-white shadow-lg shadow-brand/25 hover:bg-brand-dark"
                }`}
              >
                {isLearned ? "✓ 已学会" : "标记为已学 ✓"}
              </button>
              {isLearned && (
                <span className="text-sm text-ink-muted">继续下一个吧！</span>
              )}
            </div>
          </article>
        </div>
      </main>

      {/* 移动端：悬浮“目录”按钮 */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-brand/30 transition active:scale-95 lg:hidden"
        aria-label="打开知识点目录"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        目录
      </button>

      {/* 移动端：抽屉 */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${
          drawerOpen ? "" : "pointer-events-none"
        }`}
        aria-hidden={!drawerOpen}
      >
        {/* 遮罩 */}
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* 面板：从底部升起 */}
        <div
          className={`absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-slate-50 p-4 shadow-2xl transition-transform duration-300 ${
            drawerOpen ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="mx-auto h-1 w-10 rounded-full bg-slate-300" />
            </div>
          </div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">知识点目录</h2>
            <button
              onClick={() => setDrawerOpen(false)}
              className="rounded-full p-1.5 text-ink-muted transition hover:bg-slate-200"
              aria-label="关闭"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className="min-h-0 flex-1">{catalog}</div>
        </div>
      </div>
    </div>
  );
}
