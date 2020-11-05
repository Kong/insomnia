// @flow
import { ResponseCallbacks } from '../response-callbacks';
import { GrpcResponseEventEnum } from '../../../common/grpc-events';

describe('should reply with the expected events', () => {
  const event = { reply: jest.fn() };
  const id = 'abc';

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should sendData with expected arguments', () => {
    const val = { a: 'b' };

    new ResponseCallbacks(event).sendData(id, val);

    expect(event.reply).toHaveBeenCalledTimes(1);
    expect(event.reply).toHaveBeenCalledWith(GrpcResponseEventEnum.data, id, val);
  });

  it('should sendError with expected arguments', () => {
    const err = new Error('this is an error');

    new ResponseCallbacks(event).sendError(id, err);

    expect(event.reply).toHaveBeenCalledTimes(1);
    expect(event.reply).toHaveBeenCalledWith(GrpcResponseEventEnum.error, id, err);
  });
});
