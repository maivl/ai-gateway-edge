export const config = {
  runtime: "edge",
};

const VOLC_ENDPOINT =
  "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

const VOLC_API_KEY = process.env.VOLC_API_KEY!;

/**
 * 模型映射（可扩展）
 */
const MODEL_MAP: Record<string, string> = {
  "gpt-4o": "doubao-pro-32k",
  "gpt-3.5-turbo": "doubao-lite",
};

/**
 * 转换 messages
 */
function transformMessages(messages: any[]) {
  return (messages || []).map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

/**
 * 构建火山请求体
 */
function buildVolcBody(body: any) {
  const model = MODEL_MAP[body.model] || body.model || "doubao-pro-32k";

  return {
    model,
    messages: transformMessages(body.messages),
    temperature: body.temperature ?? 0.7,
    stream: body.stream ?? false,
  };
}

/**
 * SSE 转换（火山 -> OpenAI）
 */
async function* volcToOpenAIStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
) {
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;

      const data = line.replace("data:", "").trim();

      if (data === "[DONE]") {
        yield `data: [DONE]\n\n`;
        return;
      }

      try {
        const json = JSON.parse(data);

        const content =
          json.choices?.[0]?.delta?.content ??
          json.choices?.[0]?.message?.content ??
          "";

        const openaiChunk = {
          id: json.id || "chatcmpl-" + Date.now(),
          object: "chat.completion.chunk",
          choices: [
            {
              delta: {
                content,
              },
              index: 0,
              finish_reason: null,
            },
          ],
        };

        yield `data: ${JSON.stringify(openaiChunk)}\n\n`;
      } catch (e) {
        // 忽略异常 chunk
      }
    }
  }
}

/**
 * 处理 POST
 */
export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: any;

  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const volcRes = await fetch(VOLC_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VOLC_API_KEY}`,
    },
    body: JSON.stringify(buildVolcBody(body)),
  });

  // ===== 非流式 =====
  if (!body.stream) {
    const data = await volcRes.json();

    return new Response(
      JSON.stringify({
        id: data.id || "chatcmpl-" + Date.now(),
        object: "chat.completion",
        choices: [
          {
            message: {
              role: "assistant",
              content:
                data.choices?.[0]?.message?.content ||
                data.choices?.[0]?.text ||
                "",
            },
            finish_reason: "stop",
            index: 0,
          },
        ],
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  // ===== 流式 =====
  const reader = volcRes.body?.getReader();

  if (!reader) {
    return new Response("Stream not supported", { status: 500 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        for await (const chunk of volcToOpenAIStream(reader)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (e) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              error: "stream_error",
            })}\n\n`
          )
        );
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}