// main.ts
const GEMINI_API_URL = "https://generativelanguage.googleapis.com";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // 构建目标 URL
  const targetUrl = `${GEMINI_API_URL}${pathname}${url.search}`;

  // 创建代理请求（复制请求头等）
  const proxyReq = new Request(targetUrl, {
    method: req.method,
    headers: req.headers,
    body: req.body, // 如果有请求体
    redirect: "manual", // 重要：防止 Deno 自动处理重定向
  });
  // 移除host
  proxyReq.headers.delete("host");

  // 发起代理请求
  try {
      const proxyRes = await fetch(proxyReq);
      // console.log(proxyRes.status);
      // console.log(proxyRes.headers);
      // 直接返回代理响应（包括状态码、响应头、响应体）
      return new Response(proxyRes.body, {
          status: proxyRes.status,
          headers: proxyRes.headers,
      });
  }catch (error)
    {
        console.error("Proxy error:", error);
        return new Response("Proxy Error", { status: 502 }); // Bad Gateway
    }

});

console.log("Gemini API proxy server running...");
