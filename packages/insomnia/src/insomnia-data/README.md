# insomnia-data

A runtime-agnostic data layer for Insomnia, based on interface + IoC.

## Core idea

- `src/`: runtime-agnostic contracts (`IDatabase`, `Services`, model metadata/types)
- `node-src/`: Node/main concrete implementations (`createNedbDatabase`, `servicesNodeImpl`)
- entry points wire once:
  - `initDatabase(impl)`
  - `initServices(impl)`

After wiring, business code always uses the same APIs: `database`, `services`, `models`.

## Process flows

### Database (main / renderer / inso)

```mermaid
flowchart LR
    subgraph Renderer
        R0[initDatabase] --> R1[clientDatabase implementation]
        R2[feature code] --> R3[database from insomnia-data]
        R3 --> R1
        R1 --> R4[window.database.invoke]
        R4 --> R5[ipcRenderer.invoke database.invoke]
    end

    subgraph Main
        M0[initDatabase] --> M1[mainDatabase implementation]
        M1 --> M2[createNedbDatabase impl]
        M2 --> M3[(NeDB)]
        M4[main feature code] --> M5[database from insomnia-data]
        M5 --> M1
        M6[ipcMain.handle database.invoke] --> M1
        M1 --> M7[webContents.send db.changes]
    end

    subgraph Inso
        I0[initDatabase] --> I1[inso database implementation]
        I1 --> I2[createNedbDatabase impl]
        I2 --> I3[(NeDB)]
        I4[inso feature code] --> I5[database from insomnia-data]
        I5 --> I1
    end

    R5 --> M6
    M7 -.notify.-> R2
```

### Services (main / renderer / inso)

```mermaid
flowchart LR
    subgraph Renderer
        R0[initServices] --> R1[preload servicesProxy implementation]
        R2[feature code] --> R3[services from insomnia-data]
        R3 --> R1
        R1 --> R4[ipcRenderer.invoke services.invoke]
    end

    subgraph Main
        M0[initServices] --> M1[servicesNodeImpl]
        M2[feature code] --> M3[services from insomnia-data]
        M3 --> M1
        M1 --> M4[service logic]
        M4 --> M5[database]
        M5 --> M6[(NeDB)]
        M7[ipcMain.handle services.invoke] --> M1
    end

    subgraph Inso
        I0[initServices] --> I1[servicesNodeImpl]
        I2[feature code] --> I3[services from insomnia-data]
        I3 --> I1
        I1 --> I6[(NeDB)]
    end

    R4 --> M7
```

Renderer services path:

`services.xxx` -> preload proxy -> IPC -> main handler -> `servicesNodeImpl` -> database.

## Why this design

- Same API across runtimes: main, renderer, inso.
- Feature code is decoupled from Electron/IPC/NeDB details.
- Renderer has a safer boundary (bridge + IPC, no direct DB internals and node API access).
- Easy to test or swap implementations by injecting at startup.

## Minimal usage

### Main

```ts
import { initDatabase, initServices } from '~/insomnia-data';
import { mainDatabase } from '~/main/database.main';
import { servicesNodeImpl } from '~/insomnia-data/node';

await initDatabase(mainDatabase);
initServices(servicesNodeImpl);
```

### Renderer

```ts
import { initDatabase, initServices } from '~/insomnia-data';
import { clientDatabase } from '~/ui/database.client';

await initDatabase(clientDatabase);
initServices(window._dataServices);
```

### Inso / Node

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
