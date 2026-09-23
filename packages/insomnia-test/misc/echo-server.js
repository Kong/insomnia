#!/usr/bin/env node
"use strict";

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { graphql, buildSchema } = require("graphql");

const PETSTORE_SWAGGER = fs.readFileSync(
  path.join(__dirname, "fixtures", "petstore-swagger.json"),
  "utf8",
);

const GRAPHQL_SCHEMA = buildSchema(`
  """A character from the show."""
  type Character {
    """The character's given name."""
    name: String!
    """Whether the character is alive or dead."""
    status: String!
  }

  """A page of character search results."""
  type CharacterResults {
    results: [Character!]!
  }

  """A single episode."""
  type Episode {
    id: Int!
    name: String!
  }

  input CharacterFilter {
    status: String
  }

  type Query {
    """Search characters, optionally filtered by status."""
    characters(filter: CharacterFilter): CharacterResults!
    """Look up a single episode by its numeric id."""
    episode(id: Int!): Episode
  }
`);

const GRAPHQL_CHARACTERS = [
  { name: "Rick Sanchez", status: "Alive" },
  { name: "Morty Smith", status: "Alive" },
  { name: "Summer Smith", status: "Dead" },
];

const GRAPHQL_EPISODES = [
  { id: 1, name: "Pilot" },
  { id: 2, name: "Lawnmower Dog" },
  { id: 3, name: "Anatomy Park" },
];

const GRAPHQL_ROOT = {
  characters: ({ filter }) => ({
    results: filter?.status
      ? GRAPHQL_CHARACTERS.filter((c) => c.status === filter.status)
      : GRAPHQL_CHARACTERS,
  }),
  episode: ({ id }) => GRAPHQL_EPISODES.find((e) => e.id === id) ?? null,
};

const HTTPS_OPTIONS = {
  key: fs.readFileSync(path.join(__dirname, "fixtures", "localhost-key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "fixtures", "localhost-cert.pem")),
};

const MTLS_CA = fs.readFileSync(path.join(__dirname, "fixtures", "mtls-ca.pem"));
const MTLS_SERVER_OPTIONS = {
  key: fs.readFileSync(path.join(__dirname, "fixtures", "mtls-server-key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "fixtures", "mtls-server-cert.pem")),
};

const CUSTOM_CA_HTTPS_OPTIONS = { ...MTLS_SERVER_OPTIONS };

const MTLS_HTTPS_OPTIONS = {
  ...MTLS_SERVER_OPTIONS,
  ca: [MTLS_CA],
  requestCert: true,
  rejectUnauthorized: true,
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function delayResponse(req) {
  const delayMs = Number(req.headers["x-reply-delay-ms"]) || 0;
  if (delayMs <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return cookies;
}

async function handleRequest(req, res) {
  const url = new URL(
    req.url,
    `${req.socket.encrypted ? "https" : "http"}://localhost`,
  );
  process.stdout.write(`${req.method} ${url.pathname}\n`);
  await delayResponse(req);

  if (req.method === "GET" && url.pathname === "/cookies") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify({ cookies: parseCookies(req.headers.cookie) }));
    return;
  }

  if (
    (req.method === "POST" || req.method === "QUERY") &&
    url.pathname === "/post"
  ) {
    const raw = await readBody(req);
    let json = null;
    try {
      json = JSON.parse(raw);
    } catch {
    }
    const args = {};
    for (const [k, v] of url.searchParams) {
      if (args[k] === undefined) {
        args[k] = v;
      } else if (Array.isArray(args[k])) {
        args[k].push(v);
      } else {
        args[k] = [args[k], v];
      }
    }
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(
      JSON.stringify({
        args,
        data: raw,
        files: {},
        form: {},
        headers: req.headers,
        json,
        origin: req.socket.remoteAddress || "127.0.0.1",
        url: url.toString(),
      }),
    );
    return;
  }

  if (req.method === "POST" && url.pathname === "/posts") {
    const raw = await readBody(req);
    let parsed = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
    }
    res.writeHead(201, {
      "content-type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify({ ...parsed, id: 101 }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/graphql") {
    const raw = await readBody(req);
    let query = "";
    let variables;
    let operationName;
    try {
      ({ query = "", variables, operationName } = JSON.parse(raw));
    } catch {
    }
    const result = await graphql({
      schema: GRAPHQL_SCHEMA,
      source: query,
      rootValue: GRAPHQL_ROOT,
      variableValues: variables,
      operationName,
    });
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify(result));
    return;
  }

  if (req.method === "GET" && url.pathname === "/v2/swagger.json") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(PETSTORE_SWAGGER);
    return;
  }

  if (req.method === "GET" && /^\/v2\/pet\/\d+$/.test(url.pathname)) {
    const petId = Number(url.pathname.split("/").pop());
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(
      JSON.stringify({
        id: petId,
        category: { id: 1, name: "dogs" },
        name: "doggie",
        photoUrls: ["https://example.com/doggie.jpg"],
        tags: [{ id: 1, name: "friendly" }],
        status: "available",
        cookies: parseCookies(req.headers.cookie),
      }),
    );
    return;
  }

  if (req.method === "POST" && url.pathname === "/calculator.asmx") {
    const raw = await readBody(req);
    const intA =
      parseInt((raw.match(/<[\w:]*intA>(-?\d+)</) || [])[1], 10) || 0;
    const intB =
      parseInt((raw.match(/<[\w:]*intB>(-?\d+)</) || [])[1], 10) || 0;
    res.writeHead(200, {
      "Content-Type": "text/xml; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(
      `<?xml version="1.0" encoding="utf-8"?>` +
        `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
        `<soap:Body><AddResponse xmlns="http://tempuri.org/">` +
        `<AddResult>${intA + intB}</AddResult>` +
        `</AddResponse></soap:Body></soap:Envelope>`,
    );
    return;
  }

  if (req.method === "GET" && url.pathname === "/status/404") {
    res.writeHead(404, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
      "Access-Control-Allow-Headers": "*",
    });
    res.end();
    return;
  }

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end("{}");
}

const server = http.createServer(handleRequest);
const httpsServer = https.createServer(HTTPS_OPTIONS, handleRequest);
const customCaHttpsServer = https.createServer(
  CUSTOM_CA_HTTPS_OPTIONS,
  handleRequest,
);
const mtlsHttpsServer = https.createServer(MTLS_HTTPS_OPTIONS, handleRequest);

server.listen(4060, () => {
  process.stdout.write("Listening at http://localhost:4060\n");
});
httpsServer.listen(4061, () => {
  process.stdout.write("Listening at https://localhost:4061\n");
});
customCaHttpsServer.listen(4062, () => {
  process.stdout.write("Listening at https://localhost:4062 (custom CA)\n");
});
mtlsHttpsServer.listen(4063, () => {
  process.stdout.write("Listening at https://localhost:4063 (mTLS)\n");
});
