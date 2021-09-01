import path from 'path';
import insomniaAdapter from './insomnia-adapter';

describe('insomniaAdapter()', () => {
  const fixturesPath = 'src/db/fixtures';

  it('should seed with data file (JSON)', async () => {
    const pathname = path.join(fixturesPath, 'insomnia-v4', 'insomnia_v4.json');
    const db = await insomniaAdapter(pathname);

    expect(db?.ApiSpec.length).toBe(1);
    expect(db?.Environment.length).toBe(2);
    expect(db?.Request.length).toBe(13);
    expect(db?.RequestGroup.length).toBe(1);
    expect(db?.Workspace.length).toBe(1);
    expect(db?.UnitTestSuite.length).toBe(1);
    expect(db?.UnitTest.length).toBe(2);
  });

  it('should seed with data file and its filters (JSON)', async () => {
    const pathname = path.join(fixturesPath, 'insomnia-v4', 'insomnia_v4.json');
    const db = await insomniaAdapter(pathname, ['Environment']);

    expect(db?.ApiSpec.length).toBe(0);
    expect(db?.Environment.length).toBe(2);
    expect(db?.Request.length).toBe(0);
    expect(db?.RequestGroup.length).toBe(0);
    expect(db?.Workspace.length).toBe(0);
    expect(db?.UnitTestSuite.length).toBe(0);
    expect(db?.UnitTest.length).toBe(0);
  });

  it('should seed with data file (YAML)', async () => {
    const pathname = path.join(fixturesPath, 'insomnia-v4', 'insomnia_v4.yaml');
    const db = await insomniaAdapter(pathname);

    expect(db?.ApiSpec.length).toBe(1);
    expect(db?.Environment.length).toBe(2);
    expect(db?.Request.length).toBe(13);
    expect(db?.RequestGroup.length).toBe(1);
    expect(db?.Workspace.length).toBe(1);
    expect(db?.UnitTestSuite.length).toBe(1);
    expect(db?.UnitTest.length).toBe(2);
  });

  it('should seed with data file and its filters (YAML)', async () => {
    const pathname = path.join(fixturesPath, 'insomnia-v4', 'insomnia_v4.yaml');
    const db = await insomniaAdapter(pathname, ['Environment']);

    expect(db?.ApiSpec.length).toBe(0);
    expect(db?.Environment.length).toBe(2);
    expect(db?.Request.length).toBe(0);
    expect(db?.RequestGroup.length).toBe(0);
    expect(db?.Workspace.length).toBe(0);
    expect(db?.UnitTestSuite.length).toBe(0);
    expect(db?.UnitTest.length).toBe(0);
  });

  it('should return null if pathname is invalid', async () => {
    const pathname = path.join(fixturesPath, 'insomnia-v4', 'insomnia');
    const db = await insomniaAdapter(pathname);
    expect(db).toBe(null);
  });
});
