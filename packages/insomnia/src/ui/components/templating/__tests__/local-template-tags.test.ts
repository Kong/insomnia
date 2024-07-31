import { describe, expect, it } from 'vitest';

import { type PluginTemplateTagContext } from '../../../../templating/extensions';
import { invariant } from '../../../../utils/invariant';
import { localTemplateTags } from '../local-template-tags';
describe('base64 tag', () => {
  describe('encoder', () => {
    const base64EncoderTag = localTemplateTags.find(p => p.templateTag.name === 'base64')?.templateTag;
    invariant(base64EncoderTag, 'missing tag in localTemplateTags');
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
