// @flow
import * as models from '../../../../models';
import ingestProtoDirectory from '../ingest-proto-directory';
import path from 'path';
import { globalBeforeEach } from '../../../../__jest__/before-each';

describe('ingestProtoDirectory', () => {
  beforeEach(globalBeforeEach);

  it.each(['does-not-exist', 'empty', 'resources'])(
    'should return null if loading directory __fixtures__/%s',
    async dir => {
      // Arrange
      const w = await models.workspace.create();
      const dirToIngest = path.join(__dirname, '../../__fixtures__', 'library', dir);

      // Act
      const result = await ingestProtoDirectory(dirToIngest, w._id);

      // Assert
      expect(result).toStrictEqual({ createdDir: null, createdIds: [], error: null });
      expect(models.protoDirectory.all()).resolves.toHaveLength(0);
      expect(models.protoFile.all()).resolves.toHaveLength(0);
    },
  );

  it('should read all proto files in nested directories', async () => {
    // Arrange
    const w = await models.workspace.create();
    const dirToIngest = path.join(__dirname, '../../__fixtures__', 'library');

    // Act
    const result = await ingestProtoDirectory(dirToIngest, w._id);

    // Assert
    expect(result.createdDir).toStrictEqual(
      expect.objectContaining({ name: 'library', parentId: w._id }),
    );
    expect(result.createdIds).toHaveLength(6);
    expect(result.error).toBeNull();
    expect(models.protoDirectory.all()).resolves.toHaveLength(3);
    expect(models.protoFile.all()).resolves.toHaveLength(3);

    // Ensure ingested tree structure is correct
    const libraryFolder = await models.protoDirectory.getByParentId(w._id);
    expect(libraryFolder.name).toBe('library');

    const protos = await models.protoFile.findByParentId(libraryFolder._id);
    expect(protos).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'hello.proto' }),
        expect.objectContaining({ name: 'root.proto' }),
      ]),
    );

    const nestedFolder = await models.protoDirectory.getByParentId(libraryFolder._id);
    expect(nestedFolder.name).toBe('nested');

    const timeFolder = await models.protoDirectory.getByParentId(nestedFolder._id);
    expect(timeFolder.name).toBe('time');

    const timeProto = await models.protoFile.getByParentId(timeFolder._id);
    expect(timeProto.name).toBe('time.proto');
  });
});
