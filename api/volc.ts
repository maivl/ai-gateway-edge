export const runtime = "edge";

const VOLC_API_URL =
  "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

export async function GET() {
  return new Response("OK");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('reqqqqq-------', VOLC_API_URL, process.env.VOLC_API_KEY)
    console.log(body)

    const upstream = await fetch(VOLC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VOLC_API_KEY ?? ""}`
      },
      body: JSON.stringify({
        model: body.model || "ep-xxxx",
        messages: body.messages,
        temperature: body.temperature ?? 0.7,
        stream: body.stream ?? false
      })
    });

    if (!upstream.ok) {
      return new Response(await upstream.text(), { status: 500 });
    }

    // stream
    if (body.stream) {
      return new Response(upstream.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache"
        }
      });
    }

    // normal
    return new Response(await upstream.text(), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.log(err)
    return new Response(
      JSON.stringify({
        error: "edge_error",
        message: err?.message ?? String(err)
      }),
      { status: 500 }
    );
  }
}