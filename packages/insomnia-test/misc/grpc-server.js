#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const { ReflectionService } = require("@grpc/reflection");

const PROTO_PATH = path.join(__dirname, "protos", "hello.proto");

const TLS_KEY = fs.readFileSync(
  path.join(__dirname, "fixtures", "localhost-key.pem"),
);
const TLS_CERT = fs.readFileSync(
  path.join(__dirname, "fixtures", "localhost-cert.pem"),
);

const MTLS_CA = fs.readFileSync(path.join(__dirname, "fixtures", "mtls-ca.pem"));
const MTLS_KEY = fs.readFileSync(
  path.join(__dirname, "fixtures", "mtls-server-key.pem"),
);
const MTLS_CERT = fs.readFileSync(
  path.join(__dirname, "fixtures", "mtls-server-cert.pem"),
);

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const helloProto = grpc.loadPackageDefinition(packageDefinition).hello;

const CUSTOM_HEADER = "x-test-header";
const REPLY_DELAY_HEADER = "x-reply-delay-ms";
const DEFAULT_REPLY_DELAY_MS = 50;

const server = new grpc.Server();
server.addService(helloProto.HelloService.service, {
  sayHello(call, callback) {
    if (!call.request.greeting) {
      callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "greeting is required",
      });
      return;
    }
    const custom = call.metadata.get(CUSTOM_HEADER)[0];
    const reply = custom
      ? `hello ${call.request.greeting} (${custom})`
      : `hello ${call.request.greeting}`;
    callback(null, { reply });
  },
  lotsOfReplies(call) {
    const names = (call.request.greeting || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    const queue = names.length ? names : [""];
    const delayMs =
      Number(call.metadata.get(REPLY_DELAY_HEADER)[0]) ||
      DEFAULT_REPLY_DELAY_MS;
    let index = 0;
    const interval = setInterval(() => {
      if (index >= queue.length) {
        clearInterval(interval);
        call.end();
        return;
      }
      call.write({ reply: `hello ${queue[index]}` });
      index++;
    }, delayMs);
    call.on("cancelled", () => clearInterval(interval));
  },
  lotsOfGreetings(call, callback) {
    const greetings = [];
    call.on("data", (chunk) => {
      if (chunk.greeting) greetings.push(chunk.greeting);
    });
    call.on("end", () =>
      callback(null, { reply: `hello ${greetings.join(", ")}` }),
    );
  },
  bidiHello(call) {
    call.on("data", (chunk) => {
      call.write({ reply: `hello ${chunk.greeting || ""}` });
    });
    call.on("end", () => call.end());
  },
});

new ReflectionService(packageDefinition).addToServer(server);

const PORT = process.env.GRPC_PORT || 9000;
const SECURE_PORT = process.env.GRPC_SECURE_PORT || 9001;
const MTLS_PORT = process.env.GRPC_MTLS_PORT || 9002;

server.bindAsync(
  `0.0.0.0:${PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (err) => {
    if (err) {
      process.stderr.write(`Failed to start gRPC mock server: ${err}\n`);
      process.exit(1);
    }
    process.stdout.write(`gRPC mock server listening on port ${PORT}\n`);
  },
);
server.bindAsync(
  `0.0.0.0:${SECURE_PORT}`,
  grpc.ServerCredentials.createSsl(null, [
    { private_key: TLS_KEY, cert_chain: TLS_CERT },
  ]),
  (err) => {
    if (err) {
      process.stderr.write(`Failed to start secure gRPC mock server: ${err}\n`);
      process.exit(1);
    }
    process.stdout.write(
      `gRPC mock server (TLS) listening on port ${SECURE_PORT}\n`,
    );
  },
);
server.bindAsync(
  `0.0.0.0:${MTLS_PORT}`,
  grpc.ServerCredentials.createSsl(
    MTLS_CA,
    [{ private_key: MTLS_KEY, cert_chain: MTLS_CERT }],
    true,
  ),
  (err) => {
    if (err) {
      process.stderr.write(`Failed to start mTLS gRPC mock server: ${err}\n`);
      process.exit(1);
    }
    process.stdout.write(
      `gRPC mock server (mTLS) listening on port ${MTLS_PORT}\n`,
    );
  },
);
