import http from "node:http";
import net from "node:net";
import type { Duplex } from "node:stream";

// Mirror any change here into `RESOLVING_PROXY_HOST` in constants.ts.
const FAKE_HOST = "insomnia.test";

const toLoopback = (host: string) => (host === FAKE_HOST ? "127.0.0.1" : host);

// A forward proxy that resolves `FAKE_HOST` to 127.0.0.1 (http requests are
// forwarded directly, https goes through a CONNECT tunnel). Insomnia sends
// requests with libcurl, so Chromium/Node DNS overrides don't apply — a spec
// points Insomnia's proxy settings at this server instead, to reach the other
// mock servers under a hostname that isn't `localhost`.
// Mounted on the main server (misc/server/index.ts) ahead of every other
// middleware: a proxied http request carries an absolute-URI request line
// (`GET http://insomnia.test:4010/... HTTP/1.1`), which no regular route matches.
export const resolvingProxyMiddleware = (req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => {
  if (!/^https?:\/\//i.test(req.url!)) {
    next();
    return;
  }
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
};

const handleConnect = (req: http.IncomingMessage, clientSocket: Duplex, head: Buffer) => {
  const [host, port] = req.url!.split(":");
  const upstream = net.connect(Number(port), toLoopback(host), () => {
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    upstream.write(head);
    upstream.pipe(clientSocket);
    clientSocket.pipe(upstream);
  });
  upstream.on("error", () => clientSocket.destroy());
  clientSocket.on("error", () => upstream.destroy());
};

export function attachResolvingProxy(server: http.Server) {
  server.on("connect", handleConnect);
}
