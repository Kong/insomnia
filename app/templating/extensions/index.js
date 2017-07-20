import * as plugins from '../../plugins/index';

import timestampExtension from './timestamp-extension';
import uuidExtension from './uuid-extension';
import NowExtension from './now-extension';
import responseExtension from './response-extension';
import base64Extension from './base-64-extension';
import requestExtension from './request-extension';

const DEFAULT_EXTENSIONS = [
  timestampExtension,
  NowExtension,
  uuidExtension,
  base64Extension,
  requestExtension,
  responseExtension
];

export async function all () {
  const templateTags = await plugins.getTemplateTags();
  return [
    ...DEFAULT_EXTENSIONS,
    ...templateTags.map(p => p.templateTag)
  ];
}
