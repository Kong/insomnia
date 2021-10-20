import fs from 'fs';
import path from 'path';

export const getFixtureContent = async (fixturePath: string) => {
  const buffer = await fs.promises.readFile(path.join(__dirname, '..', 'fixtures', fixturePath));

  const fixtureContent = buffer.toString('utf-8');

  return fixtureContent;
};
