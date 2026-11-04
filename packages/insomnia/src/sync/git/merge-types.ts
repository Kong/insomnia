import type { BaseModel } from 'insomnia-data';

export type ResolutionSource = 'choose' | 'manual';

export interface MergeConflict {
  name: string;
  key: string;
  message: string;
  mineBlob: string | null;
  mineBlobContent?: BaseModel | null;
  theirsBlob: string | null;
  theirsBlobContent?: BaseModel | null;
  suggestedMergeResult?: string;
  choose: string | null;
  mergeResult?: string;
  // Whether the resolved content came from picking a side or from a manual edit.
  resolutionSource?: ResolutionSource;
}

export interface AutoResolvedConflict {
  filepath: string;
  action: 'use-theirs' | 'delete';
}
