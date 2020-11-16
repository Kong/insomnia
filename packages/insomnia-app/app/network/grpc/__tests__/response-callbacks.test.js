// @flow
import { ResponseCallbacks } from '../response-callbacks';
import { GrpcResponseEventEnum } from '../../../common/grpc-events';

describe('response-callbacks', () => {
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

  it('should sendEnd with expected arguments', () => {
    new ResponseCallbacks(event).sendEnd(id);

    expect(event.reply).toHaveBeenCalledTimes(1);
    expect(event.reply).toHaveBeenCalledWith(GrpcResponseEventEnum.end, id);
  });

  it('should sendStart with expected arguments', () => {
    new ResponseCallbacks(event).sendStart(id);

    expect(event.reply).toHaveBeenCalledTimes(1);
    expect(event.reply).toHaveBeenCalledWith(GrpcResponseEventEnum.start, id);
  });

  it('should sendStatus with expected arguments', () => {
    const obj = {};

    new ResponseCallbacks(event).sendStatus(id, obj);

    expect(event.reply).toHaveBeenCalledTimes(1);
    expect(event.reply).toHaveBeenCalledWith(GrpcResponseEventEnum.status, id, obj);
  });
});
