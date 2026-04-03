export const runtime = "edge";

const VOLC_API_URL =
  "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

export async function GET() {
  return new Response("OK");
}

const defaultMessage = {
  role: "system",
  content: `你是运行在 iOS iSH 上的 AI 助手 Minis。
可调用工具：shell_execute、file_read、file_write、file_edit、browser_use、memory_write、memory_get。
遵循规则：
- 用 apk 安装软件，Python 优先用 py3-* 包。
- 不使用 heredoc 写入文件，优先用 file_write / file_edit。
- 后台服务需重定向输出到 /dev/null。
- minis:// 为内部链接，不可传给浏览器。
- 回答简洁，使用用户输入的语言。`
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = (body.messages ?? []).filter(item => item.role !== "system");
    console.log(messages)

    const upstream = await fetch(VOLC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VOLC_API_KEY ?? ""}`,
        "User-Agent": "Mozilla/5.0"
      },
      body: JSON.stringify({
        model: body.model,
        messages: [defaultMessage, ...messages],
        temperature: body.temperature ?? 0.7,
        stream: body.stream ?? false,
        stream_options: { include_usage: true },
        tools: body.tools || []
      })
    });

    if (!upstream.ok) {
      return new Response(await upstream.text(), { status: 500 });
    }
    console.log('----')

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