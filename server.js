// LACRM MCP server for Railway.
// Front door: checks ?key= against MCP_AUTH_TOKEN, then forwards to supergateway,
// which runs the lacrm-mcp stdio server and serves it as streamable HTTP at /mcp.

const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const PORT = parseInt(process.env.PORT || "3000", 10);
const INNER_PORT = 8001;
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

if (!AUTH_TOKEN || AUTH_TOKEN.length < 16) {
  console.error("FATAL: MCP_AUTH_TOKEN is missing or shorter than 16 characters. Set it in Railway variables.");
  process.exit(1);
}
if (!process.env.LACRM_API_KEY) {
  console.warn("WARNING: LACRM_API_KEY is not set. The server starts, but LACRM tool calls will fail until you set it.");
}

const gatewayBin = path.join(__dirname, "node_modules", "supergateway", "dist", "index.js");
const lacrmBin = path.join(__dirname, "node_modules", "lacrm-mcp", "build", "index.js");

const gateway = spawn(
  process.execPath,
  [
    gatewayBin,
    "--stdio", `${process.execPath} ${lacrmBin}`,
    "--outputTransport", "streamableHttp",
    "--port", String(INNER_PORT),
    "--host", "127.0.0.1",
    "--streamableHttpPath", "/mcp",
    "--logLevel", "none",
  ],
  { stdio: "inherit", env: process.env }
);

gateway.on("exit", (code) => {
  console.error(`FATAL: supergateway exited with code ${code}`);
  process.exit(1);
});

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    gateway.kill();
    process.exit(0);
  });
}

function keyIsValid(provided) {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(AUTH_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }

  if (url.pathname !== "/mcp") {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
    return;
  }

  if (!keyIsValid(url.searchParams.get("key"))) {
    res.writeHead(403, { "content-type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  // Strip the key before forwarding so it never reaches the inner server or its logs.
  url.searchParams.delete("key");
  const headers = { ...req.headers, host: `127.0.0.1:${INNER_PORT}` };
  const proxyReq = http.request(
    { host: "127.0.0.1", port: INNER_PORT, method: req.method, path: url.pathname + url.search, headers },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
    res.end("Gateway starting or unavailable");
  });
  req.pipe(proxyReq);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`LACRM MCP front door listening on ${PORT} (inner gateway on ${INNER_PORT})`);
});
