// NOTE: The calls in this wrapper are only supported on Windows >= 8.
#define _WIN32_WINNT 0x602
#define __INSOMNIA_OUTPUT_BUFFER_SIZE 8192

#include <iostream>
#include <string>
#include <windows.h>

const wchar_t *INSOMNIA_VERSION = L"__VERSION__";

const wchar_t *INSOMNIA_ISSUE_REPORT_PREFIX = L"\n\nPlease report this issue on GitHub:\n";
const wchar_t *INSOMNIA_ISSUE_URL = L"https://github.com/Kong/insomnia/issues";
const wchar_t *INSOMNIA_ISSUE_REPORT_POSTFIX =
    L"\nWould you like to open the issue report URL in your default browser?";

const wchar_t *SQUIRREL_INSTALL = L"--squirrel-install";
const wchar_t *SQUIRREL_UPDATED = L"--squirrel-updated";
const wchar_t *SQUIRREL_OBSOLETE = L"--squirrel-obsolete";
const wchar_t *SQUIRREL_UNINSTALL = L"--squirrel-uninstall";
const wchar_t *SQUIRREL_FIRST_RUN = L"--squirrel-first-run";

BOOL DebugMode = FALSE;

int ExitWithWarning(int cmdShow, const wchar_t *msg) {
  std::wstring finalMsg = std::wstring(msg) + INSOMNIA_ISSUE_REPORT_PREFIX + INSOMNIA_ISSUE_URL +
                          INSOMNIA_ISSUE_REPORT_POSTFIX;
  if (::MessageBoxW(NULL, finalMsg.c_str(), L"Insomnia was unable to start up properly",
                    MB_YESNO | MB_ICONERROR) == IDYES) {
    // Open the issue report URL in the default browser
    ::ShellExecuteW(0, 0, INSOMNIA_ISSUE_URL, NULL, NULL, cmdShow);
  }
  return 1;
}

std::wstring GetTimestamp() {
  SYSTEMTIME st;
  GetLocalTime(&st);

  wchar_t buffer[32];
  swprintf(buffer, 32, L"%04d-%02d-%02d %02d:%02d:%02d", st.wYear, st.wMonth, st.wDay, st.wHour,
           st.wMinute, st.wSecond);

  return buffer;
}

void DebugLog(const wchar_t *msg) {
  if (!DebugMode)
    return;
  wchar_t temporaryPath[MAX_PATH];
  ::GetTempPathW(MAX_PATH, temporaryPath);

  std::wstring tempPath = std::wstring(temporaryPath) + L"insomnia.log";

  HANDLE hDebugLog =
      ::CreateFileW(tempPath.c_str(), GENERIC_WRITE, FILE_SHARE_WRITE, NULL, OPEN_ALWAYS,
                    FILE_ATTRIBUTE_NORMAL | FILE_FLAG_SEQUENTIAL_SCAN, NULL);
  if (hDebugLog == INVALID_HANDLE_VALUE) {
    std::wcerr << msg << std::endl;
    return;
  }

  if (::GetLastError() == ERROR_FILE_NOT_FOUND) {
    std::wcerr << L"File not found, creating new file." << std::endl;
    // write the utf-16 BOM
    const wchar_t bom[1] = {0xFEFF};
    ::WriteFile(hDebugLog, &bom, sizeof(bom), NULL, NULL);
  }

  ::SetFilePointer(hDebugLog, 0, NULL, FILE_END);

  std::wstring finalMsg = L"[" + GetTimestamp() + L"] " + msg;
  ::WriteFile(hDebugLog, finalMsg.c_str(), static_cast<DWORD>(finalMsg.length() * sizeof(wchar_t)),
              NULL, NULL);
  ::WriteFile(hDebugLog, L"\r\n", 2 * sizeof(wchar_t), NULL, NULL);
  ::CloseHandle(hDebugLog);
}

std::wstring ConvertLPSTRToWString(LPSTR lpstr) {
  int size_needed = MultiByteToWideChar(CP_ACP, 0, lpstr, -1, NULL, 0);
  std::wstring wstr(size_needed, 0);
  ::MultiByteToWideChar(CP_ACP, 0, lpstr, -1, &wstr[0], size_needed);
  return wstr;
}

bool PathHasSpace(const std::wstring &path) { return path.find(L' ') != std::wstring::npos; }

