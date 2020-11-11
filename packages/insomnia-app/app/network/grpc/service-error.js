// @flow

export const GrpcStatusEnum = {
  OK: 0,
  CANCELLED: 1,
  UNKNOWN: 2,
  INVALID_ARGUMENT: 3,
  DEADLINE_EXCEEDED: 4,
  NOT_FOUND: 5,
  ALREADY_EXISTS: 6,
  PERMISSION_DENIED: 7,
  RESOURCE_EXHAUSTED: 8,
  FAILED_PRECONDITION: 9,
  ABORTED: 10,
  OUT_OF_RANGE: 11,
  UNIMPLEMENTED: 12,
  INTERNAL: 13,
  UNAVAILABLE: 14,
  DATA_LOSS: 15,
  UNAUTHENTICATED: 16,
};

type GrpcStatus = $Values<typeof GrpcStatusEnum>;

export type GrpcStatusObject = {
  code: GrpcStatus,
  details: string,
  metadata: Object, // https://grpc.github.io/grpc/node/grpc.Metadata.html
};

export type ServiceError = GrpcStatusObject & Error;
