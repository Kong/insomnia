// @flow
import path from 'path';
import os from 'os';
import mkdirp from 'mkdirp';
import fs from 'fs';
import type { ProtoFile } from '../../models/proto-file';

const getProtoTempFileName = ({ _id, modified }: ProtoFile): string => `${_id}.${modified}.proto`;

const writeProtoFile = async (protoFile: ProtoFile): Promise<string> => {
  // Create temp folder
  const root = path.join(os.tmpdir(), 'insomnia-grpc');
  mkdirp.sync(root);

  // Check if file already exists
  const fullPath = path.join(root, getProtoTempFileName(protoFile));
  console.log(`check for ${fullPath}`);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }

  // Write file
  console.log(`[gRPC] Writing ${protoFile.name} to ${fullPath}.`);
  await fs.promises.writeFile(fullPath, protoFile.protoText);
  return fullPath;
};

export default writeProtoFile;
