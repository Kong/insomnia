declare type moment = {
  fromNow: () => string;
};

declare module 'moment' {
  declare module.exports: (date: any) => moment
}
