# insomnia-data

A runtime-agnostic data layer for Insomnia, following an **IoC (Inversion of Control)** pattern to decouple interface definitions from their concrete implementations.

## Architecture

```txt
insomnia-data/
├── src/              # Runtime-agnostic (renderer, main and inso)
│   ├── database/     # Database interface and query types
│   ├── models/       # Model types, static configurations, type guards, and init functions
│   └── services/     # Service interfaces and IoC container
└── node-src/         # Node.js / main-process only
    ├── database/     # NeDB-backed Database implementation
    └── services/     # Concrete service implementations
```

### Entry points

| Import path            | Contents                                                    |
| ---------------------- | ----------------------------------------------------------- |
| `~/insomnia-data`      | Runtime-agnostic interfaces, model types, IoC containers    |
| `~/insomnia-data/node` | Node.js implementations (NeDB database + concrete services) |

## Usage

### Initialization (process entry points)

```ts
import { initDatabase, initServices } from '~/insomnia-data';
import { createNedbDatabase, servicesNodeImpl } from '~/insomnia-data/node';

await initDatabase(createNedbDatabase());
initServices(servicesNodeImpl);
```

### Consuming

```ts
import { services, models, type Request } from '~/insomnia-data';

const mcpRequest = await services.mcpRequest.create({ url: 'http://localhost:3000' });
const all = await services.mcpRequest.all();

const request: Request = {};

const requestType = models.request.type;
```
