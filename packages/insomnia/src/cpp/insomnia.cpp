// NOTE: The calls in this wrapper are only supported on Windows >= 8.
#define _WIN32_WINNT 0x602
#define __INSOMNIA_OUTPUT_BUFFER_SIZE 8192

#include <cstdio>
#include <cstring>
#include <io.h>
#include <string>
#include <windows.h>

// #define DEBUG

const char *INSOMNIA_VERSION = "__VERSION__";

const char *INSOMNIA_ISSUE_REPORT_PREFIX =
    "\n\nPlease report this issue on GitHub:\n";
const char *INSOMNIA_ISSUE_URL = "https://github.com/Kong/insomnia/issues";
const char *INSOMNIA_ISSUE_REPORT_POSTFIX =
    "\nWould you like to open the issue report URL in your default browser?";

const char *SQUIRREL_INSTALL = "--squirrel-install";
const char *SQUIRREL_UPDATED = "--squirrel-updated";
const char *SQUIRREL_OBSOLETE = "--squirrel-obsolete";
const char *SQUIRREL_UNINSTALL = "--squirrel-uninstall";
const char *SQUIRREL_FIRST_RUN = "--squirrel-first-run";

#ifdef DEBUG
HANDLE hDebugLog;
BOOL handleCreated = FALSE;

void DebugLog(const char *msg) {
  if (handleCreated) {
    ::WriteFile(hDebugLog, msg, strlen(msg), NULL, NULL);
    ::WriteFile(hDebugLog, "\n", 1, NULL, NULL);
  }
}
#endif

