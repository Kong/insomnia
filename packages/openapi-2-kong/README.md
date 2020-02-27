# openapi-2-kong

This module generates Kong Declarative Config from OpenAPI 3.0 specification files.

**Table of Contents**

- [Library Usage](#library-usage)
- [Behavior](#behavior)
    - [`$._format_version`](#_format_version)
    - [`$.services`](#services)
    - [`$.services[*].routes`](#servicesroutes)
    - [`$.upstreams`](#upstreams)
    - [`$..tags`](#tags)
- [Security Plugins](#security-plugins)
- [Generic Plugins](#generic-plugins)
- [Request Validation Plugin](#request-validation-plugin)

## Library Usage

This module exposes three methods of generating Kong declarative config.

```js
generateFromString (spec: string, tags: Array<string>) => Promise<Object>,
generateFromSpec (spec: Object, tags: Array<string>) => Promise<Object>,
generate (filename: string, tags: Array<string>) => Promise<Object>,
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
  // Generate a config from YAML string
  const config1 = await o2k.generateFromString(spec, [ 'MyTag' ]);

  // Generate a config from a JS object
  const specObject = require('yaml').parse(spec);
  const config2 = await o2k.generateFromSpec(specObject, [ 'MyTag' ]);

  // Generate a config from a JSON string
  const specJSON = JSON.stringify(specObject);
  const config3 = await o2k.generateFromString(specJSON, [ 'MyTag' ]);

  // generate a config from a file path
  require('fs').writeFileSync('/tmp/spec.yaml', spec);
  const config4 = await o2k.generate('/tmp/spec.yaml', [ 'MyTag' ]);

  console.log('Generated:', { config1, config2, config3, config4 });
}
```

## Behavior

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

Generic plugins can be added on an `operation` object. The custom extension to
use is `x-kong-plugin-<plugin-name>`. The `name` property is not required
(since it's already in the extension name). Optional properties not specified
will get Kong defaults.

Plugins can also be added on the `OpenAPI` object level, in which case they
will be applied to every `Operation` in the spec. If a plugin is specified on
both, the `Operation` level one will take precedence.

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

