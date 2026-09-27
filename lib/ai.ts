/**
 * 通用 OpenAI 兼容客户端。
 *
 * 只依赖三个环境变量，任何兼容 OpenAI /chat/completions 的服务都能用：
 * - OPENAI_BASE_URL  例如 https://api.openai.com/v1 、 https://api.deepseek.com/v1
 * - OPENAI_API_KEY   你的密钥
 * - OPENAI_MODEL     例如 gpt-4o-mini 、 deepseek-chat 、 qwen-plus
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function getAIConfig() {
  const baseURL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
    /\/$/,
    ""
  );
  const apiKey = process.env.OPENAI_API_KEY || "";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  return { baseURL, apiKey, model };
}

export function isAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * 以流式方式调用模型，逐段吐出文本增量（delta）。
 * 解析上游 SSE（data: {...}），只关心 choices[0].delta.content。
 */
export async function* streamChatDeltas(
  messages: ChatMessage[],
  opts: { temperature?: number; signal?: AbortSignal } = {}
): AsyncGenerator<string> {
  const { baseURL, apiKey, model } = getAIConfig();
  if (!apiKey) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: opts.temperature ?? 0.4,
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `AI_REQUEST_FAILED: ${res.status} ${res.statusText} ${text.slice(0, 300)}`
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || !line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data);
        const delta: string | undefined = json?.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // 忽略无法解析的分片
      }
    }
  }
}
