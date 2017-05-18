import {getTagDefinitions} from '../';

describe('getTagDefinitions()', () => {
  it('does it', () => {
    const result = getTagDefinitions();
    expect(result).toEqual([
      {
        name: 'base64',
        args: [
          {name: 'action', type: 'enum', options: ['encode', 'decode']},
          {name: 'value', type: 'string'}
        ]
      },
      {
        name: 'now',
        args: [{
          name: 'type',
          type: 'enum',
          options: ['millis', 'unix', 'iso-8601']
        }]
      },
      {
        name: 'response',
        args: [
          {name: 'field', type: 'enum', options: ['body']},
          {name: 'request', type: 'model', model: 'Request'},
          {name: 'query', type: 'string'}
        ]
      },
      {
        name: 'timestamp',
        args: []
      },
      {
        name: 'uuid',
        args: [{
          name: 'type',
          type: 'enum',
          options: ['v4', 'v1']
        }]
      }
    ]);
  });
});
