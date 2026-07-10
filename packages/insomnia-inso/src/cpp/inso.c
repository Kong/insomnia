/* Requires Windows >= 8 (0x0602) for SetProcessMitigationPolicy.
   Compiled -nostdlib with a custom entry point: the only static import is KERNEL32.dll.
   No CRT init means nothing (iostream, locale setup, etc.) can trigger a DLL load of its
   own before ApplyMitigations() runs — that CRT-init window is exactly what let a planted
   dbghelp.dll load successfully in an earlier iostream-based build of this wrapper. */
#define WIN32_LEAN_AND_MEAN
#define INITGUID
#include <windows.h>
#include <guiddef.h>
#include <softpub.h>
#include <wintrust.h>
#include <wincrypt.h>

static const wchar_t EXPECTED_SIGNER[] = L"Kong";

void *memset(void *dst, int c, SIZE_T n) {
  volatile unsigned char *p = (volatile unsigned char *)dst;
  while (n--) *p++ = (unsigned char)c;
  return dst;
}
void *memcpy(void *dst, const void *src, SIZE_T n) {
  unsigned char *d = (unsigned char *)dst;
  const unsigned char *s = (const unsigned char *)src;
  while (n--) *d++ = *s++;
  return dst;
}

static void PrintErr(const char *a, const char *b) {
  DWORD written;
  HANDLE err = GetStdHandle(STD_ERROR_HANDLE);
  WriteFile(err, "inso: ", 6, &written, NULL);
  WriteFile(err, a, lstrlenA(a), &written, NULL);
  if (b) {
    WriteFile(err, b, lstrlenA(b), &written, NULL);
  }
  WriteFile(err, "\r\n", 2, &written, NULL);
}

/* Sets the same two mitigations as the GUI's secure wrapper, first thing on process start. */
static int ApplyMitigations(void) {
  PROCESS_MITIGATION_BINARY_SIGNATURE_POLICY sigPolicy;
  PROCESS_MITIGATION_IMAGE_LOAD_POLICY imgPolicy;
  ZeroMemory(&sigPolicy, sizeof(sigPolicy));
  ZeroMemory(&imgPolicy, sizeof(imgPolicy));

  if (!GetProcessMitigationPolicy(GetCurrentProcess(), ProcessSignaturePolicy, &sigPolicy, sizeof(sigPolicy))) {
    return 0;
  }
  if (sigPolicy.MitigationOptIn == 0) {
    sigPolicy.MitigationOptIn = 1;
    if (!SetProcessMitigationPolicy(ProcessSignaturePolicy, &sigPolicy, sizeof(sigPolicy))) {
      return 0;
    }
  }

  if (!GetProcessMitigationPolicy(GetCurrentProcess(), ProcessImageLoadPolicy, &imgPolicy, sizeof(imgPolicy))) {
    return 0;
  }
  if (imgPolicy.PreferSystem32Images == 0) {
    imgPolicy.PreferSystem32Images = 1;
    if (!SetProcessMitigationPolicy(ProcessImageLoadPolicy, &imgPolicy, sizeof(imgPolicy))) {
      return 0;
    }
  }
  return 1;
}

static int WStrContains(const wchar_t *haystack, const wchar_t *needle) {
  int i, j;
  if (!*needle) {
    return 1;
  }
  for (i = 0; haystack[i]; i++) {
    for (j = 0; needle[j] && haystack[i + j] == needle[j]; j++) {
    }
    if (!needle[j]) {
      return 1;
    }
  }
  return 0;
}

typedef LONG(WINAPI *PFN_WinVerifyTrust)(HWND, GUID *, LPVOID);
typedef CRYPT_PROVIDER_DATA *(WINAPI *PFN_WTHelperProvDataFromStateData)(HANDLE);
typedef CRYPT_PROVIDER_SGNR *(WINAPI *PFN_WTHelperGetProvSignerFromChain)(CRYPT_PROVIDER_DATA *, DWORD, BOOL, DWORD);
typedef DWORD(WINAPI *PFN_CertGetNameStringW)(PCCERT_CONTEXT, DWORD, DWORD, void *, LPWSTR, DWORD);

/* wintrust.dll/crypt32.dll are loaded dynamically, and only after ApplyMitigations() has
   already succeeded, so PreferSystem32Images protects these loads (and everything they
   transitively depend on) too — no static import table entry for either DLL exists. */
