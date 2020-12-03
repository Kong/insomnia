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
    ['pkg', 'svc', 'mthd'],
    ['a.pkg', 'svc', 'mthd'],
    ['a.2.pkg', 'svc', 'mthd'],
    ['.a.2.pkg', 'svc', 'mthd'],
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

describe('getShortGrpcPath', () => {
  it('should return shortened path', () => {
    const packageName = 'pkg';
    const serviceName = 'svc';
    const methodName = 'mthd';
    const fullPath = '/pkg.svc/mthd';

    const shortPath = getShortGrpcPath({ packageName, serviceName, methodName }, fullPath);

    expect(shortPath).toBe('/svc/mthd');
  });

  it('should return full path', () => {
    const packageName = undefined;
    const serviceName = 'svc';
    const methodName = 'mthd';
    const fullPath = '/svc/mthd';

    const shortPath = getShortGrpcPath({ packageName, serviceName, methodName }, fullPath);

    expect(shortPath).toBe(fullPath);
  });
});

const methodBuilder = createBuilder(grpcMethodDefinitionSchema);

describe('groupGrpcMethodsByPackage', () => {
  it('should group methods by package', () => {
    const packageMethod1 = methodBuilder
      .path('/pkg1.svc/u')
      .requestStream(false)
      .responseStream(false)
      .build();
    const packageMethod2 = methodBuilder
      .path('/pkg1.svc/ss')
      .requestStream(false)
      .responseStream(true)
      .build();
    const newPackage = methodBuilder
      .path('/pkg2.svc/cs')
      .requestStream(true)
      .responseStream(false)
      .build();
    const noPackage = methodBuilder
      .path('/svc/bd')
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
          serviceName: 'svc',
          methodName: 'bd',
        },
        type: GrpcMethodTypeEnum.bidi,
        fullPath: noPackage.path,
      },
    ]);

    expect(grouped.pkg1).toStrictEqual([
      {
        segments: {
          packageName: 'pkg1',
          serviceName: 'svc',
          methodName: 'u',
        },
        type: GrpcMethodTypeEnum.unary,
        fullPath: packageMethod1.path,
      },
      {
        segments: {
          packageName: 'pkg1',
          serviceName: 'svc',
          methodName: 'ss',
        },
        type: GrpcMethodTypeEnum.server,
        fullPath: packageMethod2.path,
      },
    ]);

    expect(grouped.pkg2).toStrictEqual([
      {
        segments: {
          packageName: 'pkg2',
          serviceName: 'svc',
          methodName: 'cs',
        },
        type: GrpcMethodTypeEnum.client,
        fullPath: newPackage.path,
      },
    ]);
  });
});
