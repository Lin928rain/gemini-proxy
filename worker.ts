// main.ts (修改版)
const GEMINI_API_URL = "https://generativelanguage.googleapis.com";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // 1. 检查自定义 Token (Authorization Header)
  const customToken = Deno.env.get("CUSTOM_TOKEN");
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || authHeader !== `Bearer ${customToken}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. 获取 Gemini API Key (from Environment Variable)
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return new Response("Internal Server Error", { status: 500 }); // Indicate missing API key
  }

  // 3. 构建目标 URL (显式构建查询参数)
  const targetUrl = new URL(`${GEMINI_API_URL}${pathname}`);
  targetUrl.searchParams.set("key", apiKey); // 明确设置 key 参数, 会覆盖任何已有的同名参数
    // 4. 创建代理请求
    const proxyReq = new Request(targetUrl, {
        method: req.method,
        headers: req.headers,
        body: req.body, // 确保 body 被正确传递
        redirect: "manual",
    });

  // 5. 移除 headers
  proxyReq.headers.delete("host");
  proxyReq.headers.delete("Authorization"); // Remove the custom token header

  try {
    // 6. Fetch from Gemini API
    const proxyRes = await fetch(proxyReq);

    // 7. CORS Handling
    const headers = new Headers(proxyRes.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization"); // Allow Authorization for custom token

    return new Response(proxyRes.body, {
      status: proxyRes.status,
      headers: headers,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response("Proxy Error", { status: 502 }); // Bad Gateway
  }
});

console.log("Gemini API proxy server running...");