std::wstring QuotePathIfNeeded(const std::wstring &path) {
  return PathHasSpace(path) ? L"\"" + path + L"\"" : path;
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
  std::wstring cmdLine = ::ConvertLPSTRToWString(lpCmdLine);
  DebugMode = cmdLine.find(L"--debug") != std::wstring::npos;

  ::DebugLog(L"__________________________________________________");
  ::DebugLog((L"Command line: " + cmdLine).c_str());

  wchar_t insomniaExecutable[MAX_PATH];
  ::GetModuleFileNameW(NULL, insomniaExecutable, sizeof(insomniaExecutable));
  ::DebugLog((L"Insomnia executable: " + std::wstring(insomniaExecutable)).c_str());

  std::wstring workDir(insomniaExecutable);
  workDir = workDir.substr(0, workDir.find_last_of(L"\\"));
  ::DebugLog((L"Current path: " + workDir).c_str());

  std::wstring updatePath(workDir);
  // get one directory above
  updatePath = updatePath.substr(0, updatePath.find_last_of(L"\\")) + L"\\Update.exe";
  updatePath = QuotePathIfNeeded(updatePath);
  ::DebugLog((L"Update path: " + updatePath).c_str());

  // preserve the console output from the original executable
  ::AttachConsole(-1);

  HANDLE stdHandle = ::GetStdHandle(STD_OUTPUT_HANDLE);
  ::WriteConsoleW(stdHandle, L"Insomnia is starting...\n", 24, NULL, NULL);
  ::WriteConsoleW(stdHandle, (L"Command line arguments: " + cmdLine + L"\n").c_str(),
                  cmdLine.size() + 25, NULL, NULL);

  if (cmdLine.find(SQUIRREL_INSTALL) != std::wstring::npos) {
    ::DebugLog(L"Squirrel.Windows install");

    // Squirrel.Windows install
    std::wstring shortcut = QuotePathIfNeeded(insomniaExecutable);
    std::wstring args = std::wstring(L"--createShortcut=") + shortcut;
    ::ShellExecuteW(0, L"open", updatePath.c_str(), args.c_str(), NULL, SW_HIDE);

    return 0;
  } else if (cmdLine.find(SQUIRREL_UPDATED) != std::wstring::npos ||
             cmdLine.find(SQUIRREL_OBSOLETE) != std::wstring::npos) {
    ::DebugLog(L"Squirrel.Windows updated or obsoleted");
    // Squirrel.Windows update
    return 0;
  } else if (cmdLine.find(SQUIRREL_UNINSTALL) != std::wstring::npos) {
    // Squirrel.Windows uninstall
    std::wstring shortcut = QuotePathIfNeeded(insomniaExecutable);
    std::wstring args = std::wstring(L"--removeShortcut=") + shortcut;
    ::ShellExecuteW(0, L"open", updatePath.c_str(), args.c_str(), NULL, SW_HIDE);
    ::DebugLog(L"Squirrel.Windows uninstall");

    return 0;
  } else if (cmdLine.find(SQUIRREL_FIRST_RUN) != std::wstring::npos) {
    // Squirrel.Windows first run
    ::DebugLog(L"Squirrel.Windows first run");
  }

  ::PROCESS_MITIGATION_POLICY psp = ::ProcessSignaturePolicy;
  ::PROCESS_MITIGATION_POLICY pilp = ::ProcessImageLoadPolicy;
  ::PROCESS_MITIGATION_BINARY_SIGNATURE_POLICY pmbsp;
  ::PROCESS_MITIGATION_IMAGE_LOAD_POLICY pmilp;
  ::SECURITY_ATTRIBUTES sa;
  ::STARTUPINFOW si;
  ::PROCESS_INFORMATION pi;
  ::HANDLE outrd, outwr;
  ::DWORD outRead;
  char outBuf[__INSOMNIA_OUTPUT_BUFFER_SIZE];

  if (!::GetProcessMitigationPolicy(::GetCurrentProcess(), psp, &pmbsp, sizeof(pmbsp))) {
    return ::ExitWithWarning(nCmdShow, L"Could not get ProcessImageLoadPolicy.");
  }
  if (pmbsp.MitigationOptIn == 0) {
    pmbsp.MitigationOptIn = 1;
    if (!::SetProcessMitigationPolicy(psp, &pmbsp, sizeof(pmbsp))) {
      return ::ExitWithWarning(nCmdShow, L"Could not set ProcessImageLoadPolicy.");
    }
  }

  if (!::GetProcessMitigationPolicy(::GetCurrentProcess(), pilp, &pmilp, sizeof(pmilp))) {
    return ::ExitWithWarning(nCmdShow, L"Could not get ProcessImageLoadPolicy.");
  }
  if (pmilp.PreferSystem32Images == 0) {
    pmilp.PreferSystem32Images = 1;
    if (!::SetProcessMitigationPolicy(pilp, &pmilp, sizeof(pmilp))) {
      return ::ExitWithWarning(nCmdShow, L"Could not set ProcessImageLoadPolicy.");
    }
  }

  ::ZeroMemory(&pi, sizeof(pi));
  ::ZeroMemory(&si, sizeof(si));

  sa.nLength = sizeof(SECURITY_ATTRIBUTES);
  sa.bInheritHandle = TRUE;
  sa.lpSecurityDescriptor = NULL;

  if (!::CreatePipe(&outrd, &outwr, &sa, 0)) {
    return ::ExitWithWarning(nCmdShow, L"Could not create pipe.");
  }

  if (!::SetHandleInformation(outrd, HANDLE_FLAG_INHERIT, 0)) {
    return ::ExitWithWarning(nCmdShow, L"Could not set handle information.");
  }

  si.cb = sizeof(si);
  si.dwFlags |= STARTF_USESTDHANDLES;
  si.hStdOutput = outwr;
  si.hStdError = outwr;

  std::wstring sourceInsomniaExe = std::wstring(workDir) + L"\\insomnia.dll";
  std::wstring sourceOriginInsomniaExe = std::wstring(workDir) + L"\\Insomnia-origin-" + INSOMNIA_VERSION + L".exe";
  ::DebugLog((L"Source insomnia executable: " + sourceInsomniaExe).c_str());
  ::DebugLog((L"Source origin insomnia executable: " + sourceOriginInsomniaExe).c_str());

  std::wstring tmpExe = std::wstring(workDir) + L"\\insomnia-" + INSOMNIA_VERSION + L".exe";

  // Read installer-info.json from current directory and parse "installer" key
  std::wstring installJsonPath = workDir + L"\\installer-info.json";
  ::DebugLog((L"Reading installer-info.json from: " + installJsonPath).c_str());

  // Variable to mark if installer is nsis
  bool isNsisInstaller = false;

  HANDLE hFile = ::CreateFileW(installJsonPath.c_str(), GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
  if (hFile == INVALID_HANDLE_VALUE) {
    ::DebugLog(L"installer-info.json not found or cannot be opened.");
  } else {
    // if the file exists, we assume it's an NSIS installer
    ::DebugLog(L"installer is nsis in installer-info.json");
    isNsisInstaller = true;
    ::CloseHandle(hFile);
  }

  // if the file already exists, continue as normal since another instance of Insomnia
  // is likely already running
  if (!isNsisInstaller) {
    ::DebugLog(L"Installer is not nsis, checking for existing executable.");
    DWORD attrs = ::GetFileAttributesW(tmpExe.c_str());
    if (attrs != INVALID_FILE_ATTRIBUTES && !(attrs & FILE_ATTRIBUTE_DIRECTORY)) {
      ::DebugLog(L"File already exists, skipping copy.");
    } else {
      // if it's a directory, then exit and prompt the user to uninstall
      if (attrs != INVALID_FILE_ATTRIBUTES) {
        ::DebugLog(L"File is a directory, exiting.");
        return ::ExitWithWarning(nCmdShow, L"Insomnia installation is corrupted. Please reinstall.");
      }

      ::DebugLog((L"Copying insomnia executable to: " + tmpExe).c_str());
      // create the insomnia-$VERSION.exe file
      if (!::CopyFileW(sourceInsomniaExe.c_str(), tmpExe.c_str(), FALSE)) {
        ::DebugLog(L"Could not copy file.");
        return ::ExitWithWarning(nCmdShow, L"Cannot read or write to executable folder.");
      }
      ::DebugLog(L"File copied.");
    }
  }

  std::wstring exePath;
  if (!isNsisInstaller) {
    exePath = QuotePathIfNeeded(tmpExe);
  } else {
    exePath = QuotePathIfNeeded(sourceOriginInsomniaExe);
  }

  if (!::CreateProcessW(0, &exePath[0], 0, 0, TRUE, 0, 0, workDir.c_str(), &si, &pi)) {
    ::DebugLog((L"Could not create process with command: " + exePath).c_str());
    ::CloseHandle(outrd);
    ::CloseHandle(outwr);
    return ::ExitWithWarning(nCmdShow, L"Unable to Launch Insomnia.");
  }
  ::DebugLog(L"Process created.");

  // yes, close the write handle here, trust me
  ::CloseHandle(outwr);

  // loops until the pipe is closed because the write handle is closed
  while (::ReadFile(outrd, outBuf, sizeof(outBuf) - 1, &outRead, NULL) && outRead > 0) {
    ::WriteFile(::GetStdHandle(STD_OUTPUT_HANDLE), outBuf, outRead, NULL, NULL);
  }

  // no more to read
  ::CloseHandle(outrd);

  // wait for the process to finish (probably arlready done since the read
  // handle is not readable)
  ::WaitForSingleObject(pi.hProcess, INFINITE);

  // release the handles
  ::CloseHandle(pi.hProcess);
  ::CloseHandle(pi.hThread);

  // finally, delete the insomnia-$VERSION.exe file after waiting up to 5s for
  // the handle to fully release
  if (!isNsisInstaller) {
    DWORD attrs = ::GetFileAttributesW(tmpExe.c_str());
    if (attrs != INVALID_FILE_ATTRIBUTES && !(attrs & FILE_ATTRIBUTE_DIRECTORY)) {
      for (int i = 1; i < 5; i++) {
        Sleep(1000);
        ::DebugLog((std::wstring(L"Attempt ") + std::to_wstring(i) + L" to delete " + tmpExe).c_str());
        if (::DeleteFileW(tmpExe.c_str())) {
          ::DebugLog(L"File deleted.");
          break;
        }
        DWORD lastErr = ::GetLastError();
        ::DebugLog((L"Failed to delete file: " + tmpExe).c_str());
        ::DebugLog((L"Return value: " + std::to_wstring(lastErr)).c_str());
      }
    }
  }

  return 0;
}
