// Type-only companion for `types.ts`.
// TypeScript reads this declaration file for the real `Services` shape, so we can keep
// inferring the type from `servicesNodeImpl` without exposing `./services` to the runtime graph.
import { type servicesNodeImpl } from './services';

export type Services = typeof servicesNodeImpl;
