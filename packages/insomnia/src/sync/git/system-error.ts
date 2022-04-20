interface SystemErrorConstructor {
  /** The string error code */
  code: 'EBADF' | 'ENOTEMPTY' | 'EEXIST' | 'ENOENT' | 'ENOTDIR' | 'EISDIR';

  /** The system-provided error number */
  errno: -9 | -66 | -17 | -2 | -20 | -21;

  message: string;

  /** If present, the file path when reporting a file system error */
  path: string;

  /** The name of the system call that triggered the error */
  syscall: 'write' | 'rmdir' | 'open' | 'scandir';
}

/**
 * This is basically Node's SystemError, which Node (intentionally) does not expose to prevent people from doing... exactly what we're doing with it (which is throw a SystemError even though we're not System).
 * see https://nodejs.org/api/errors.html#errors_class_systemerror
 */
export class SystemError extends Error {
  code: SystemErrorConstructor['code'];
  errno: SystemErrorConstructor['errno'];
  path: SystemErrorConstructor['path'];
  syscall: SystemErrorConstructor['syscall'];

  constructor({
    code,
    errno,
    message,
    path,
    syscall,
  }: SystemErrorConstructor) {
    super(message);

    const error = new Error(message);
    this.message = error.message;
    this.name = error.name;
    this.stack = error.stack;

    this.code = code;
    this.errno = errno;
    this.path = path;
    this.syscall = syscall;
  }
}
