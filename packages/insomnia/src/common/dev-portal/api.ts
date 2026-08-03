export type APISpecType = 'oas3' | 'oas2' | 'asyncapi';
export type APIVisibilityType = 'public' | 'private';
import { fetch } from 'insomnia-api';

export interface PaginationInformation {
  number: number;
  size: number;
  total: number;
}

export interface DevPortalAPIData {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  version: string | null;
  description: string | null;
  slug: string;
  visibility: APIVisibilityType;
  current_version_summary: {
    id: string;
    spec: {
      type: APISpecType;
    };
  } | null;
}

export function listDevPortalAPIs() {}

export function listDevPortalAPISpecVersions() {}

export function getAPISpec() {}
