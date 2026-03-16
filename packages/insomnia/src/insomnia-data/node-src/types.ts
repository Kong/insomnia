// This file is used to infer the types from the actual implementation, so that we can export the types without having to maintain them separately.
import { type servicesNodeImpl } from './services';

export type Services = typeof servicesNodeImpl;
