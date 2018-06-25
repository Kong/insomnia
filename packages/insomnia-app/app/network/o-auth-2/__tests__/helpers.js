import electron from 'electron';
import EventEmitter from 'events';

export function createBWRedirectMock(redirectTo) {
  electron.remote.BrowserWindow = jest.fn(function() {
    this._emitter = new EventEmitter();
    this.loadURL = () => this.webContents.emit('did-navigate');
    this.on = (event, cb) => this._emitter.on(event, cb);
    this.show = () => this._emitter.emit('show');
    this.close = () => this._emitter.emit('close');

    this.webContents = new EventEmitter();
    this.webContents.getURL = () => redirectTo;

    this._emitter.emit('ready-to-show');
  });
}
