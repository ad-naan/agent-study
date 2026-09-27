import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "每日 Agent | 一天一个知识点",
  description:
    "每天一个 AI Agent 知识点，督促自己持续学习。ReAct、工具调用、记忆、规划、RAG、多 Agent 协作……",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
