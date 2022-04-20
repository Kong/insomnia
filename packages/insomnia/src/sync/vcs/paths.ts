
export function projects() {
  return '/projects/';
}

export function projectBase(projectId: string) {
  return `${projects()}${projectId}/`;
}

export function head(projectId: string) {
  return `${projectBase(projectId)}head.json`;
}

export function project(projectId: string) {
  return `${projectBase(projectId)}meta.json`;
}

export function blobs(projectId: string) {
  return `${projectBase(projectId)}blobs/`;
}

export function blob(projectId: string, blobId: string) {
  const subPath = `${blobId.slice(0, 2)}/${blobId.slice(2)}`;
  return `${blobs(projectId)}${subPath}`;
}

export function snapshots(projectId: string) {
  return `${projectBase(projectId)}snapshots/`;
}

export function snapshot(projectId: string, snapshotId: string) {
  return `${snapshots(projectId)}${snapshotId}.json`;
}

export function branches(projectId: string) {
  return `${projectBase(projectId)}branches/`;
}

export function branch(projectId: string, branchName: string) {
  return `${branches(projectId)}${branchName}.json`;
}
