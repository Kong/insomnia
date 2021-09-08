import electron from 'electron';
import EventEmitter from 'events';

interface Options {
  redirectTo?: string;
  setCertificateVerifyProc?: Electron.Session['setCertificateVerifyProc'];
}

export function createBWRedirectMock({
  redirectTo,
  setCertificateVerifyProc = () => {},
}: Options) {
  electron.remote.BrowserWindow = jest.fn(function() {
    this._emitter = new EventEmitter();

    this.loadURL = () => this.webContents.emit('did-navigate');

    this.on = (event, cb) => this._emitter.on(event, cb);

    this.show = () => this._emitter.emit('show');

    this.close = () => this._emitter.emit('close');

    this.webContents = new EventEmitter();

    this.webContents.getURL = () => redirectTo;

    this.webContents.session = {
      setCertificateVerifyProc,
    };

    this._emitter.emit('ready-to-show');
  });
}
