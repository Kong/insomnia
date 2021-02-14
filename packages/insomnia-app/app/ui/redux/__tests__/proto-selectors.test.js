// @flow

import { globalBeforeEach } from '../../../__jest__/before-each';
import { selectExpandedActiveProtoDirectories } from '../proto-selectors';
import * as models from '../../../models';
import reduxStateForTest from '../../../__jest__/redux-state-for-test';

describe('selectExpandedActiveProtoDirectories', () => {
  beforeEach(globalBeforeEach);

  it('should return empty array if no proto files or directories exist', async () => {
    // Arrange
    const w = await models.workspace.create();

    // Act
    const state = await reduxStateForTest(w._id);
    const expandedDirs = selectExpandedActiveProtoDirectories(state);

    // Assert
    expect(expandedDirs).toHaveLength(0);
  });

  it('should return empty array if active workspace is empty', async () => {
    // Arrange workspace
    const w1 = await models.workspace.create();
    const pd1 = await models.protoDirectory.create({ parentId: w1._id });
    const pd2 = await models.protoDirectory.create({ parentId: pd1._id });
    await models.protoFile.create({ parentId: pd1._id });
    await models.protoFile.create({ parentId: pd2._id });
    await models.protoFile.create({ parentId: w1._id });

    const w2 = await models.workspace.create();

    // Act
    const state = await reduxStateForTest(w2._id);
    const expandedDirs = selectExpandedActiveProtoDirectories(state);

    // Assert
    expect(expandedDirs).toHaveLength(0);
  });

  it('should return only directories if no proto files exist', async () => {
    // Arrange workspace 1
    const w = await models.workspace.create();
    const pd1 = await models.protoDirectory.create({ parentId: w._id });
    const pd2 = await models.protoDirectory.create({ parentId: pd1._id });

    // Act
    const state = await reduxStateForTest(w._id);
    const expandedDirs = selectExpandedActiveProtoDirectories(state);

    // Assert
    expect(expandedDirs).toHaveLength(1);
    expect(expandedDirs).toStrictEqual([
      {
        files: [],
        dir: pd1,
        subDirs: [
          {
            files: [],
            dir: pd2,
            subDirs: [],
          },
        ],
      },
    ]);
  });

  it('should return individual files in a null expanded dir', async () => {
    // Arrange
    const w = await models.workspace.create();
    const pf1 = await models.protoFile.create({ parentId: w._id });
    const pf2 = await models.protoFile.create({ parentId: w._id });

    // Act
    const state = await reduxStateForTest(w._id);
    const expandedDirs = selectExpandedActiveProtoDirectories(state);

    // Assert
    expect(expandedDirs).toHaveLength(1);
    expect(expandedDirs).toStrictEqual([
      {
        files: expect.arrayContaining([pf1, pf2]),
        dir: null,
        subDirs: [],
      },
    ]);
  });

  it('should expand root directories', async () => {
    // Arrange
    const w = await models.workspace.create();
    const pd1 = await models.protoDirectory.create({ parentId: w._id });
    const pd2 = await models.protoDirectory.create({ parentId: w._id });
    const pf1 = await models.protoFile.create({ parentId: pd1._id });
    const pf2 = await models.protoFile.create({ parentId: pd2._id });

    // Act
    const state = await reduxStateForTest(w._id);
    const expandedDirs = selectExpandedActiveProtoDirectories(state);

    // Assert
    expect(expandedDirs).toHaveLength(2);
    expect(expandedDirs).toStrictEqual(
      expect.arrayContaining([
        {
          files: [pf1],
          dir: pd1,
          subDirs: [],
        },
        {
          files: [pf2],
          dir: pd2,
          subDirs: [],
        },
      ]),
    );
  });

  it('should expand nested directories', async () => {
    // Arrange
    const w = await models.workspace.create();
    const pd1 = await models.protoDirectory.create({ parentId: w._id });
    const pd2 = await models.protoDirectory.create({ parentId: pd1._id });
    const pf1 = await models.protoFile.create({ parentId: pd1._id });
    const pf2 = await models.protoFile.create({ parentId: pd2._id });

    // Act
    const state = await reduxStateForTest(w._id);
    const expandedDirs = selectExpandedActiveProtoDirectories(state);

    // Assert
    expect(expandedDirs).toHaveLength(1);
    expect(expandedDirs).toStrictEqual([
      {
        files: [pf1],
        dir: pd1,
        subDirs: [
          {
            files: [pf2],
            dir: pd2,
            subDirs: [],
          },
        ],
      },
    ]);
  });

  it('should include all individual files and nested directories', async () => {
    // Arrange workspace 1
    const w = await models.workspace.create();
    const pd1 = await models.protoDirectory.create({ parentId: w._id });
    const pd2 = await models.protoDirectory.create({ parentId: pd1._id });
    const pf1 = await models.protoFile.create({ parentId: pd1._id });
    const pf2 = await models.protoFile.create({ parentId: pd2._id });
    const pf3 = await models.protoFile.create({ parentId: w._id });

    // Act
    const state = await reduxStateForTest(w._id);
    const expandedDirs = selectExpandedActiveProtoDirectories(state);

    // Assert
    expect(expandedDirs).toHaveLength(2);
    expect(expandedDirs).toStrictEqual([
      {
        files: [pf3],
        dir: null,
        subDirs: [],
      },
      {
        files: [pf1],
        dir: pd1,
        subDirs: [
          {
            files: [pf2],
            dir: pd2,
            subDirs: [],
          },
        ],
      },
    ]);
  });
});
