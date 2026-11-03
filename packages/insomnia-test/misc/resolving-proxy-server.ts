#!/usr/bin/env node

import http from "node:http";
import net from "node:net";

const PORT = 4095;

// Mirror any change here into `RESOLVING_PROXY_HOST` in constants.ts.
const FAKE_HOST = "insomnia.test";

const toLoopback = (host: string) => (host === FAKE_HOST ? "127.0.0.1" : host);

// A forward proxy that resolves `FAKE_HOST` to 127.0.0.1 (http requests are
// forwarded directly, https goes through a CONNECT tunnel). Insomnia sends
// requests with libcurl, so Chromium/Node DNS overrides don't apply — a spec
// points Insomnia's proxy settings at this server instead, to reach the other
// mock servers under a hostname that isn't `localhost`.
const server = http.createServer((req, res) => {
  const target = new URL(req.url!);
  const upstream = http.request(
    {
      host: toLoopback(target.hostname),
      port: target.port || 80,
      path: target.pathname + target.search,
      method: req.method,
      headers: req.headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode!, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on("error", () => res.destroy());
  req.pipe(upstream);
});

server.on("connect", (req, clientSocket, head) => {
  const [host, port] = req.url!.split(":");
  const upstream = net.connect(Number(port), toLoopback(host), () => {
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    upstream.write(head);
    upstream.pipe(clientSocket);
    clientSocket.pipe(upstream);
  });
  upstream.on("error", () => clientSocket.destroy());
  clientSocket.on("error", () => upstream.destroy());
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[resolving-proxy-server] listening on :${PORT}`);
});
