# Insomnia Storage

This package contains the storage functionality and types for the Insomnia application which could be shared across insomnia and inso-cli.

## Usage

### Install

Uses npm workspace, so no need to install.

### Import

```ts
// For all runtimes
import { type Database } from 'insomnia-storage';

// For Node.js runtimes
import { NeDBClient } from 'insomnia-storage/node';
```
