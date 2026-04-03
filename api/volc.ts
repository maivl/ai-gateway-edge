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

    const upstream = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer 83471513-157d-4b06-869b-d3c711c5ac37`
      },
      body: JSON.stringify({
        model: "doubao-seed-2-0-lite-260215",
        messages: [
            {
                "role": "system",
                "content": "You are a helpful assistant."
            },
            {
                "role": "user",
                "content": "Hello!"
            }
        ],
        temperature: 0.7,
        stream: true
      })
    })

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