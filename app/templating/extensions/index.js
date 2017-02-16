import TimestampExtension from './TimestampExtension';
import UuidExtension from './UuidExtension';
import NowExtension from './NowExtension';

export function all () {
  return [
    TimestampExtension,
    UuidExtension,
    NowExtension,
  ]
}
