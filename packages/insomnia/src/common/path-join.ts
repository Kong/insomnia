function isWindows() {
  const platform = navigator.userAgent || navigator.platform || '';
  return /Windows|Win32|Win64|WOW64|Win/.test(platform);
}

// Main join function
export function browserPathJoin(...segments: string[]) {
  const win = isWindows();

  const sep = win ? '\\' : '/';
  const altSep = win ? '/' : '\\';

  let path = '';
  let isAbsolute = false;
  let device = ''; // for Windows drive letters or UNC

  for (let segment of segments) {
    if (!segment) continue;

    // Convert alt separators
    segment = segment.replace(new RegExp('\\' + altSep, 'g'), sep);

    // ---- WINDOWS LOGIC ----
    if (win) {
      // UNC path: \\server\share
      if (segment.startsWith('\\\\')) {
        device = '\\\\';
        path = segment.replace(/^\\\\+/, ''); // remove leading \\ only
        isAbsolute = true;
        continue;
      }

      // Drive letter: C:\ or C:
      const driveMatch = /^([A-Za-z]:)(.*)/.exec(segment);
      if (driveMatch) {
        device = driveMatch[1];
        segment = driveMatch[2];

        // Absolute if drive is followed by a separator
        isAbsolute = segment.startsWith(sep) ? true : false;

        path = '';
        segment = segment.replace(/^\\+/, '');
      }
    }

    // POSIX absolute path: starts with /
    if (!device && segment.startsWith(sep)) {
      isAbsolute = true;
      path = '';
      segment = segment.replace(/^\/+/, ''); // normalize only for posix
    }

    // Append segment
    if (segment) {
      if (path) path += sep + segment;
      else path = segment;
    }
  }

  // Prepend separators or device depending on OS
  if (win) {
    if (device) {
      const prefix = device + (isAbsolute ? sep : '');
      return prefix + path;
    }
    if (isAbsolute) return sep + path;
    return path;
  }

  // POSIX
  return (isAbsolute ? sep : '') + path;
}
