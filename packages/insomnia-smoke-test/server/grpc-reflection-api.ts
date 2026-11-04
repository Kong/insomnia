import express from 'express';

// Mock of the buf.build reflection API (Connect unary) used by getMethodsFromReflectionServer.
// The Insomnia Connect client sends application/proto by default, so responses are encoded to match the
// request content type (binary protobuf or JSON).
const ROUTE_GUIDE_FILE = {
  name: 'route_guide.proto',
  package: 'routeguide',
  syntax: 'proto3',
  messageType: [
    {
      name: 'Point',
      field: [
        { name: 'latitude', number: 1, label: 'LABEL_OPTIONAL', type: 'TYPE_INT32', jsonName: 'latitude' },
        { name: 'longitude', number: 2, label: 'LABEL_OPTIONAL', type: 'TYPE_INT32', jsonName: 'longitude' },
      ],
    },
    {
      name: 'Feature',
      field: [
        { name: 'name', number: 1, label: 'LABEL_OPTIONAL', type: 'TYPE_STRING', jsonName: 'name' },
        {
          name: 'location',
          number: 2,
          label: 'LABEL_OPTIONAL',
          type: 'TYPE_MESSAGE',
          typeName: '.routeguide.Point',
          jsonName: 'location',
        },
      ],
    },
  ],
  service: [
    {
      name: 'RouteGuide',
      method: [{ name: 'GetFeature', inputType: '.routeguide.Point', outputType: '.routeguide.Feature' }],
    },
  ],
};

// Protobuf wire encoding for the descriptor subset above (field numbers from descriptor.proto).
const LABEL_VALUES: Record<string, number> = { LABEL_OPTIONAL: 1, LABEL_REPEATED: 3 };
const TYPE_VALUES: Record<string, number> = { TYPE_INT32: 5, TYPE_STRING: 9, TYPE_MESSAGE: 11 };

const encodeVarint = (value: number): Buffer => {
  const bytes: number[] = [];
  let rest = value;
  while (rest > 0x7f) {
    bytes.push((rest & 0x7f) | 0x80);
    rest >>>= 7;
  }
  bytes.push(rest);
  return Buffer.from(bytes);
};
const encodeTag = (fieldNumber: number, wireType: number) => encodeVarint((fieldNumber << 3) | wireType);
const encodeString = (fieldNumber: number, value: string) => {
  const bytes = Buffer.from(value, 'utf8');
  return Buffer.concat([encodeTag(fieldNumber, 2), encodeVarint(bytes.length), bytes]);
};
const encodeInt = (fieldNumber: number, value: number) =>
  Buffer.concat([encodeTag(fieldNumber, 0), encodeVarint(value)]);
const encodeMessage = (fieldNumber: number, body: Buffer) =>
  Buffer.concat([encodeTag(fieldNumber, 2), encodeVarint(body.length), body]);

type FileDescriptor = typeof ROUTE_GUIDE_FILE;

const encodeFileDescriptor = (file: FileDescriptor) =>
  Buffer.concat([
    encodeString(1, file.name),
    encodeString(2, file.package),
    ...file.messageType.map(message =>
      encodeMessage(
        4,
        Buffer.concat([
          encodeString(1, message.name),
          ...message.field.map(field =>
            encodeMessage(
              2,
              Buffer.concat([
                encodeString(1, field.name),
                encodeInt(3, field.number),
                encodeInt(4, LABEL_VALUES[field.label]),
                encodeInt(5, TYPE_VALUES[field.type]),
                ...('typeName' in field ? [encodeString(6, field.typeName)] : []),
                encodeString(10, field.jsonName),
              ]),
            ),
          ),
        ]),
      ),
    ),
    ...file.service.map(service =>
      encodeMessage(
        6,
        Buffer.concat([
          encodeString(1, service.name),
          ...service.method.map(method =>
            encodeMessage(
              2,
              Buffer.concat([
                encodeString(1, method.name),
                encodeString(2, method.inputType),
                encodeString(3, method.outputType),
              ]),
            ),
          ),
        ]),
      ),
    ),
    encodeString(12, file.syntax),
  ]);

// GetFileDescriptorSetResponse { FileDescriptorSet file_descriptor_set = 1 } where FileDescriptorSet { repeated FileDescriptorProto file = 1 }
const encodeResponse = () => encodeMessage(1, encodeMessage(1, encodeFileDescriptor(ROUTE_GUIDE_FILE)));

// The Connect client only sets `module` (field 1, string) on the wire.
const decodeModuleFromProto = (body: Buffer): string | undefined => {
  if (body[0] !== 0x0a) {
    return undefined;
  }
  const length = body[1];
  return body.subarray(2, 2 + length).toString('utf8');
};

const router = express.Router();

router.post(
  '/buf.reflect.v1beta1.FileDescriptorSetService/GetFileDescriptorSet',
  express.raw({ type: '*/*' }),
  (req, res) => {
    if (req.headers.authorization !== 'Bearer smoke-reflection-key') {
      res.status(401).json({ code: 'unauthenticated', message: 'invalid api key' });
      return;
    }

    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const isJson = (req.headers['content-type'] ?? '').includes('json');
    const moduleName = isJson
      ? (JSON.parse(body.toString('utf8') || '{}') as { module?: string }).module
      : decodeModuleFromProto(body);

    if (moduleName !== 'smoke-module') {
      res.status(404).json({ code: 'not_found', message: 'module not found' });
      return;
    }

    if (isJson) {
      res.status(200).json({ fileDescriptorSet: { file: [ROUTE_GUIDE_FILE] } });
      return;
    }
    res.status(200).type('application/proto').send(encodeResponse());
  },
);

export default router;
