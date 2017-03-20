import electron from 'electron';
import querystring from 'querystring';

export function responseToObject (body, keys) {
  let data = null;
  try {
    data = JSON.parse(body);
  } catch (err) {
  }

  if (!data) {
    try {
      data = querystring.parse(body);
    } catch (err) {
    }
  }

  let results = {};
  for (const key of keys) {
    const value = typeof data[key] === 'string' ? data[key] : null;
    results[key] = value;
  }

  return results;
}

export function authorizeUserInWindow (url) {
  return new Promise(resolve => {
    // Create a child window
    const child = new electron.remote.BrowserWindow({
      webPreferences: {nodeIntegration: false},
      show: false
    });

    // Catch the redirect after login
    child.webContents.on('did-navigate', () => {
      const url = child.webContents.getURL();
      resolve(url);
      child.close();
    });

    // Show the window to the user after it loads
    child.on('ready-to-show', child.show.bind(child));
    child.loadURL(url);
  });
}
