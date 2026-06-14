/* NOTE: Requires Windows >= 8 (0x0602) for SetProcessMitigationPolicy.
   Compiled with -nostdlib so the only import is KERNEL32.dll — no msvcrt.dll
   CRT init that would transitively pull in advapi32 -> cryptbase (sideload vector). */
#define _WIN32_WINNT 0x0602
#define WIN32_LEAN_AND_MEAN
#include <windows.h>

/* Custom entry point — bypasses msvcrt CRT startup entirely. */
void __cdecl WinMainCRTStartup(void) {
  /* Apply process mitigation policies.
     PreferSystem32Images is inherited by child processes, so inso-node.dll is
     also protected without needing its own policy setup. */
  PROCESS_MITIGATION_BINARY_SIGNATURE_POLICY pmbsp;
  PROCESS_MITIGATION_IMAGE_LOAD_POLICY pmilp;

  if (!GetProcessMitigationPolicy(GetCurrentProcess(), ProcessSignaturePolicy,
                                  &pmbsp, sizeof(pmbsp))) {
    const char msg[] = "inso: could not get ProcessSignaturePolicy\n";
    DWORD written;
    WriteFile(GetStdHandle(STD_ERROR_HANDLE), msg, sizeof(msg) - 1, &written, NULL);
    ExitProcess(1);
  }
  if (pmbsp.MitigationOptIn == 0) {
    pmbsp.MitigationOptIn = 1;
    if (!SetProcessMitigationPolicy(ProcessSignaturePolicy, &pmbsp, sizeof(pmbsp))) {
      const char msg[] = "inso: could not set ProcessSignaturePolicy\n";
      DWORD written;
      WriteFile(GetStdHandle(STD_ERROR_HANDLE), msg, sizeof(msg) - 1, &written, NULL);
      ExitProcess(1);
    }
  }

  if (!GetProcessMitigationPolicy(GetCurrentProcess(), ProcessImageLoadPolicy,
                                  &pmilp, sizeof(pmilp))) {
    const char msg[] = "inso: could not get ProcessImageLoadPolicy\n";
    DWORD written;
    WriteFile(GetStdHandle(STD_ERROR_HANDLE), msg, sizeof(msg) - 1, &written, NULL);
    ExitProcess(1);
  }
  if (pmilp.PreferSystem32Images == 0) {
    pmilp.PreferSystem32Images = 1;
    if (!SetProcessMitigationPolicy(ProcessImageLoadPolicy, &pmilp, sizeof(pmilp))) {
      const char msg[] = "inso: could not set ProcessImageLoadPolicy\n";
      DWORD written;
      WriteFile(GetStdHandle(STD_ERROR_HANDLE), msg, sizeof(msg) - 1, &written, NULL);
      ExitProcess(1);
    }
  }

  /* Resolve path to inso-node.dll (same directory as this wrapper).
     All string ops use only KERNEL32 APIs — no msvcrt / CRT dependency. */
  wchar_t wrapperPath[MAX_PATH];
  GetModuleFileNameW(NULL, wrapperPath, MAX_PATH);

  /* Find the last backslash to isolate the directory. */
  int dirLen = 0;
  for (int i = 0; wrapperPath[i] != L'\0'; i++) {
    if (wrapperPath[i] == L'\\') dirLen = i;
  }

  /* Build the full path to inso-node.dll. */
  const wchar_t innerName[] = L"\\inso-node.dll";
  wchar_t innerPath[MAX_PATH];
  for (int i = 0; i < dirLen; i++) innerPath[i] = wrapperPath[i];
  for (int i = 0; innerName[i] != L'\0'; i++) innerPath[dirLen + i] = innerName[i];
  innerPath[dirLen + (sizeof(innerName) / sizeof(wchar_t)) - 1] = L'\0';

  /* Build the new command line: "innerPath" <original args after argv[0]> */
  LPWSTR origCmd = GetCommandLineW();
  LPWSTR argsStart = origCmd;

  if (*argsStart == L'"') {
    argsStart++;
    while (*argsStart && *argsStart != L'"') argsStart++;
    if (*argsStart == L'"') argsStart++;
  } else {
    while (*argsStart && *argsStart != L' ') argsStart++;
  }

  /* Compute lengths for the final command line buffer. */
  int innerLen = 0;
  while (innerPath[innerLen] != L'\0') innerLen++;
  int argsLen = 0;
  while (argsStart[argsLen] != L'\0') argsLen++;

  /* cmdLine = '"' + innerPath + '"' + argsStart + NUL */
  int cmdLen = 1 + innerLen + 1 + argsLen + 1;
  wchar_t *cmdLine = (wchar_t *)HeapAlloc(GetProcessHeap(), 0, cmdLen * sizeof(wchar_t));
  if (!cmdLine) ExitProcess(1);

  int pos = 0;
  cmdLine[pos++] = L'"';
  for (int i = 0; i < innerLen; i++) cmdLine[pos++] = innerPath[i];
  cmdLine[pos++] = L'"';
  for (int i = 0; i < argsLen; i++) cmdLine[pos++] = argsStart[i];
  cmdLine[pos] = L'\0';

  STARTUPINFOW si;
  PROCESS_INFORMATION pi;
  ZeroMemory(&si, sizeof(si));
  ZeroMemory(&pi, sizeof(pi));

  si.cb = sizeof(si);
  si.dwFlags = STARTF_USESTDHANDLES;
  si.hStdInput  = GetStdHandle(STD_INPUT_HANDLE);
  si.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
  si.hStdError  = GetStdHandle(STD_ERROR_HANDLE);

  if (!CreateProcessW(NULL, cmdLine, NULL, NULL, TRUE, 0, NULL, NULL, &si, &pi)) {
    const char msg[] = "inso: could not launch inso-node.dll\n";
    DWORD written;
    WriteFile(GetStdHandle(STD_ERROR_HANDLE), msg, sizeof(msg) - 1, &written, NULL);
    HeapFree(GetProcessHeap(), 0, cmdLine);
    ExitProcess(1);
  }

  HeapFree(GetProcessHeap(), 0, cmdLine);

  WaitForSingleObject(pi.hProcess, INFINITE);

  DWORD exitCode = 1;
  GetExitCodeProcess(pi.hProcess, &exitCode);

  CloseHandle(pi.hProcess);
  CloseHandle(pi.hThread);

  ExitProcess(exitCode);
}
