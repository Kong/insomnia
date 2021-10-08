import { InsomniaConfig } from '.';
import { ingest, validate } from './validate';

describe('ingest', () => {
  const config: InsomniaConfig = {
    insomniaConfig: '1.0.0',
  };

  it('returns arbitrary input without modification', () => {
    const result = ingest(config);
    expect(result).toStrictEqual(config);
  });

  it('parses a string insomnia config', () => {
    const stringConfig = JSON.stringify(config, null, 2);
    const result = ingest(stringConfig);
    expect(result).toStrictEqual(config);
  });

  it('throws on bad inputs', () => {
    const result = () => ingest('Lumpy Gravy');
    expect(result).toThrowError('Unexpected token L in JSON at position 0');
  });
});

describe('validate', () => {
  it('passes with an empty config', () => {
    const { valid, errors } = validate({
      insomniaConfig: '1.0.0',
    });
    expect(errors).toBe(null);
    expect(valid).toBe(true);
  });

  it('passes with a simple valid config', () => {
    const { valid, errors } = validate({
      insomniaConfig: '1.0.0',
      settings: {
        enableAnalytics: false,
        disableUpdateNotification: true,
      },
    });
    expect(errors).toBe(null);
    expect(valid).toBe(true);
  });

  it('fails on incorrect version', () => {
    const { valid, errors } = validate({
      insomniaConfig: 'v1.0.0',
    });
    expect(errors).toMatchObject([
      {
        instancePath: '/insomniaConfig',
        schemaPath: '#/properties/insomniaConfig/enum',
        keyword: 'enum',
        params: {
          allowedValues: [
            '1.0.0',
          ],
        },
        message: 'must be equal to one of the allowed values',
      },
    ]);
    expect(valid).toBe(false);
  });

  it('fails on missing properties', () => {
    const { valid, errors } = validate({});
    expect(errors).toMatchObject([
      {
        instancePath: '',
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: 'insomniaConfig' },
        message: "must have required property 'insomniaConfig'",
      },
    ]);
    expect(valid).toBe(false);
  });

  it('fails on additional top level properties', () => {
    const { valid, errors } = validate({
      insomniaConfig: '1.0.0',
      Settings: {},
    });

    expect(errors).toMatchObject([
      {
        instancePath: '',
        keyword: 'additionalProperties',
        message: 'must NOT have additional properties',
        params: {
          additionalProperty: 'Settings',
        },
        schemaPath: '#/additionalProperties',
      },
    ]);
    expect(valid).toBe(false);
  });

  it('fails on additional settings properties', () => {
    const { valid, errors } = validate({
      insomniaConfig: '1.0.0',
      settings: {
        disableAnalytics: true,
      },
    });

    expect(errors).toMatchObject([
      {
        instancePath: '/settings',
        keyword: 'additionalProperties',
        message: 'must NOT have additional properties',
        params: {
          additionalProperty: 'disableAnalytics',
        },
        schemaPath: '#/definitions/Partial<Pick<Settings,\"allowNotificationRequests\"|\"disableUpdateNotification\"|\"enableAnalytics\"|\"disablePaidFeatureAds\"|\"incognitoMode\">>/additionalProperties',
      },
    ]);
    expect(valid).toBe(false);
  });

  it('fails on wrong property type', () => {
    const { valid, errors } = validate({
      insomniaConfig: '1.0.0',
      settings: {
        enableAnalytics: 'Ziltoid',
      },
    });

    expect(errors).toMatchObject([
      {
        instancePath: '/settings/enableAnalytics',
        keyword: 'type',
        message: 'must be boolean',
        params: {
          'type': 'boolean',
        },
        schemaPath: '#/definitions/Partial<Pick<Settings,\"allowNotificationRequests\"|\"disableUpdateNotification\"|\"enableAnalytics\"|\"disablePaidFeatureAds\"|\"incognitoMode\">>/properties/enableAnalytics/type',
      },
    ]);
    expect(valid).toBe(false);
  });
});
