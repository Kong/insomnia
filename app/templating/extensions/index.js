import TimestampExtension from './timestamp-extension';
import UuidExtension from './uuid-extension';
import NowExtension from './now-extension';
import ResponseJsonPathExtension from './response-extension';

export function all () {
  return [
    TimestampExtension,
    UuidExtension,
    NowExtension,
    ResponseJsonPathExtension
  ];
}
