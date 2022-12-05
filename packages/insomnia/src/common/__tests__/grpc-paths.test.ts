import { describe, expect, it } from '@jest/globals';

import {
  getGrpcPathSegments,
  getShortGrpcPath,
} from '../grpc-paths';

describe('getGrpcPathSegments', () => {
  it.each([
    ['package', 'service', 'method'],
    ['nested.package', 'service', 'method'],
    ['another.nested.package', 'service', 'method'],
    ['.another.package', 'service', 'method'],
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

  it.each([['service', 'method']])(
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

describe('getShortGrpcPath', () => {
  it('should return shortened path', () => {
    const packageName = 'package';
    const serviceName = 'service';
    const methodName = 'method';
    const fullPath = '/package.service/method';
    const shortPath = getShortGrpcPath(
      {
        packageName,
        serviceName,
        methodName,
      },
      fullPath,
    );
    expect(shortPath).toBe('/service/method');
  });

  it('should return full path', () => {
    const packageName = undefined;
    const serviceName = 'service';
    const methodName = 'method';
    const fullPath = '/service/method';
    const shortPath = getShortGrpcPath(
      {
        packageName,
        serviceName,
        methodName,
      },
      fullPath,
    );
    expect(shortPath).toBe(fullPath);
  });
});
