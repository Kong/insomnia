// @flow

export function projects(): string {
  return '/projects/';
}

export function projectBase(projectId: string): string {
  return `${projects()}${projectId}/`;
}

export function head(projectId: string): string {
  return `${projectBase(projectId)}head.json`;
}

export function project(projectId: string): string {
  return `${projectBase(projectId)}meta.json`;
}

export function blobs(projectId: string): string {
  return `${projectBase(projectId)}blobs/`;
}

export function blob(projectId: string, blobId: string): string {
  const subPath = `${blobId.slice(0, 2)}/${blobId.slice(2)}`;
  return `${blobs(projectId)}${subPath}`;
}

export function snapshots(projectId: string): string {
  return `${projectBase(projectId)}snapshots/`;
}

export function snapshot(projectId: string, snapshotId: string): string {
  return `${snapshots(projectId)}${snapshotId}.json`;
}

export function branches(projectId: string): string {
  return `${projectBase(projectId)}branches/`;
}

export function branch(projectId: string, branchName: string): string {
  return `${branches(projectId)}${branchName}.json`;
}
