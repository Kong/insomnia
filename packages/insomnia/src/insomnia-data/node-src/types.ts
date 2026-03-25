// Keep the Services type tied to the real implementation without introducing a runtime import.
import type { servicesNodeImpl } from './services';

export type Services = typeof servicesNodeImpl;
