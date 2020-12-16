// @flow

import {
  getGrpcPathSegments,
  getShortGrpcPath,
  groupGrpcMethodsByPackage,
  NO_PACKAGE_KEY,
} from '../grpc-paths';
import { createBuilder } from '@develohpanda/fluent-builder';
import { grpcMethodDefinitionSchema } from '../../ui/context/grpc/__schemas__';
import { GrpcMethodTypeEnum } from '../../network/grpc/method';

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

    const shortPath = getShortGrpcPath({ packageName, serviceName, methodName }, fullPath);

    expect(shortPath).toBe('/service/method');
  });

  it('should return full path', () => {
    const packageName = undefined;
    const serviceName = 'service';
    const methodName = 'method';
    const fullPath = '/service/method';

    const shortPath = getShortGrpcPath({ packageName, serviceName, methodName }, fullPath);

    expect(shortPath).toBe(fullPath);
  });
});

const methodBuilder = createBuilder(grpcMethodDefinitionSchema);

describe('groupGrpcMethodsByPackage', () => {
  it('should group methods by package', () => {
    const packageMethod1 = methodBuilder
      .path('/package1.service/u')
      .requestStream(false)
      .responseStream(false)
      .build();
    const packageMethod2 = methodBuilder
      .path('/package1.service/ss')
      .requestStream(false)
      .responseStream(true)
      .build();
    const newPackage = methodBuilder
      .path('/package2.service/cs')
      .requestStream(true)
      .responseStream(false)
      .build();
    const noPackage = methodBuilder
      .path('/service/bd')
      .requestStream(true)
      .responseStream(true)
      .build();

    const grouped = groupGrpcMethodsByPackage([
      packageMethod1,
      packageMethod2,
      newPackage,
      noPackage,
    ]);

    expect(Object.keys(grouped).length).toBe(3);

    expect(grouped[NO_PACKAGE_KEY]).toStrictEqual([
      {
        segments: {
          packageName: undefined,
          serviceName: 'service',
          methodName: 'bd',
        },
        type: GrpcMethodTypeEnum.bidi,
        fullPath: noPackage.path,
      },
    ]);

    expect(grouped.package1).toStrictEqual([
      {
        segments: {
          packageName: 'package1',
          serviceName: 'service',
          methodName: 'u',
        },
        type: GrpcMethodTypeEnum.unary,
        fullPath: packageMethod1.path,
      },
      {
        segments: {
          packageName: 'package1',
          serviceName: 'service',
          methodName: 'ss',
        },
        type: GrpcMethodTypeEnum.server,
        fullPath: packageMethod2.path,
      },
    ]);

    expect(grouped.package2).toStrictEqual([
      {
        segments: {
          packageName: 'package2',
          serviceName: 'service',
          methodName: 'cs',
        },
        type: GrpcMethodTypeEnum.client,
        fullPath: newPackage.path,
      },
    ]);
  });
});