int ExitWithWarning(int cmdShow, const char *msg) {
  std::string finalMsg(msg);
  finalMsg += INSOMNIA_ISSUE_REPORT_POSTFIX;
  finalMsg += INSOMNIA_ISSUE_URL;
  finalMsg += INSOMNIA_ISSUE_REPORT_POSTFIX;
  if (::MessageBox(NULL, finalMsg.c_str(),
                   "Insomnia was unable to start up properly",
                   MB_YESNO | MB_ICONERROR) == IDYES) {
    // Open the issue report URL in the default browser
    ::ShellExecute(0, 0, INSOMNIA_ISSUE_URL, NULL, NULL, cmdShow);
  }
#ifdef DEBUG
  if (handleCreated) {
    ::CloseHandle(hDebugLog);
  }
#endif
  return 1;
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance,
                   LPSTR lpCmdLine, int nCmdShow) {

#ifdef DEBUG
  char temporaryPath[MAX_PATH];
  ::GetTempPath(MAX_PATH, temporaryPath);

  std::string tempPath(temporaryPath);
  tempPath.append("insomnia.log");

  hDebugLog = ::CreateFile(tempPath.c_str(), FILE_APPEND_DATA, FILE_SHARE_WRITE,
                           NULL, OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
  if (hDebugLog == INVALID_HANDLE_VALUE) {
    return ::ExitWithWarning(nCmdShow, "Could not create debug log file.");
  }
  handleCreated = TRUE;
  DebugLog("__________________________________________________");
  DebugLog(lpCmdLine);
#endif

  char insomniaExecutable[MAX_PATH];
  ::GetModuleFileName(NULL, insomniaExecutable, sizeof(insomniaExecutable));

  std::string currentPath(insomniaExecutable);
  currentPath = currentPath.substr(0, currentPath.find_last_of("\\/"));

  // get one directory above
  std::string updatePath(currentPath);
  updatePath = updatePath.substr(0, updatePath.find_last_of("\\/"));
  updatePath.append("\\Update.exe");

  // preserve the console output from the original executable
  ::AttachConsole(-1);
  ::WriteConsole(::GetStdHandle(STD_OUTPUT_HANDLE), "Insomnia is starting...\n",
                 25, NULL, NULL);
  ::WriteConsole(::GetStdHandle(STD_OUTPUT_HANDLE), lpCmdLine,
                 strlen(lpCmdLine), NULL, NULL);
  ::WriteConsole(::GetStdHandle(STD_OUTPUT_HANDLE), "\n", 1, NULL, NULL);

  if (strncmp(lpCmdLine, SQUIRREL_INSTALL, strlen(SQUIRREL_INSTALL)) == 0) {
#ifdef DEBUG
    ::DebugLog("Squirrel.Windows install");
#endif

    // Squirrel.Windows install
    std::string args = "--createShortcut=";
    args.append(insomniaExecutable);
    ::ShellExecute(0, "open", updatePath.c_str(), args.c_str(), NULL, SW_HIDE);

    return 0;
  } else if (strncmp(lpCmdLine, SQUIRREL_UPDATED, strlen(SQUIRREL_UPDATED)) ==
                 0 ||
             strncmp(lpCmdLine, SQUIRREL_OBSOLETE, strlen(SQUIRREL_OBSOLETE)) ==
                 0) {
#ifdef DEBUG
    ::DebugLog("Squirrel.Windows updated or obsoleted");
#endif
    // Squirrel.Windows update
    return 0;
  } else if (strncmp(lpCmdLine, SQUIRREL_UNINSTALL,
                     strlen(SQUIRREL_UNINSTALL)) == 0) {
    // Squirrel.Windows uninstall
    std::string args = "--removeShortcut=";
    args.append(insomniaExecutable);
    ::ShellExecute(0, "open", updatePath.c_str(), args.c_str(), NULL, SW_HIDE);
#ifdef DEBUG
    ::DebugLog("Squirrel.Windows uninstall");
#endif

    return 0;
  } else if (strncmp(lpCmdLine, SQUIRREL_FIRST_RUN,
                     strlen(SQUIRREL_FIRST_RUN)) == 0) {
    // Squirrel.Windows first run
#ifdef DEBUG
    ::DebugLog("Squirrel.Windows first run");
#endif
  }

  ::PROCESS_MITIGATION_POLICY psp = ::ProcessSignaturePolicy;
  ::PROCESS_MITIGATION_POLICY pilp = ::ProcessImageLoadPolicy;
  ::PROCESS_MITIGATION_BINARY_SIGNATURE_POLICY pmbsp;
  ::PROCESS_MITIGATION_IMAGE_LOAD_POLICY pmilp;
  ::PROCESS_INFORMATION pi;
  ::SECURITY_ATTRIBUTES sa;
  ::STARTUPINFO si;
  ::DWORD insomniaOutputBytesRead;
  char insomniaOutputBuffer[__INSOMNIA_OUTPUT_BUFFER_SIZE];

  if (!::GetProcessMitigationPolicy(::GetCurrentProcess(), psp, &pmbsp,
                                    sizeof(pmbsp))) {
    return ::ExitWithWarning(nCmdShow, "Could not get ProcessImageLoadPolicy.");
  }
  if (pmbsp.MitigationOptIn == 0) {
    pmbsp.MitigationOptIn = 1;
    if (!::SetProcessMitigationPolicy(psp, &pmbsp, sizeof(pmbsp))) {
      return ::ExitWithWarning(nCmdShow,
                               "Could not set ProcessImageLoadPolicy.");
    }
  }

  if (!::GetProcessMitigationPolicy(::GetCurrentProcess(), pilp, &pmilp,
                                    sizeof(pmilp))) {
    return ::ExitWithWarning(nCmdShow, "Could not get ProcessImageLoadPolicy.");
  }
  if (pmilp.PreferSystem32Images == 0) {
    pmilp.PreferSystem32Images = 1;
    if (!::SetProcessMitigationPolicy(pilp, &pmilp, sizeof(pmilp))) {
      return ::ExitWithWarning(nCmdShow,
                               "Could not set ProcessImageLoadPolicy.");
    }
  }

  ::ZeroMemory(&pi, sizeof(pi));
  ::ZeroMemory(&si, sizeof(si));

  sa.nLength = sizeof(SECURITY_ATTRIBUTES);
  sa.bInheritHandle = TRUE;
  sa.lpSecurityDescriptor = NULL;

  HANDLE outrd, outwr;

  if (!::CreatePipe(&outrd, &outwr, &sa, 0)) {
    return ::ExitWithWarning(nCmdShow, "Could not create pipe.");
  }

  if (!::SetHandleInformation(outrd, HANDLE_FLAG_INHERIT, 0)) {
    return ::ExitWithWarning(nCmdShow, "Could not set handle information.");
  }

  si.cb = sizeof(si);
  si.dwFlags |= STARTF_USESTDHANDLES;
  si.hStdOutput = outwr;
  si.hStdError = outwr;

  std::string sourceInsomniaExe(currentPath);
  sourceInsomniaExe.append("\\insomnia.dll");

#ifdef DEBUG
  ::DebugLog("Current path:");
  ::DebugLog(currentPath.c_str());
  ::DebugLog("Source insomnia executable:");
  ::DebugLog(sourceInsomniaExe.c_str());
#endif

  // create the insomnia-$VERSION.exe file
  std::string tmpExe(currentPath);
  tmpExe.append("\\insomnia-");
  tmpExe.append(INSOMNIA_VERSION);
  tmpExe.append(".exe");

#ifdef DEBUG
  ::DebugLog("Creating insomnia executable:");
  ::DebugLog(tmpExe.c_str());
  ::DebugLog("Copying file");
#endif

  if (!::CopyFile(sourceInsomniaExe.c_str(), tmpExe.c_str(), FALSE)) {
#ifdef DEBUG
    DebugLog("Could not copy file.");
#endif
    return ::ExitWithWarning(nCmdShow,
                             "Cannot read or write to executable folder.");
  }

  if (!::CreateProcess(NULL, (LPSTR)tmpExe.c_str(), NULL, NULL, TRUE, 0, NULL,
                       currentPath.c_str(), &si, &pi)) {
#ifdef DEBUG
    ::DebugLog("Could not create process:");
    ::DebugLog(lpCmdLine);
    ::DebugLog(__TIME__);
    ::CloseHandle(outrd);
    ::CloseHandle(outwr);
#endif
    return ::ExitWithWarning(nCmdShow, "Unable to Launch Insomnia.");
  }

  // yes, close the write handle here, trust me
  ::CloseHandle(outwr);

  // loops until the pipe is closed because the write handle is closed
  while (::ReadFile(outrd, insomniaOutputBuffer,
                    sizeof(insomniaOutputBuffer) - 1, &insomniaOutputBytesRead,
                    NULL) &&
         insomniaOutputBytesRead > 0) {
    ::WriteFile(::GetStdHandle(STD_OUTPUT_HANDLE), insomniaOutputBuffer,
                insomniaOutputBytesRead, NULL, NULL);
  }

  // no more to read
  ::CloseHandle(outrd);

  // wait for the process to finish (probably arlready done since the read
  // handle is not readable)
  ::WaitForSingleObject(pi.hProcess, INFINITE);

  // release the handles
  ::CloseHandle(pi.hProcess);
  ::CloseHandle(pi.hThread);

  // finally, delete the insomnia-$VERSION.exe file after waiting up to 3s for
  // the handle to fully release
  for (int i = 0; i < 2; i++) {
    Sleep(1000);
    if (!::DeleteFile(tmpExe.c_str())) {
#ifdef DEBUG
      DWORD lastErr = ::GetLastError();
      ::DebugLog("Attempted to delete file:");
      ::DebugLog(tmpExe.c_str());
      ::DebugLog("Return value:");
      ::DebugLog(std::to_string(lastErr).c_str());
#endif
    } else {
      break;
    }
  }

#ifdef DEBUG
  ::CloseHandle(hDebugLog);
#endif

  return 0;
}
