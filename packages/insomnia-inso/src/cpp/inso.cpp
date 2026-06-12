// NOTE: The calls in this wrapper are only supported on Windows >= 8.
#define _WIN32_WINNT 0x602

#include <string>
#include <windows.h>

int main() {
  // Apply process mitigation policies before any further DLL loading occurs.
  // PreferSystem32Images is inherited by child processes, so inso-node.exe is
  // also protected without needing its own policy setup.

  ::PROCESS_MITIGATION_POLICY psp = ::ProcessSignaturePolicy;
  ::PROCESS_MITIGATION_POLICY pilp = ::ProcessImageLoadPolicy;
  ::PROCESS_MITIGATION_BINARY_SIGNATURE_POLICY pmbsp;
  ::PROCESS_MITIGATION_IMAGE_LOAD_POLICY pmilp;

  if (!::GetProcessMitigationPolicy(::GetCurrentProcess(), psp, &pmbsp, sizeof(pmbsp))) {
    ::WriteFile(::GetStdHandle(STD_ERROR_HANDLE),
                "inso: could not get ProcessSignaturePolicy\n", 44, NULL, NULL);
    return 1;
  }
  if (pmbsp.MitigationOptIn == 0) {
    pmbsp.MitigationOptIn = 1;
    if (!::SetProcessMitigationPolicy(psp, &pmbsp, sizeof(pmbsp))) {
      ::WriteFile(::GetStdHandle(STD_ERROR_HANDLE),
                  "inso: could not set ProcessSignaturePolicy\n", 44, NULL, NULL);
      return 1;
    }
  }

  if (!::GetProcessMitigationPolicy(::GetCurrentProcess(), pilp, &pmilp, sizeof(pmilp))) {
    ::WriteFile(::GetStdHandle(STD_ERROR_HANDLE),
                "inso: could not get ProcessImageLoadPolicy\n", 44, NULL, NULL);
    return 1;
  }
  if (pmilp.PreferSystem32Images == 0) {
    pmilp.PreferSystem32Images = 1;
    if (!::SetProcessMitigationPolicy(pilp, &pmilp, sizeof(pmilp))) {
      ::WriteFile(::GetStdHandle(STD_ERROR_HANDLE),
                  "inso: could not set ProcessImageLoadPolicy\n", 44, NULL, NULL);
      return 1;
    }
  }

  // Resolve the path to inso-node.exe (same directory as this wrapper).
  wchar_t wrapperPath[MAX_PATH];
  ::GetModuleFileNameW(NULL, wrapperPath, MAX_PATH);
  std::wstring dir(wrapperPath);
  dir = dir.substr(0, dir.find_last_of(L"\\"));
  std::wstring innerExe = dir + L"\\inso-node.dll";

  // Rebuild the command line, replacing argv[0] (this wrapper) with inso-node.exe.
  // GetCommandLineW() returns the full command line including the wrapper's path,
  // which may be quoted. We skip past that first token to get the remaining args.
  LPWSTR origCmd = ::GetCommandLineW();
  LPWSTR argsStart = origCmd;

  if (*argsStart == L'"') {
    argsStart++; // skip opening quote
    while (*argsStart && *argsStart != L'"') argsStart++;
    if (*argsStart == L'"') argsStart++; // skip closing quote
  } else {
    while (*argsStart && *argsStart != L' ') argsStart++;
  }

  // argsStart now points to " arg1 arg2 ..." or an empty string.
  std::wstring cmdLine = L"\"" + innerExe + L"\"" + std::wstring(argsStart);

  ::STARTUPINFOW si;
  ::PROCESS_INFORMATION pi;
  ::ZeroMemory(&si, sizeof(si));
  ::ZeroMemory(&pi, sizeof(pi));

  si.cb = sizeof(si);
  si.dwFlags = STARTF_USESTDHANDLES;
  si.hStdInput = ::GetStdHandle(STD_INPUT_HANDLE);
  si.hStdOutput = ::GetStdHandle(STD_OUTPUT_HANDLE);
  si.hStdError = ::GetStdHandle(STD_ERROR_HANDLE);

  if (!::CreateProcessW(NULL, &cmdLine[0], NULL, NULL, TRUE, 0, NULL, NULL, &si, &pi)) {
    const char *msg = "inso: could not launch inso-node.dll\n";
    ::WriteFile(::GetStdHandle(STD_ERROR_HANDLE), msg, 37, NULL, NULL);
    return 1;
  }

  ::WaitForSingleObject(pi.hProcess, INFINITE);

  DWORD exitCode = 1;
  ::GetExitCodeProcess(pi.hProcess, &exitCode);

  ::CloseHandle(pi.hProcess);
  ::CloseHandle(pi.hThread);

  return static_cast<int>(exitCode);
}
