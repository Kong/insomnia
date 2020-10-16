# openapi-2-kong

This module generates Kong Declarative Config and Kong for Kubernetes config, from OpenAPI 3.0 specifications.

**Table of Contents**

- [Library Usage](#library-usage)
- [Kong Declarative Config](#kong-declarative-config)
    - [`$._format_version`](#_format_version)
    - [`$.services`](#services)
    - [`$.services[*].routes`](#servicesroutes)
    - [`$.upstreams`](#upstreams)
    - [`$..tags`](#tags)
- [Kong for Kubernetes](#kong-for-kubernetes)
    - [Output Structure](#output-structure)
    - [The `Ingress` document](#the-ingress-document)
        - [`$.metadata.name`](#metadataname)
        - [`$.metadata.annotations`](#metadataannotations)
    - [The `KongPlugin` and `KongIngress` resources](#the-kongplugin-and-kongingress-resources)
    - [Example](#example)
- [Plugins](#plugins)
    - [Security Plugins](#security-plugins)
    - [Generic Plugins](#generic-plugins)
    - [Request Validation Plugin](#request-validation-plugin)

## Library Usage

This module exposes three methods of generating Kong declarative config.

```flow js
type ConversionResultType = 'kong-declarative-config' | 'kong-for-kubernetes';

generateFromString (spec: string, type: ConversionResultType, tags: Array<string>) => Promise<Object>,
generateFromSpec (spec: Object, type: ConversionResultType, tags: Array<string>) => Promise<Object>,
generate (filename: string, type: ConversionResultType, tags: Array<string>) => Promise<Object>,
```

### Usage Example

```js
const o2k = require('openapi-2-kong');

const spec = `
openapi: "3.0.0"
info:
  version: 1.0.0
  title: Swagger Petstore
servers:
  - url: http://petstore.swagger.io/v1
paths:
  /pets:
    get:
      summary: Get all pets
`;

async function examples() {
  const tags = [ 'MyTag' ];
  const type = 'kong-declarative-config'; // or 'kong-for-kubernetes'

  // Generate a config from YAML string
  const config1 = await o2k.generateFromString(spec, type, tags);

  // Generate a config from a JS object
  const specObject = require('yaml').parse(spec);
  const config2 = await o2k.generateFromSpec(specObject, type, tags);

  // Generate a config from a JSON string
  const specJSON = JSON.stringify(specObject);
  const config3 = await o2k.generateFromString(specJSON, type, tags);

  // generate a config from a file path
  require('fs').writeFileSync('/tmp/spec.yaml', spec);
  const config4 = await o2k.generate('/tmp/spec.yaml', type, tags);

  console.log('Generated:', { config1, config2, config3, config4 });
}
```

## Kong Declarative Config

The following documents the behavior for generating Kong Declarative Config from OpenAPI v3.

### `$._format_version`

This attribute is hardcoded to `1.1` since that is currently the only version.

### `$.services`

Kong services objects are generated mostly from the root `servers` property.

```yaml
servers:
  - url: http://petstore.swagger.io/v1
```

```yaml
services:
  - host: swagger.io           # Subdomain stripped and added will prefix upstreams
    port: 80                   # Port inferred from protocol if not specified
    path: "\/"                 # The /v1 was stripped off and will prefix all routes
    protocol: http             # Extracted from URL or defaulted to http
    name: Simple_API_overview  # Taken from info.title or `x-kong-name`
    routes: []                 # <documented later>
    tags: []                   # <documented later>
```

Or, if variables are used, their default values will be substituted. The following example will
produce the same result

```yaml
servers:
  - url: https://{subdomain}.swagger.io/v1
    variables:
      subdomain:
        default: petstore
        enum:
          - petstore
          - shoestore
```

The service name is set to the following

1. Root `x-kong-name` attribute
1. Generated slug from `info.title`
1. Default to `openapi` as a last resort

### `$.services[*].routes`

Service routes are generated from the root `paths` property. One service route per path/method
combination will be generated.

```yaml
paths:
  /pets/{id}:
    x-kong-name: create-pet
    put:
      summary: List all pets
      tags: [ Tag ]
      responses: [ ... ]
    get:
      tags: [ Tag ]
      responses: [ ... ]
```

```yaml
services:
  - ...
    routes:
      - name: ApiName-create-pet         # Taken from x-kong-name, summary, or generated
        strip_path: true                 # Always `true`
        methods: [ PUT ]                 # Only ever a single-entry array
        paths: [ '\/pets/(?<id>\S+)$' ]  # Kong regex-formatted path with variables
        tags: [ Tag ]                    # <documented later>
```

Route names are constructed from the template `<APIName>-<PathName>-<Method>`.

- `APIName`: Name taken from the global API object, prefixed to ensure uniqueness across services
- `Method`: Route's HTTP method
- `PathName`: Pulled from `x-kong-name`, `summary`, or generated with `path_<n>`

### `$.upstreams`

Upstreams or similarly generated from the `servers` root property.

```yaml
servers:
  - url: http://petstore.swagger.io/v1
  - url: https://swagger.io/v1
```

```yaml
upstreams:
  - name: Simple_API_overview           # Name taken from info.title or `x-kong-name`
    targets:                            #
      - target: petstore.swagger.io:80  # Derived from first server entry
      - target: swagger.io:443          # Derived from second server entry
    tags: []                            # <documented later>
```

Upstream name will be the same as the service name.

### `$..tags`

Each generated entity will get the tags as specified as well as the following tags:

- `OAS3_import`
- `OAS3file_<filename>`

Tags can also be passed to this tool, which will be appended to the existing tags of
all created resources.

## Kong for Kubernetes

### Output structure
The Kong for Kubernetes config will contain at least one `Ingress` document per server. Depending on where
Kong plugins (`x-kong-plugin-<plugin-name>`) exist in the specification, several `Ingress` documents may be created, in addition to
`KongPlugin` and `KongIngress` documents.

`KongPlugin` and `KongIngress` resource documents can be reused, and are applied to the specs in an `Ingress` document
via metadata annotations.

### The `Ingress` document
**At least** one `Ingress` document will be generated for each server. How many are required for each server, will be
determined by the presence of `KongPlugin` and `KongIngress` resources that need to be applied to specific paths.

<details>
<summary>Example</summary>

#### Source spec

```yaml
openapi: 3.0.0
info:
  title: Insomnia API
servers:
  - url: http://one.insomnia.rest/v1
  - url: http://two.insomnia.rest/v2
paths:
```

#### Generated config

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: insomnia-api-1
  annotations:
    kubernetes.io/ingress.class: "kong"
spec:
  rules:
    - host: one.insomnia.rest
      http:
        paths:
          - path: /v1/.*
            backend:
              serviceName: insomnia-api-service-0
              servicePort: 80
---
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: insomnia-api-2
  annotations:
    kubernetes.io/ingress.class: "kong"
spec:
  rules:
    - host: two.insomnia.rest
      http:
        paths:
          - path: /v2/.*
            backend:
              serviceName: insomnia-api-service-1
              servicePort: 80
```
</details>

#### `$.metadata.name`

The `Ingress` document `metadata.name` is derived from sections in the source specification. If several are present, then the highest priority is selected. If none are present, then the fallback name is `openapi`.
The name is also converted to a lowercase slug.

Each of the following specifications generate an `Ingress` document with the following name:
```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: insomnia-api
...
```

In priority order, these sections are:

- `$.info.x-kubernetes-ingress-metadata.name`

  ```yaml
  openapi: 3.0.0
  info:
    x-kubernetes-ingress-metadata:
      name: Insomnia API
  ...
  ```

- `$.x-kong-name`

  ```yaml
  openapi: 3.0.0
  x-kong-name: Insomnia API
  ...
  ```

- `$.info.title`

  ```yaml
  openapi: 3.0.0
  info:
    title: Insomnia API
  ...
  ```

#### `$.metadata.annotations`

Annotations can be used to configure an Ingress document. This configuration applies to that entire Ingress document.

1. Any annotations that exist under `$.info.x-kubernetes-ingress-metadata.annotations` in the source specification are added automatically
2. `KongPlugin` and `KongIngress` resources may be generated. These are added to the Ingress document as:
    - `konghq.com/plugins` references multiple `KongPlugin` resources via a comma separated string containing resource names
    - `konghq.com/override` references single `KongIngress` resource via the resource name

### The `KongPlugin` and `KongIngress` resources
If plugins are found in the OpenAPI spec (see [Plugins](#plugins)), then they are converted to `KongPlugin` resources
by the Kong for Kubernetes config generator, before being applied to the `Ingress` document via [metadata annotations](#metadataannotations).

If a plugin is found on an `operation` object in a path in the OpenAPI spec, then an additional `KongIngress` resource is generated,
that refers to the operation (`GET`, `POST`, etc).

### Example

This example combines all of the information in the previous sections. The input specification contains:
- `x-kubernetes-ingress-metadata` to provide a document name and default annotations
- a global plugin at the OpenAPI spec level
- two servers, with s1 containing a plugin
- two paths with one operation
    - no plugins on the first path and operation
    - no plugin on the second path, but one on the operation

<details>
<Summary>Input OpenAPI specification</Summary>

```yaml
openapi: 3.0.0
info:
  x-kubernetes-ingress-metadata:
    name: insomnia-api                          # Kubernetes Ingress document name
    annotations:                                # Annotations to automatically apply
      'example': 'example'
x-kong-plugin-custom-global:                    # Global plugin to always be applied
  name: custom-global
  enabled: true
  config:
    key_in_body: false
servers:
  - url: http://one.insomnia.rest/v1
  - url: http://two.insomnia.rest/v2
    x-kong-plugin-custom-server:                # Server plugin to be applied to documents for this server
      name: custom-server
      enabled: true
paths:
  '/path':
    post:
      summary: Some functionality               # A path with no plugins on the path or operations in it
  '/another-path':
    get:
      summary: Some functionality
      x-kong-plugin-key-auth:                   # Operation plugin on GET /another-path
        name: key-auth
        enabled: true
        config:
          key_names: [api_key, apikey]
          key_in_body: false
          hide_credentials: true
```
</details>

The resultant spec creates:
- four unique `Ingress` documents (two servers, two paths, one operation each),
- three `KongPlugin` documents (global, server, operation plugin),
- one `KongIngress` document (GET operation containing plugin)

<details>
<Summary>Output Kong for Kubernetes config</Summary>

```yaml
apiVersion: configuration.konghq.com/v1
kind: KongIngress
metadata:
  name: get-method                              # KongIngress due to GET /another-path containing a plugin
route:
  methods:
    - get
---
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: add-custom-global-g0                    # KongPlugin due to plugin at OpenAPI object level
plugin: custom-global
config:
  key_in_body: false
---
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: add-custom-server-s1                    # KongPlugin due to plugin on the second server
plugin: custom-server
---
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: add-key-auth-m2                         # KongPlugin due to plugin on GET /another-path
plugin: key-auth
config:
  key_names:
    - api_key
    - apikey
  key_in_body: false
  hide_credentials: true
---
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: insomnia-api-0
  annotations:
    kubernetes.io/ingress.class: "kong"
    example: example                            # annotation from x-kong-ingress-metadata
    konghq.com/plugins: add-custom-global-g0    # only global plugin
spec:
  rules:
    - host: one.insomnia.rest
      http:
        paths:
          - path: /v1/path
            backend:
              serviceName: insomnia-api-service-0
              servicePort: 80
---
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: insomnia-api-1
  annotations:
    kubernetes.io/ingress.class: "kong"
    example: example
    konghq.com/plugins: add-custom-global-g0, add-key-auth-m2   # global and operation plugin, no server or path
    konghq.com/override: get-method             # restrict document to be for specified operation (due to plugin)
spec:
  rules:
    - host: one.insomnia.rest
      http:
        paths:
          - path: /v1/another
            backend:
              serviceName: insomnia-api-service-0
              servicePort: 80
---
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: insomnia-api-2
  annotations:
    kubernetes.io/ingress.class: "kong"
    example: example
    konghq.com/plugins: add-custom-global-g0, add-custom-server-s1    # global and server 1 plugin, no path or operation
spec:
  rules:
    - host: two.insomnia.rest
      http:
        paths:
          - path: /v2/path
            backend:
              serviceName: insomnia-api-service-1
              servicePort: 80
---
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: insomnia-api-3
  annotations:
    kubernetes.io/ingress.class: "kong"
    example: example
    konghq.com/plugins: add-custom-global-g0, add-custom-server-s1, add-key-auth-m2   # global, server 1, and operation plugin, no path
    konghq.com/override: get-method             # restrict document to be for specified operation (due to plugin)
spec:
  rules:
    - host: two.insomnia.rest
      http:
        paths:
          - path: /v2/another
            backend:
              serviceName: insomnia-api-service-1
              servicePort: 80
```
</details>

# Plugins
## Security Plugins

The `security` property can be defined on the top-level `openapi` object as well
as on `operation` objects. The information contained cannot be directly mapped
onto Kong, due to the logical and/or nature of how the specs have been set up.

To overcome this Kong will only accept a single `securityScheme` from the `security`
property.

The additional properties that Kong supports on its plugins can be configured
by using custom extensions. The custom extensions are
`x-kong-security-<plugin-name>`.

Supported types are:

- `oauth2`
    - NOT YET IMPLEMENTED!
    - except for the implicit flow
    - implemented using the Kong plugin `openid-connect`
    - extended by: `x-kong-security-openid-connect`
- `openIdConnect`
    - implemented using the Kong plugin `openid-connect`
    - extended by: `x-kong-security-openid-connect`
    - properties set from OpenAPI spec:
        - `issuer` (from `openIdConnectUrl` property)
        - `scopes_required` will get the combined set of scopes from the
          extension defaults and the scopes from the Security Requirement
          Object
- `apiKey`
    - except for the `in` property, since the Kong plugin will by default
      look in header and query already. Cookie is not supported.
    - implemented using the Kong plugin `key-auth`
    - extended by: `x-kong-security-key-auth`
    - properties set from OpenAPI spec:
        - `key_names` will get the defaults from the extension and then the
          `name` from the `securityScheme` object will be added to that list
    - requires to add credentials to Kong, which is not supported through
      OpenAPI specs.
- `http`
    - only `Basic` scheme is supported
    - implemented using the Kong plugin `basic-auth`
    - extended by: `x-kong-security-basic-auth`
    - properties set from OpenAPI spec:
        - none
    - requires to add credentials to Kong, which is not supported through
      OpenAPI specs.

## Generic Plugins

Generic plugins can be added on various objects in the OpenAPI spec. The custom extension to
use is `x-kong-plugin-<plugin-name>`. The `name` property is not required
(since it's already in the extension name). Optional properties not specified
will get Kong defaults.

Currently, plugins are supported on the following OpenAPI objects by each generator:
- Declarative Config: `OpenAPI root`, `operation`
- Kong for Kubernetes: `OpenAPI root`, `server`, `path`, `operation`

If the _same_ plugin exists in several sections, then the more specific section will take precedence. These sections are:
1. `operation` (most specific)
1. `path`
1. `server`
1. `OpenAPI` object (least specific)

This extension needs to hold an object that contains the entire plugin
config.

```yaml
x-kong-plugin-key-auth:
  name: key-auth
  enabled: true
  config:
    key_names: [api_key, apikey]
    key_in_body: false
    hide_credentials: true
```

References are also supported, so this is valid as well (provided the
reference exists):

```yaml
x-kong-plugin-key-auth:
  $ref: '#/components/kong/plugins/key_auth_config'
```

## Request Validation Plugin

To enable validation the `request-validation` plugin must be added to an
`operation` object. You can either specify the full configuration, or have it
be auto-generated based on the OpenAPI spec.

To enable auto generation, add the plugin, but do not include the `config`
property. The `config` property will then be auto-generated and added to
the generated spec.

```yaml
paths:
  /:
    post:
      parameters:
        - in: path
          name: query
          required: true
          schema:
            anyOf:
              - type: string
      x-kong-plugin-request-validator:
        enabled: true
```
