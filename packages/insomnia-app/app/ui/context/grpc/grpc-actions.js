// @flow

export const GrpcActionTypeEnum = {
  start: 'start',
  stop: 'stop',
};
type GrpcActionType = $Values<typeof GrpcActionTypeEnum>;

type BaseAction<T: GrpcActionType> = { type: T, requestId: string };
type StartAction = BaseAction<ActionTypeEnum.start>;
type StopAction = BaseAction<ActionTypeEnum.stop>;

export type GrpcAction = StartAction | StopAction;
export type GrpcDispatch = (action: GrpcAction) => void;

const start = (requestId: string): StartAction => ({
  type: ActionTypeEnum.start,
  requestId,
});

const stop = (requestId: string): StopAction => ({
  type: ActionTypeEnum.stop,
  requestId,
});

const grpcActions = { start, stop };

export default grpcActions;
