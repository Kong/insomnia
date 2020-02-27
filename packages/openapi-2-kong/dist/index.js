// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles
parcelRequire = (function (modules, cache, entry, globalName) {
  // Save the require from previous bundle to this closure if any
  var previousRequire = typeof parcelRequire === 'function' && parcelRequire;
  var nodeRequire = typeof require === 'function' && require;

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire = typeof parcelRequire === 'function' && parcelRequire;
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error('Cannot find module \'' + name + '\'');
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = cache[name] = new newRequire.Module(name);

      modules[name][0].call(module.exports, localRequire, module, module.exports, this);
    }

    return cache[name].exports;

    function localRequire(x){
      return newRequire(localRequire.resolve(x));
    }

    function resolve(x){
      return modules[name][1][x] || x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [function (require, module) {
      module.exports = exports;
    }, {}];
  };

  var error;
  for (var i = 0; i < entry.length; i++) {
    try {
      newRequire(entry[i]);
    } catch (e) {
      // Save first error but execute all entries
      if (!error) {
        error = e;
      }
    }
  }

  if (entry.length) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(entry[entry.length - 1]);

    // CommonJS
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = mainExports;

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
     define(function () {
       return mainExports;
     });

    // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }

  // Override the current require with this new one
  parcelRequire = newRequire;

  if (error) {
    // throw error from earlier, _after updating parcelRequire_
    throw error;
  }

  return newRequire;
})({"FoEN":[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getServers = getServers;
exports.getAllServers = getAllServers;
exports.getSecurity = getSecurity;
exports.getName = getName;
exports.generateSlug = generateSlug;
exports.pathVariablesToRegex = pathVariablesToRegex;
exports.parseUrl = parseUrl;
exports.fillServerVariables = fillServerVariables;
exports.joinPath = joinPath;

var _url = _interopRequireDefault(require("url"));

var _slugify = _interopRequireDefault(require("slugify"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getServers(obj) {
  return obj.servers || [];
}

function getAllServers(api) {
  const servers = getServers(api);

  for (const p of Object.keys(api.paths)) {
    for (const server of getServers(api.paths[p])) {
      servers.push(server);
    }
  }

  return servers;
}

function getSecurity(obj) {
  return obj.security || [];
}

function getName(obj, defaultValue = 'openapi', slugifyOptions) {
  let name;

  if (obj['x-kong-name']) {
    name = obj['x-kong-name'];
  }

  if (!name && obj.info && obj.info.title) {
    name = obj.info.title;
  }

  return generateSlug(name || defaultValue, slugifyOptions);
}

function generateSlug(str, options = {}) {
  options.replacement = options.replacement || '_';
  options.lower = options.lower || false;
  return (0, _slugify.default)(str, options);
}

function pathVariablesToRegex(p) {
  const result = p.replace(/{([^}]+)}/g, '(?<$1>\\S+)');

  if (result === p) {
    return result;
  } // If anything was replaced, it's a regex, so add a line-ending match


  return result + '$';
}

function parseUrl(urlStr) {
  const parsed = _url.default.parse(urlStr);

  if (!parsed.port && parsed.protocol === 'https:') {
    parsed.port = '443';
  } else if (!parsed.port && parsed.protocol === 'http:') {
    parsed.port = '80';
  }

  parsed.protocol = parsed.protocol || 'http:';
  parsed.host = `${parsed.hostname}:${parsed.port}`;
  return parsed;
}

function fillServerVariables(server) {
  let finalUrl = server.url;
  const variables = server.variables || {};

  for (const name of Object.keys(variables)) {
    const defaultValue = variables[name].default;

    if (!defaultValue) {
      throw new Error(`Server variable "${name}" missing default value`);
    }

    finalUrl = finalUrl.replace(`{${name}}`, defaultValue);
  }

  return finalUrl;
}

function joinPath(p1, p2) {
  p1 = p1.replace(/\/$/, '');
  p2 = p2.replace(/^\//, '');
  return `${p1}/${p2}`;
}
},{}],"TyOt":[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.generateSecurityPlugins = generateSecurityPlugins;
exports.generateApiKeySecurityPlugin = generateApiKeySecurityPlugin;
exports.generateHttpSecurityPlugin = generateHttpSecurityPlugin;
exports.generateOpenIdConnectSecurityPlugin = generateOpenIdConnectSecurityPlugin;
exports.generateOAuth2SecurityPlugin = generateOAuth2SecurityPlugin;
exports.generateSecurityPlugin = generateSecurityPlugin;

var _common = require("../common");

function generateSecurityPlugins(op, api) {
  const plugins = [];
  const components = api.components || {};
  const securitySchemes = components.securitySchemes || {};
  const security = op ? (0, _common.getSecurity)(op) : (0, _common.getSecurity)(api);

  for (const securityItem of security || []) {
    for (const name of Object.keys(securityItem)) {
      const scheme = securitySchemes[name] || {};
      const args = securityItem[name];
      const p = generateSecurityPlugin(scheme, args);

      if (p) {
        plugins.push(p);
      }
    }
  }

  return plugins;
}

function generateApiKeySecurityPlugin(scheme) {
  if (!['query', 'header', 'cookie'].includes(scheme.in)) {
    throw new Error(`a ${scheme.type} object expects valid "in" property. Got ${scheme.in}`);
  }

  if (!scheme.name) {
    throw new Error(`a ${scheme.type} object expects valid "name" property. Got ${scheme.name}`);
  }

  return {
    name: 'key-auth',
    config: {
      key_names: [scheme.name]
    }
  };
}

function generateHttpSecurityPlugin(scheme) {
  if ((scheme.scheme || '').toLowerCase() !== 'basic') {
    throw new Error(`Only "basic" http scheme supported. got ${scheme.scheme}`);
  }

  return {
    name: 'basic-auth'
  };
}

function generateOpenIdConnectSecurityPlugin(scheme, args) {
  if (!scheme.openIdConnectUrl) {
    throw new Error(`invalid "openIdConnectUrl" property. Got ${scheme.openIdConnectUrl}`);
  }

  return {
    name: 'openid-connect',
    config: {
      issuer: scheme.openIdConnectUrl,
      scopes_required: args || []
    }
  };
}

function generateOAuth2SecurityPlugin(scheme, args) {
  return {
    config: {
      auth_methods: ['client_credentials']
    },
    name: 'openid-connect'
  };
}

function generateSecurityPlugin(scheme, args) {
  let plugin = null; // Flow doesn't like this (hence the "any" casting) but we're
  // comparing the scheme type in a more flexible way to favor
  // usability

  const type = (scheme.type || '').toLowerCase(); // Generate base plugin

  if (type === 'apikey') {
    plugin = generateApiKeySecurityPlugin(scheme);
  } else if (type === 'http') {
    plugin = generateHttpSecurityPlugin(scheme);
  } else if (type === 'openidconnect') {
    plugin = generateOpenIdConnectSecurityPlugin(scheme, args);
  } else if (type === 'oauth2') {
    plugin = generateOAuth2SecurityPlugin(scheme);
  } else {
    return null;
  } // Add additional plugin configuration from x-kong-* properties


  for (const key of Object.keys(scheme)) {
    if (key.indexOf('x-kong-security-') !== 0) {
      continue;
    }

    const kongSecurity = scheme[key];

    if (kongSecurity.config) {
      plugin.config = kongSecurity.config;
    }
  }

  return plugin;
}
},{"../common":"FoEN"}],"XTAy":[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isPluginKey = isPluginKey;
exports.isRequestValidatorPluginKey = isRequestValidatorPluginKey;
exports.getPluginNameFromKey = getPluginNameFromKey;
exports.generatePlugins = generatePlugins;
exports.generatePlugin = generatePlugin;
exports.generateRequestValidatorPlugin = generateRequestValidatorPlugin;
exports.generateServerPlugins = generateServerPlugins;
exports.generateServerPlugin = generateServerPlugin;
exports.generateOperationPlugins = generateOperationPlugins;
exports.generateOperationPlugin = generateOperationPlugin;

function isPluginKey(key) {
  return key.indexOf('x-kong-plugin-') === 0;
}

function isRequestValidatorPluginKey(key) {
  return key.match(/-request-validator$/) != null;
}

function getPluginNameFromKey(key) {
  return key.replace(/^x-kong-plugin-/, '');
}

function generatePlugins(iterable, generator) {
  const plugins = [];

  for (const key of Object.keys(iterable)) {
    if (!isPluginKey(key)) {
      continue;
    }

    plugins.push(generator(key, iterable[key], iterable));
  }

  return plugins;
}

function generatePlugin(key, value) {
  const plugin = {
    name: value.name || getPluginNameFromKey(key)
  };

  if (value.config) {
    plugin.config = value.config;
  }

  return plugin;
}

function generateRequestValidatorPlugin(obj, operation) {
  const config = {
    version: 'draft4' // Fixed version

  };
  config.parameter_schema = [];

  if (operation.parameters) {
    for (const p of operation.parameters) {
      if (!p.schema) {
        throw new Error("Parameter using 'content' type validation is not supported");
      }

      config.parameter_schema.push({
        in: p.in,
        explode: !!p.explode,
        required: !!p.required,
        name: p.name,
        schema: JSON.stringify(p.schema),
        style: 'simple'
      });
    }
  }

  if (operation.requestBody) {
    const content = operation.requestBody.content;

    if (!content) {
      throw new Error('content property is missing for request-validator!');
    }

    let bodySchema;

    for (const mediatype of Object.keys(content)) {
      if (mediatype !== 'application/json') {
        throw new Error(`Body validation supports only 'application/json', not ${mediatype}`);
      }

      const item = content[mediatype];
      bodySchema = JSON.stringify(item.schema);
    }

    if (bodySchema) {
      config.body_schema = bodySchema;
    }
  }

  return {
    config,
    enabled: true,
    name: 'request-validator'
  };
}

function generateServerPlugins(server) {
  return generatePlugins(server, generateServerPlugin);
}

function generateServerPlugin(key, value, server) {
  return generatePlugin(key, value);
}

function generateOperationPlugins(operation) {
  return generatePlugins(operation, generateOperationPlugin);
}

function generateOperationPlugin(key, value, operation) {
  if (isRequestValidatorPluginKey(key)) {
    return generateRequestValidatorPlugin(value, operation);
  }

  return generatePlugin(key, value);
}
},{}],"dztZ":[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.generateServices = generateServices;
exports.generateService = generateService;
exports.generateRouteName = generateRouteName;

var _common = require("../common");

var _securityPlugins = require("./security-plugins");

var _plugins = require("./plugins");

function generateServices(api, tags) {
  const servers = (0, _common.getAllServers)(api);

  if (servers.length === 0) {
    throw new Error('no servers defined in spec');
  } // only support one service for now


  const service = generateService(servers[0], api, tags);
  return [service];
}

function generateService(server, api, tags) {
  const serverUrl = (0, _common.fillServerVariables)(server);
  const name = (0, _common.getName)(api);
  const service = {
    name,
    url: serverUrl,
    plugins: (0, _plugins.generateServerPlugins)(server),
    routes: [],
    tags
  };

  for (const routePath of Object.keys(api.paths)) {
    const pathItem = api.paths[routePath];

    for (const method of Object.keys(pathItem)) {
      if (method !== 'get' && method !== 'put' && method !== 'post' && method !== 'delete' && method !== 'options' && method !== 'head' && method !== 'patch' && method !== 'trace') {
        continue;
      }

      const operation = pathItem[method]; // This check is here to make Flow happy

      if (!operation) {
        continue;
      } // Create the base route object


      const fullPathRegex = (0, _common.pathVariablesToRegex)(routePath);
      const route = {
        tags,
        name: generateRouteName(api, pathItem, method, service.routes.length),
        methods: [method.toUpperCase()],
        paths: [fullPathRegex],
        strip_path: false
      }; // Generate generic and security-related plugin objects

      const securityPlugins = (0, _securityPlugins.generateSecurityPlugins)(operation, api);
      const regularPlugins = (0, _plugins.generateOperationPlugins)(operation);
      const plugins = [...regularPlugins, ...securityPlugins]; // Add plugins if there are any

      if (plugins.length) {
        route.plugins = plugins;
      }

      service.routes.push(route);
    }
  }

  return service;
}

function generateRouteName(api, pathItem, method, numRoutes) {
  const n = numRoutes;
  const name = (0, _common.getName)(api);

  if (typeof pathItem['x-kong-name'] === 'string') {
    const pathSlug = (0, _common.generateSlug)(pathItem['x-kong-name']);
    return `${name}-${pathSlug}-${method}`;
  } // If a summary key exists, use that to generate the name


  if (typeof pathItem.summary === 'string') {
    const pathSlug = (0, _common.generateSlug)(pathItem.summary);
    return `${name}-${pathSlug}-${method}`;
  } // otherwise, use a unique integer to prevent collisions


  return `${(0, _common.generateSlug)(name)}-path${n ? '_' + n : ''}-${method}`;
}
},{"../common":"FoEN","./security-plugins":"TyOt","./plugins":"XTAy"}],"ouAC":[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.generateUpstreams = generateUpstreams;

var _common = require("../common");

function generateUpstreams(api, tags) {
  const servers = api.servers || [];

  if (servers.length === 0) {
    return [];
  }

  const upstream = {
    name: (0, _common.getName)(api),
    targets: [],
    tags
  };

  for (const server of servers) {
    upstream.targets.push({
      target: (0, _common.parseUrl)(server.url).host
    });
  }

  return [upstream];
}
},{"../common":"FoEN"}],"aT9q":[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.generateDeclarativeConfigFromSpec = generateDeclarativeConfigFromSpec;

var _services = require("./services");

var _upstreams = require("./upstreams");

function generateDeclarativeConfigFromSpec(api, tags) {
  let document = null;

  try {
    document = {
      _format_version: '1.1',
      services: (0, _services.generateServices)(api, tags),
      upstreams: (0, _upstreams.generateUpstreams)(api, tags)
    };
  } catch (err) {
    throw new Error('Failed to generate spec: ' + err.message);
  } // This remover any circular references or weirdness that might result
  // from the JS objects used.
  // SEE: https://github.com/Kong/studio/issues/93


  return JSON.parse(JSON.stringify({
    type: 'kong-declarative-config',
    label: 'Kong Declarative Config',
    documents: [document],
    warnings: []
  }));
}
},{"./services":"dztZ","./upstreams":"ouAC"}],"HEkA":[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.generateKongForKubernetesConfigFromSpec = generateKongForKubernetesConfigFromSpec;
exports.generateMetadataName = generateMetadataName;
exports.generateMetadataAnnotations = generateMetadataAnnotations;
exports.generateRules = generateRules;
exports.generateServiceName = generateServiceName;
exports.generateTlsConfig = generateTlsConfig;
exports.generateServicePort = generateServicePort;
exports.generateServicePath = generateServicePath;
exports.generatePluginDocuments = generatePluginDocuments;

var _common = require("../common");

var _securityPlugins = require("../declarative-config/security-plugins");

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function generateKongForKubernetesConfigFromSpec(api, tags) {
  const metadata = generateMetadata(api);
  const document = {
    apiVersion: 'extensions/v1beta1',
    kind: 'Ingress',
    metadata,
    spec: {
      rules: generateRules(api, metadata.name)
    }
  };
  const otherDocuments = generatePluginDocuments(api); // Add Kong plugins as annotations to ingress definition

  if (otherDocuments.length) {
    const pluginNames = otherDocuments.map(d => d.metadata.name).join(', ');

    if (document.metadata.annotations) {
      document.metadata.annotations['plugins.konghq.com'] = pluginNames;
    } else {
      document.metadata.annotations = {
        'plugins.konghq.com': pluginNames
      };
    }
  }

  const documents = [...otherDocuments, document];
  return {
    type: 'kong-for-kubernetes',
    label: 'Kong for Kubernetes',
    documents,
    warnings: []
  };
}

function generateMetadata(api) {
  const metadata = {
    name: generateMetadataName(api)
  };
  const annotations = generateMetadataAnnotations(api);

  if (annotations) {
    metadata.annotations = annotations;
  }

  return metadata;
}

function generateMetadataName(api) {
  const info = api.info || {};
  const metadata = info['x-kubernetes-ingress-metadata']; // x-kubernetes-ingress-metadata.name

  if (metadata && metadata.name) {
    return metadata.name;
  }

  return (0, _common.getName)(api, 'openapi', {
    lower: true,
    replacement: '-'
  });
}

function generateMetadataAnnotations(api) {
  const info = api.info || {};
  const metadata = info['x-kubernetes-ingress-metadata'];

  if (metadata && metadata.annotations) {
    return metadata.annotations;
  }

  return null;
}

function generateRules(api, ingressName) {
  return (0, _common.getServers)(api).map((server, i) => {
    const {
      hostname
    } = (0, _common.parseUrl)(server.url);
    const serviceName = generateServiceName(server, ingressName, i);
    const servicePort = generateServicePort(server);
    const backend = {
      serviceName,
      servicePort
    };
    const path = generateServicePath(server, backend);
    const tlsConfig = generateTlsConfig(server);

    if (tlsConfig) {
      return {
        host: hostname,
        tls: _objectSpread({
          paths: [path]
        }, tlsConfig)
      };
    }

    return {
      host: hostname,
      http: {
        paths: [path]
      }
    };
  });
}

function generateServiceName(server, ingressName, index) {
  const backend = server['x-kubernetes-backend']; // x-kubernetes-backend.serviceName

  if (backend && backend['serviceName']) {
    return backend['serviceName'];
  } // x-kubernetes-service.metadata.name


  const service = server['x-kubernetes-service'];

  if (service && service.metadata && service.metadata.name) {
    return service.metadata.name;
  } // <ingress-name>-s<server index>


  return `${ingressName}-s${index}`;
}

function generateTlsConfig(server) {
  const tlsConfig = server['x-kubernetes-tls'];
  return tlsConfig || null;
}

function generateServicePort(server) {
  // x-kubernetes-backend.servicePort
  const backend = server['x-kubernetes-backend'];

  if (backend && typeof backend.servicePort === 'number') {
    return backend.servicePort;
  }

  const service = server['x-kubernetes-service'] || {};
  const spec = service.spec || {};
  const ports = spec.ports || []; // TLS configured

  const tlsConfig = generateTlsConfig(server);

  if (tlsConfig) {
    if (ports.find(p => p.port === 443)) {
      return 443;
    }

    if (ports[0] && ports[0].port) {
      return ports[0].port;
    }

    return 443;
  } // x-kubernetes-service.spec.ports.0.port


  if (ports[0] && ports[0].port) {
    return ports[0].port;
  }

  return 80;
}

function generateServicePath(server, backend) {
  const {
    pathname
  } = (0, _common.parseUrl)(server.url);
  const p = {
    backend
  };

  if (!pathname || pathname === '/') {
    return p;
  }

  if (pathname.match(/\/$/)) {
    p.path = pathname + '.*';
  } else {
    p.path = pathname + '/.*';
  }

  return p;
}

function generatePluginDocuments(api) {
  const plugins = [];

  for (const key of Object.keys(api)) {
    if (key.indexOf('x-kong-plugin-') !== 0) {
      continue;
    }

    const nameFromKey = key.replace('x-kong-plugin-', '');
    const pData = api[key];
    const p = {
      apiVersion: 'configuration.konghq.com/v1',
      kind: 'KongPlugin',
      metadata: {
        name: `add-${pData.name || nameFromKey}`
      },
      plugin: pData.name || key.replace('x-kong-plugin-', '')
    };

    if (pData.config) {
      p.config = pData.config;
    }

    plugins.push(p);
  } // NOTE: It isn't great that we're relying on declarative-config stuff here but there's
  // not much we can do about it. If we end up needing this again, it should be factored
  // out to a higher-level.


  const securityPlugins = (0, _securityPlugins.generateSecurityPlugins)(null, api).map(dcPlugin => {
    const k8sPlugin = {
      apiVersion: 'configuration.konghq.com/v1',
      kind: 'KongPlugin',
      metadata: {
        name: `add-${dcPlugin.name}`
      },
      plugin: dcPlugin.name
    };

    if (dcPlugin.config) {
      k8sPlugin.config = dcPlugin.config;
    }

    return k8sPlugin;
  });
  return [...plugins, ...securityPlugins];
}
},{"../common":"FoEN","../declarative-config/security-plugins":"TyOt"}],"Focm":[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.generate = generate;
exports.generateFromString = generateFromString;
exports.generateFromSpec = generateFromSpec;
exports.parseSpec = parseSpec;

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

var _declarativeConfig = require("./declarative-config");

var _kubernetes = require("./kubernetes");

var _swaggerParser = _interopRequireDefault(require("swagger-parser"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

async function generate(specPath, type, tags = []) {
  return new Promise((resolve, reject) => {
    _fs.default.readFile(_path.default.resolve(specPath), 'utf8', (err, contents) => {
      if (err != null) {
        reject(err);
        return;
      }

      const fileSlug = _path.default.basename(specPath);

      const allTags = [`OAS3file_${fileSlug}`, ...tags];
      resolve(generateFromString(contents, type, allTags));
    });
  });
}

async function generateFromString(specStr, type, tags = []) {
  const api = await parseSpec(specStr);
  return generateFromSpec(api, type, ['OAS3_import', ...tags]);
}

function generateFromSpec(api, type, tags = []) {
  switch (type) {
    case 'kong-declarative-config':
      return (0, _declarativeConfig.generateDeclarativeConfigFromSpec)(api, tags);

    case 'kong-for-kubernetes':
      return (0, _kubernetes.generateKongForKubernetesConfigFromSpec)(api, tags);

    default:
      throw new Error(`Unsupported output type "${type}"`);
  }
}

async function parseSpec(spec) {
  let api;

  if (typeof spec === 'string') {
    try {
      api = JSON.parse(spec);
    } catch (err) {
      api = _swaggerParser.default.YAML.parse(spec);
    }
  } else {
    api = JSON.parse(JSON.stringify(spec));
  } // Ensure it has some required properties to make parsing
  // a bit less strict


  if (!api.info) {
    api.info = {};
  }

  if (api.openapi === '3.0') {
    api.openapi = '3.0.0';
  }

  return _swaggerParser.default.dereference(api);
}
},{"./declarative-config":"aT9q","./kubernetes":"HEkA"}]},{},["Focm"], null)
//# sourceMappingURL=/index.js.map