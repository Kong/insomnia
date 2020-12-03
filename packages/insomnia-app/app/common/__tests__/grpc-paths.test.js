// @flow

import { getGrpcPathSegments } from '../grpc-paths';

describe('getGrpcPathSegments', () => {
  it.each([
    ['pkg', 'svc', 'mthd'],
    ['a.pkg', 'svc', 'mthd'],
    ['a.2.pkg', 'svc', 'mthd'],
  ])(
    'should extract package, service and method from "/%s.%s/%s"',
    (packageName, serviceName, methodName) => {
      expect(getGrpcPathSegments(`/${packageName}.${serviceName}/${methodName}`)).toStrictEqual({
        packageName,
        serviceName,
        methodName,
      });
    },
  );

  it.each([['svc', 'mthd']])(
    'should extract service and method from "/%s/%s"',
    (serviceName, methodName) => {
      expect(getGrpcPathSegments(`/${serviceName}/${methodName}`)).toStrictEqual({
        packageName: undefined,
        serviceName,
        methodName,
      });
    },
  );
});
