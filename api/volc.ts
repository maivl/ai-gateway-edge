// api/volc.ts
export const runtime = "edge";

const VOLC_API_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

const TIMEOUT_MS = 25000;

function withTimeout(ms: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { controller, id };
}

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    // 只加一个 headers，浏览器就会立刻结束请求，不再转圈！
    return new Response("Method Not Allowed", { 
      status: 405,
      headers: { "Content-Type": "text/plain" } // 👈 只加这一句
    });
  }

  try {
    const body = await req.json();

    const { controller, id } = withTimeout(TIMEOUT_MS);

    const upstream = await fetch(VOLC_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VOLC_API_KEY || ""}`
      },
      body: JSON.stringify({
        model: body.model || "ep-xxxx",
        messages: body.messages,
        temperature: body.temperature ?? 0.7,
        stream: body.stream ?? false
      })
    });

    clearTimeout(id);

    if (!upstream.ok) {
      const errText = await upstream.text();
      return new Response(
        JSON.stringify({
          error: "upstream_error",
          detail: errText
        }),
        { status: 500 }
      );
    }

    // ========================
    // STREAM 透传（SSE）
    // ========================
    if (body.stream) {
      return new Response(upstream.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive"
        }
      });
    }

    // ========================
    // NON-STREAM
    // ========================
    const data = await upstream.json();

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "edge_error",
        message: err?.message || String(err)
      }),
      { status: 500 }
    );
  }
}