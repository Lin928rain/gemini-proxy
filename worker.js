// deno_server.ts

async function handleWebSocket(sock: WebSocket) {
  const targetUrl = `wss://generativelanguage.googleapis.com`; // 假设 pathname 和 search 在这里处理，或者通过其他方式传入

  console.log('Target URL:', targetUrl);

  let pendingMessages: (string | ArrayBuffer)[] = [];
  let targetWebSocket: WebSocket;

  try {
    targetWebSocket = new WebSocket(targetUrl);
  } catch (error) {
    console.error('Failed to connect to target server:', error);
    sock.close(1011, "Failed to connect to upstream"); // 内部错误
    return;
  }


  console.log('Initial targetWebSocket readyState:', targetWebSocket.readyState);

  targetWebSocket.onopen = () => {
    console.log('Connected to target server');
    console.log('targetWebSocket readyState after open:', targetWebSocket.readyState);

    console.log(`Processing ${pendingMessages.length} pending messages`);
    for (const message of pendingMessages) {
      try {
        targetWebSocket.send(message);
        console.log('Sent pending message:', typeof message === 'string' ? message.slice(0, 100) : 'Binary data preview unavailable');
      } catch (error) {
        console.error('Error sending pending message:', error);
      }
    }
    pendingMessages = [];
  };

  sock.onmessage = async (event) => {
    console.log('Received message from client:', {
      dataPreview: typeof event.data === 'string' ? event.data.slice(0, 200) : 'Binary data',
      dataType: typeof event.data,
      timestamp: new Date().toISOString(),
    });

    if (targetWebSocket.readyState === WebSocket.OPEN) {
      try {
        targetWebSocket.send(event.data);
        console.log('Successfully sent message to gemini');
      } catch (error) {
        console.error('Error sending to gemini:', error);
      }
    } else {
      console.log('Connection not ready, queueing message');
      pendingMessages.push(event.data);
    }
  };

  targetWebSocket.onmessage = (event) => {
    console.log('Received message from gemini:', {
      dataPreview: typeof event.data === 'string' ? event.data.slice(0, 200) : 'Binary data',
      dataType: typeof event.data,
      timestamp: new Date().toISOString(),
    });

    try {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(event.data);
        console.log('Successfully forwarded message to client');
      }
    } catch (error) {
      console.error('Error forwarding to client:', error);
    }
  };

  targetWebSocket.onclose = (event) => {
    console.log('Gemini connection closed:', {
      code: event.code,
      reason: event.reason || 'No reason provided',
      wasClean: event.wasClean,
      timestamp: new Date().toISOString(),
      readyState: targetWebSocket.readyState,
    });
    if (sock.readyState === WebSocket.OPEN) {
      sock.close(event.code, event.reason);
    }
  };
    
  sock.onclose = (event) => {
    console.log('Client connection closed:',{
        code: event.code,
        reason: event.reason || 'No reason provided',
        wasClean: event.wasClean,
        timestamp: new Date().toISOString()
    });
    if(targetWebSocket.readyState === WebSocket.OPEN) {
        targetWebSocket.close(event.code, event.reason);
    }
  };

  targetWebSocket.onerror = (error) => {
    console.error('Gemini WebSocket error:', {
      error: (error instanceof ErrorEvent) ? error.message : 'Unknown error', // 更精确的错误类型检查
      timestamp: new Date().toISOString(),
      readyState: targetWebSocket.readyState,
    });
    // 在发生错误时，你可能还想关闭客户端连接
    if (sock.readyState === WebSocket.OPEN) {
      sock.close(1011, "Upstream error"); // 1011 表示服务器遇到意外情况
    }
  };
}


async function handler(req: Request): Promise<Response> {
    const upgrade = req.headers.get("upgrade");
    if (upgrade?.toLowerCase() !== "websocket") {
        return new Response("Expected WebSocket connection", { status: 400 });
    }
    
    const url = new URL(req.url);
    const pathAndQuery = url.pathname + url.search;
  
    const { socket, response } = Deno.upgradeWebSocket(req);
    handleWebSocket(socket); // Pass pathAndQuery if needed
    return response;
}

Deno.serve(handler);

