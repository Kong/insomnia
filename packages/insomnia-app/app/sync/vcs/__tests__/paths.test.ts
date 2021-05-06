import * as paths from '../paths';

describe('paths', () => {
  it('successes', async () => {
    expect(paths.projectBase('p1')).toBe('/projects/p1/');
    expect(paths.head('p1')).toBe('/projects/p1/head.json');
    expect(paths.project('p1')).toBe('/projects/p1/meta.json');
    expect(paths.blobs('p1')).toBe('/projects/p1/blobs/');
    expect(paths.blob('p1', 'b1c1c2')).toBe('/projects/p1/blobs/b1/c1c2');
    expect(paths.snapshots('p1')).toBe('/projects/p1/snapshots/');
    expect(paths.snapshot('p1', 's1')).toBe('/projects/p1/snapshots/s1.json');
    expect(paths.branches('p1')).toBe('/projects/p1/branches/');
    expect(paths.branch('p1', 'master')).toBe('/projects/p1/branches/master.json');
  });
});
