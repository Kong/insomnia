import { fetch } from './fetch';

export type APISpecType = 'oas3' | 'oas2' | 'asyncapi';
export type APIVisibilityType = 'public' | 'private';

export interface PaginationInformation {
  number: number;
  size: number;
  total: number;
}

const getBearerAuthHeader = (accessToken: string) => ({
  authorization: `Bearer ${accessToken}`,
});

export interface DevPortalAPIData {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  version: string;
  description: string;
  slug: string;
  visibility: APIVisibilityType;
  current_version_summary: {
    id: string;
    spec: {
      type: APISpecType;
    };
  } | null;
}

export interface DevPortalAPISpecVersionData {
  version: string;
  spec: {
    type: APISpecType;
  };
  id: string;
}

export interface DevPortalAPISpecData {
  spec: {
    content: string;
    type: APISpecType;
  };
  version: string;
  id: string;
}

const DEFAULT_PAGE_SIZE = 100;

export async function listDevPortalAPIs({
  devPortalUrl,
  accessToken,
}: {
  devPortalUrl: string;
  accessToken: string;
}): Promise<DevPortalAPIData[]> {
  const devPortalAPIs: DevPortalAPIData[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const path = `/api/v3/apis?page[number]=${page}&page[size]=${DEFAULT_PAGE_SIZE}`;
    // try {
    const response = await fetch<{ data: DevPortalAPIData[]; meta: { page: PaginationInformation } }>({
      method: 'GET',
      origin: devPortalUrl,
      path,
      headers: {
        ...getBearerAuthHeader(accessToken),
      },
    });
    const { data, meta } = response;
    devPortalAPIs.push(...data);
    if (page === 1) {
      const totalItems = meta.page.total;
      totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / DEFAULT_PAGE_SIZE);
    }
    page++;
  }
  return devPortalAPIs;
}

export async function listDevPortalAPISpecVersions({
  devPortalUrl,
  accessToken,
  apiIdOrSlug,
}: {
  devPortalUrl: string;
  accessToken: string;
  apiIdOrSlug: string;
}): Promise<DevPortalAPISpecVersionData[]> {
  const devPortalAPISpecVersions: DevPortalAPISpecVersionData[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const path = `/api/v3/apis/${apiIdOrSlug}/versions?page[number]=${page}&page[size]=${DEFAULT_PAGE_SIZE}`;
    const response = await fetch<{ data: DevPortalAPISpecVersionData[]; meta: { page: PaginationInformation } }>({
      method: 'GET',
      origin: devPortalUrl,
      path,
      headers: {
        ...getBearerAuthHeader(accessToken),
      },
    });
    const { data, meta } = response;
    devPortalAPISpecVersions.push(...data);
    if (page === 1) {
      // Calculate total pages only on the first page to avoid unnecessary calculations on subsequent pages
      const totalItems = meta.page.total;
      totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / DEFAULT_PAGE_SIZE);
    }
    page++;
  }
  return devPortalAPISpecVersions;
}

export async function getAPISpecByVersion(
  devPortalUrl: string,
  accessToken: string,
  apiIdOrSlug: string,
  specVersionId: string,
) {
  const path = `/api/v3/apis/${apiIdOrSlug}/versions/${specVersionId}`;
  const response = await fetch<DevPortalAPISpecData>({
    method: 'GET',
    origin: devPortalUrl,
    path,
    headers: {
      ...getBearerAuthHeader(accessToken),
    },
  });
  return response;
}

export async function getPortalContext(devPortalUrl: string) {
  const path = `/api/v3/context`;
  const response = await fetch({
    method: 'GET',
    origin: devPortalUrl,
    path,
  });
  return response;
}
