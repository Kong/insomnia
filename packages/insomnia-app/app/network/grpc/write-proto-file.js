// @flow
import path from 'path';
import os from 'os';
import mkdirp from 'mkdirp';
import fs from 'fs';
import type { ProtoFile } from '../../models/proto-file';

const writeProtoFile = async (protoFile: ProtoFile): Promise<string> => {
  const root = path.join(os.tmpdir(), 'insomnia-grpc');
  mkdirp.sync(root);
  const fileName = `${protoFile._id}.${protoFile.modified}.proto`;
  const fullPath = path.join(root, fileName);
  console.log(`check for ${fullPath}`);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  console.log(`[gRPC] Writing ${protoFile.name} to ${fullPath}.`);
  await fs.promises.writeFile(fullPath, protoFile.protoText);
  return fullPath;
};

export default writeProtoFile;
