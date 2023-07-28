import { type PluginTemplateTagContext } from '../../../../templating/extensions';
import { base64EncoderTag } from '../local-template-tags';

describe('base64 tag', () => {
  describe('encoder', () => {

    it('encodes from normal', () => {
      const encoded = base64EncoderTag.run({} as PluginTemplateTagContext, 'encode', 'normal', 'hello');
      expect(encoded).toBe('aGVsbG8=');
    });

    it('encodes from hex', () => {
      const encoded = base64EncoderTag.run({} as PluginTemplateTagContext, 'encode', 'hex', 'abc123');
      expect(encoded).toBe('q8Ej');
    });

    it('errors on invalid action', () => {
      expect(() => base64EncoderTag.run({} as PluginTemplateTagContext, 'transform', 'normal', 'hello')).toThrowError();
    });

    it('errors on invalid kind', () => {
      expect(() => base64EncoderTag.run({} as PluginTemplateTagContext, 'encode', 'klingon', 'hello')).toThrowError();
    });
  });

});