static int VerifySignedBy(const wchar_t *filePath, const wchar_t *expectedSignerSubstring) {
  HMODULE hWintrust, hCrypt32;
  PFN_WinVerifyTrust pWinVerifyTrust;
  PFN_WTHelperProvDataFromStateData pProvData;
  PFN_WTHelperGetProvSignerFromChain pProvSigner;
  PFN_CertGetNameStringW pCertGetNameStringW;
  WINTRUST_FILE_INFO fileInfo;
  WINTRUST_DATA trustData;
  GUID policy = WINTRUST_ACTION_GENERIC_VERIFY_V2;
  LONG status;
  int trusted, signerMatches;

  hWintrust = LoadLibraryW(L"wintrust.dll");
  hCrypt32 = LoadLibraryW(L"crypt32.dll");
  if (!hWintrust || !hCrypt32) {
    return 0;
  }

  pWinVerifyTrust = (PFN_WinVerifyTrust)GetProcAddress(hWintrust, "WinVerifyTrust");
  pProvData = (PFN_WTHelperProvDataFromStateData)GetProcAddress(hWintrust, "WTHelperProvDataFromStateData");
  pProvSigner = (PFN_WTHelperGetProvSignerFromChain)GetProcAddress(hWintrust, "WTHelperGetProvSignerFromChain");
  pCertGetNameStringW = (PFN_CertGetNameStringW)GetProcAddress(hCrypt32, "CertGetNameStringW");
  if (!pWinVerifyTrust || !pProvData || !pProvSigner || !pCertGetNameStringW) {
    return 0;
  }

  ZeroMemory(&fileInfo, sizeof(fileInfo));
  fileInfo.cbStruct = sizeof(fileInfo);
  fileInfo.pcwszFilePath = filePath;

  ZeroMemory(&trustData, sizeof(trustData));
  trustData.cbStruct = sizeof(trustData);
  trustData.dwUIChoice = WTD_UI_NONE;
  trustData.fdwRevocationChecks = WTD_REVOKE_NONE;
  trustData.dwUnionChoice = WTD_CHOICE_FILE;
  trustData.dwStateAction = WTD_STATEACTION_VERIFY;
  trustData.pFile = &fileInfo;

  status = pWinVerifyTrust(NULL, &policy, &trustData);
  trusted = (status == ERROR_SUCCESS);
  signerMatches = !*expectedSignerSubstring;

  if (trusted && !signerMatches) {
    CRYPT_PROVIDER_DATA *provData = pProvData(trustData.hWVTStateData);
    if (provData) {
      CRYPT_PROVIDER_SGNR *signer = pProvSigner(provData, 0, FALSE, 0);
      if (signer && signer->csCertChain > 0) {
        PCCERT_CONTEXT cert = signer->pasCertChain[0].pCert;
        wchar_t nameBuf[512];
        DWORD nameLen = pCertGetNameStringW(cert, CERT_NAME_SIMPLE_DISPLAY_TYPE, 0, NULL, nameBuf, 512);
        if (nameLen > 1 && WStrContains(nameBuf, expectedSignerSubstring)) {
          signerMatches = 1;
        }
      }
    }
  }

  trustData.dwStateAction = WTD_STATEACTION_CLOSE;
  pWinVerifyTrust(NULL, &policy, &trustData);

  return trusted && signerMatches;
}

