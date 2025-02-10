const GEMINI_API_URL = "https://generativelanguage.googleapis.com";
const CUSTOM_API_KEY_PLACEHOLDER = Deno.env.get("CUSTOM_API_KEY")!; // 从环境变量读取自定义字符串

const API_KEYS = [
  Deno.env.get("API_KEY_1")!,
  Deno.env.get("API_KEY_2")!,
  Deno.env.get("API_KEY_3")!,
];

const DAILY_QUOTA_LIMIT = 50;
const QUOTA_WARNING_THRESHOLD = 45;

interface ApiKeyStatus {
  key: string;
  requestCount: number;
  lastUsed: number;
}

let apiKeyStatusList: ApiKeyStatus[] = API_KEYS.map((key) => ({
  key,
  requestCount: 0,
  lastUsed: 0,
}));

let currentApiKeyIndex = 0;

function resetDailyCounts() {
  const now = Date.now();
  apiKeyStatusList.forEach((status) => {
    if (now - status.lastUsed > 24 * 60 * 60 * 1000) {
      status.requestCount = 0;
    }
  });
}

function getCurrentApiKey(): string | null {
  resetDailyCounts();
  for (let i = 0; i < apiKeyStatusList.length; i++) {
    const index = (currentApiKeyIndex + i) % apiKeyStatusList.length;
    const status = apiKeyStatusList[index];
    if (status.requestCount < QUOTA_WARNING_THRESHOLD) {
      currentApiKeyIndex = index;
      return status.key;
    }
  }
  return null;
}

function updateApiKeyUsage(apiKey: string) {
  const status = apiKeyStatusList.find((s) => s.key === apiKey);
  if (status) {
    status.requestCount++;
    status.lastUsed = Date.now();
  }
}

Deno.serve(async (req: Request) => {
  const currentApiKey = getCurrentApiKey();
  if (!currentApiKey) {
    return new Response("All API keys are near quota limit.", { status: 503 });
  }

  try {
    // 将请求体（如果存在）转换为字符串
    let requestBodyText = "";
    if (req.body) {
      requestBodyText = await req.text(); // 假设请求体是文本（例如 JSON）
    }
        // 将自定义 API Key 占位符替换为真实的 API Key
    const modifiedRequestBody = requestBodyText.replace(
      CUSTOM_API_KEY_PLACEHOLDER,
      currentApiKey
    );

    // 使用修改后的请求体创建新的请求
    const proxyReq = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: modifiedRequestBody, // 使用修改后的请求体
      redirect: "manual",
    });

    // 移除host
    proxyReq.headers.delete("host");
    // 构建目标 URL
    const url = new URL(req.url);
    const pathname = url.pathname;
    const targetUrl = `${GEMINI_API_URL}${pathname}${url.search}`;

    const response = await fetch(targetUrl, proxyReq); //直接把修改后的请求发给google

    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-goog-api-key");

    if (response.ok)
    {
      updateApiKeyUsage(currentApiKey)
    }

    return new Response(response.body, {
      status: response.status,
      headers: headers,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response("Proxy Error", { status: 502 });
  }
});

console.log("Gemini API proxy server with key rotation (v2) running...");

