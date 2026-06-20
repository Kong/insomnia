import { PREVIEW_MODE_FRIENDLY, type PreviewMode } from 'insomnia-data/common';

import type { BaseModel } from './base-types';

export const name = 'Request Meta';
export const type = 'RequestMeta';
export const prefix = 'reqm';
export const canDuplicate = false;
export const canSync = false;

export type RequestAccordionKeys = 'OAuth2AdvancedOptions';

/** The request-pane sub-tabs whose selection is persisted per request. */
export type RequestPaneTab = 'params' | 'content-type' | 'auth' | 'headers' | 'scripts' | 'docs';

export interface BaseRequestMeta {
  parentId: string;
  previewMode: PreviewMode;
  responseFilter: string;
  responseFilterHistory: string[];
  activeResponseId: string | null;
  /** Selected request-pane sub-tab, restored when the request is reopened. */
  activeRequestPaneTab: RequestPaneTab;
  savedRequestBody: Record<string, any>;
  pinned: boolean;
  lastActive: number;
  downloadPath: string | null;
  expandedAccordionKeys: Partial<Record<RequestAccordionKeys, boolean>>;
  activeMcpPrimitive?: string | null;
}

export type RequestMeta = BaseModel & BaseRequestMeta;

export const isRequestMeta = (model: Pick<BaseModel, 'type'>): model is RequestMeta => model.type === type;

export function init() {
  return {
    parentId: null,
    previewMode: PREVIEW_MODE_FRIENDLY,
    responseFilter: '',
    responseFilterHistory: [],
    activeResponseId: null,
    activeRequestPaneTab: 'params',
    savedRequestBody: {},
    pinned: false,
    lastActive: 0,
    downloadPath: null,
    expandedAccordionKeys: {},
    activeMcpPrimitive: null,
  };
}
