import TimestampExtension from './TimestampExtension';
import UuidExtension from './UuidExtension';
import NowExtension from './NowExtension';
import ResponseJsonPathExtension from './ResponseJsonPathExtension';

export function all () {
  return [
    TimestampExtension,
    UuidExtension,
    NowExtension,
    ResponseJsonPathExtension,
  ]
}