/* Custom PE entry point — bypasses CRT startup entirely. Never returns; always ExitProcess(). */
void __cdecl EntryPoint(void) {
  wchar_t selfPath[MAX_PATH];
  wchar_t workDir[MAX_PATH];
  wchar_t payloadPath[MAX_PATH];
  DWORD selfPathLen, dirLen, payloadLen, innerLen, argsLen, cmdLen, i;
  int lastSlash;
  const wchar_t innerName[] = L"\\inso-node.dll";
  LPWSTR origCmd, argsStart;
  wchar_t *cmdLine;
  STARTUPINFOW si;
  PROCESS_INFORMATION pi;
  DWORD exitCode;

  if (!ApplyMitigations()) {
    PrintErr("failed to apply Windows process mitigation policy; refusing to start.", NULL);
    ExitProcess(1);
  }

  selfPathLen = GetModuleFileNameW(NULL, selfPath, MAX_PATH);
  if (selfPathLen == 0 || selfPathLen == MAX_PATH) {
    PrintErr("failed to resolve own executable path.", NULL);
    ExitProcess(1);
  }

  lastSlash = -1;
  for (i = 0; i < selfPathLen; i++) {
    if (selfPath[i] == L'\\') {
      lastSlash = (int)i;
    }
  }
  if (lastSlash < 0) {
    PrintErr("could not determine installation directory.", NULL);
    ExitProcess(1);
  }
  dirLen = (DWORD)lastSlash;
  for (i = 0; i < dirLen; i++) {
    workDir[i] = selfPath[i];
  }
  workDir[dirLen] = L'\0';

  innerLen = 0;
  while (innerName[innerLen]) {
    innerLen++;
  }
  payloadLen = dirLen + innerLen;
  if (payloadLen >= MAX_PATH) {
    PrintErr("installation path too long.", NULL);
    ExitProcess(1);
  }
  for (i = 0; i < dirLen; i++) {
    payloadPath[i] = workDir[i];
  }
  for (i = 0; i < innerLen; i++) {
    payloadPath[dirLen + i] = innerName[i];
  }
  payloadPath[payloadLen] = L'\0';

  /* Diagnostic only: VerifySignedBy/CreateProcessW below independently re-resolve the path. */
  if (GetFileAttributesW(payloadPath) == INVALID_FILE_ATTRIBUTES) {
    PrintErr("could not locate inso-node.dll alongside inso.exe; both files must be copied together.", NULL);
    ExitProcess(1);
  }

  if (!VerifySignedBy(payloadPath, EXPECTED_SIGNER)) {
    PrintErr("signature verification failed for the inso payload; refusing to launch a potentially tampered binary.", NULL);
    ExitProcess(1);
  }

  origCmd = GetCommandLineW();
  argsStart = origCmd;
  if (*argsStart == L'"') {
    argsStart++;
    while (*argsStart && *argsStart != L'"') {
      argsStart++;
    }
    if (*argsStart == L'"') {
      argsStart++;
    }
  } else {
    while (*argsStart && *argsStart != L' ') {
      argsStart++;
    }
  }
  while (*argsStart == L' ') {
    argsStart++;
  }

  argsLen = 0;
  while (argsStart[argsLen]) {
    argsLen++;
  }

  /* cmdLine = '"' + payloadPath + '"' + ' ' + argsStart + NUL */
  cmdLen = 1 + payloadLen + 2 + argsLen + 1;
  cmdLine = (wchar_t *)HeapAlloc(GetProcessHeap(), 0, cmdLen * sizeof(wchar_t));
  if (!cmdLine) {
    PrintErr("out of memory building command line.", NULL);
    ExitProcess(1);
  }
  {
    DWORD pos = 0;
    cmdLine[pos++] = L'"';
    for (i = 0; i < payloadLen; i++) {
      cmdLine[pos++] = payloadPath[i];
    }
    cmdLine[pos++] = L'"';
    if (argsLen > 0) {
      cmdLine[pos++] = L' ';
      for (i = 0; i < argsLen; i++) {
        cmdLine[pos++] = argsStart[i];
      }
    }
    cmdLine[pos] = L'\0';
  }

  ZeroMemory(&si, sizeof(si));
  ZeroMemory(&pi, sizeof(pi));
  si.cb = sizeof(si);
  si.dwFlags = STARTF_USESTDHANDLES;
  si.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
  si.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
  si.hStdError = GetStdHandle(STD_ERROR_HANDLE);

  if (!CreateProcessW(NULL, cmdLine, NULL, NULL, TRUE, 0, NULL, workDir, &si, &pi)) {
    PrintErr("unable to launch inso-node.dll.", NULL);
    HeapFree(GetProcessHeap(), 0, cmdLine);
    ExitProcess(1);
  }
  HeapFree(GetProcessHeap(), 0, cmdLine);

  WaitForSingleObject(pi.hProcess, INFINITE);

  exitCode = 1;
  GetExitCodeProcess(pi.hProcess, &exitCode);

  CloseHandle(pi.hProcess);
  CloseHandle(pi.hThread);

  ExitProcess(exitCode);
}
