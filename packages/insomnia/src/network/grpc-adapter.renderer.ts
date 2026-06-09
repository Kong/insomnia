export const start = (options: any) => window.main.grpc.start(options);
export const sendMessage = (options: any) => window.main.grpc.sendMessage(options);
export const commit = (requestId: string) => window.main.grpc.commit(requestId);
export const cancel = (requestId: string) => window.main.grpc.cancel(requestId);
export const loadMethods = (protoFileId: string) => window.main.grpc.loadMethods(protoFileId);
export const loadMethodsFromReflection = (options: any) => window.main.grpc.loadMethodsFromReflection(options);
export const closeAll = () => window.main.grpc.closeAll();
export const writeProtoFile = (protoFileId: string) => window.main.grpc.writeProtoFile(protoFileId);
export const validateProtoFile = (filePath: string) => window.main.grpc.validateProtoFile(filePath);
