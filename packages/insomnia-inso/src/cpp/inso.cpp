// NOTE: The mitigation calls in this wrapper are only supported on Windows >= 8.
#define _WIN32_WINNT 0x602
#define __INSO_RELAY_BUFFER_SIZE 8192

#include <windows.h>
#include <softpub.h>
#include <wincrypt.h>
#include <wintrust.h>

#include <iostream>
#include <memory>
#include <string>
#include <vector>

const wchar_t *INSO_VERSION = L"__VERSION__";
// Expected substring in the signer name of the payload this wrapper launches; injected at build time.
const wchar_t *INSO_EXPECTED_SIGNER = L"__SIGNER__";

// Owns a Windows HANDLE and closes it on scope exit; move-only to avoid double-close.
class ScopedHandle {
 public:
  ScopedHandle() : handle_(nullptr) {}
  explicit ScopedHandle(HANDLE h) : handle_(h) {}
  ~ScopedHandle() { Reset(); }
  ScopedHandle(const ScopedHandle &) = delete;
  ScopedHandle &operator=(const ScopedHandle &) = delete;
  ScopedHandle(ScopedHandle &&other) noexcept : handle_(other.handle_) { other.handle_ = nullptr; }
  ScopedHandle &operator=(ScopedHandle &&other) noexcept {
    if (this != &other) {
      Reset();
      handle_ = other.handle_;
      other.handle_ = nullptr;
    }
    return *this;
  }

  void Reset(HANDLE h = nullptr) {
    if (handle_ != nullptr && handle_ != INVALID_HANDLE_VALUE) {
      ::CloseHandle(handle_);
    }
    handle_ = h;
  }

  HANDLE Get() const { return handle_; }
  HANDLE Release() {
    HANDLE h = handle_;
    handle_ = nullptr;
    return h;
  }
  explicit operator bool() const { return handle_ != nullptr && handle_ != INVALID_HANDLE_VALUE; }

 private:
  HANDLE handle_;
};

std::string NarrowUtf8(const std::wstring &wide) {
  if (wide.empty()) {
    return std::string();
  }
  int size = ::WideCharToMultiByte(CP_UTF8, 0, wide.c_str(), -1, NULL, 0, NULL, NULL);
  if (size <= 0) {
    return std::string();
  }
  std::string narrow(size - 1, '\0');
  ::WideCharToMultiByte(CP_UTF8, 0, wide.c_str(), -1, narrow.empty() ? nullptr : &narrow[0], size, NULL, NULL);
  return narrow;
}

int ExitWithError(const std::string &message) {
  std::cerr << "inso: " << message << std::endl;
  return 1;
}

bool PathHasSpace(const std::wstring &path) { return path.find(L' ') != std::wstring::npos; }

std::wstring QuotePathIfNeeded(const std::wstring &path) {
  return PathHasSpace(path) ? L"\"" + path + L"\"" : path;
}

// Applies the same DLL search-order mitigations as the GUI's secure wrapper: prefer System32 images
// over ones found via the default (attacker-writable current directory) search order.
bool ApplyMitigations() {
  PROCESS_MITIGATION_BINARY_SIGNATURE_POLICY signaturePolicy = {};
  if (!::GetProcessMitigationPolicy(::GetCurrentProcess(), ProcessSignaturePolicy, &signaturePolicy,
                                     sizeof(signaturePolicy))) {
    return false;
  }
  if (signaturePolicy.MitigationOptIn == 0) {
    signaturePolicy.MitigationOptIn = 1;
    if (!::SetProcessMitigationPolicy(ProcessSignaturePolicy, &signaturePolicy, sizeof(signaturePolicy))) {
      return false;
    }
  }

  PROCESS_MITIGATION_IMAGE_LOAD_POLICY imageLoadPolicy = {};
  if (!::GetProcessMitigationPolicy(::GetCurrentProcess(), ProcessImageLoadPolicy, &imageLoadPolicy,
                                     sizeof(imageLoadPolicy))) {
    return false;
  }
  if (imageLoadPolicy.PreferSystem32Images == 0) {
    imageLoadPolicy.PreferSystem32Images = 1;
    if (!::SetProcessMitigationPolicy(ProcessImageLoadPolicy, &imageLoadPolicy, sizeof(imageLoadPolicy))) {
      return false;
    }
  }
  return true;
}

// Verifies filePath has a valid Authenticode signature matching expectedSignerSubstring, guarding
// against an attacker with write access to this directory simply replacing the payload outright.
bool VerifySignedBy(const std::wstring &filePath, const std::wstring &expectedSignerSubstring) {
  WINTRUST_FILE_INFO fileInfo = {};
  fileInfo.cbStruct = sizeof(fileInfo);
  fileInfo.pcwszFilePath = filePath.c_str();

  GUID policy = WINTRUST_ACTION_GENERIC_VERIFY_V2;
  WINTRUST_DATA trustData = {};
  trustData.cbStruct = sizeof(trustData);
  trustData.dwUIChoice = WTD_UI_NONE;
  trustData.fdwRevocationChecks = WTD_REVOKE_NONE;
  trustData.dwUnionChoice = WTD_CHOICE_FILE;
  trustData.dwStateAction = WTD_STATEACTION_VERIFY;
  trustData.pFile = &fileInfo;

  LONG status = ::WinVerifyTrust(NULL, &policy, &trustData);
  bool trusted = (status == ERROR_SUCCESS);
  bool signerMatches = expectedSignerSubstring.empty();

  if (trusted && !signerMatches) {
    CRYPT_PROVIDER_DATA const *provData = ::WTHelperProvDataFromStateData(trustData.hWVTStateData);
    if (provData != NULL) {
      CRYPT_PROVIDER_SGNR *signer =
          ::WTHelperGetProvSignerFromChain(const_cast<CRYPT_PROVIDER_DATA *>(provData), 0, FALSE, 0);
      if (signer != NULL && signer->csCertChain > 0) {
        PCCERT_CONTEXT certContext = signer->pasCertChain[0].pCert;
        wchar_t nameBuf[512] = {};
        DWORD nameLen = ::CertGetNameStringW(certContext, CERT_NAME_SIMPLE_DISPLAY_TYPE, 0, NULL, nameBuf,
                                              _countof(nameBuf));
        if (nameLen > 1 && std::wstring(nameBuf).find(expectedSignerSubstring) != std::wstring::npos) {
          signerMatches = true;
        }
      }
    }
  }

  trustData.dwStateAction = WTD_STATEACTION_CLOSE;
  ::WinVerifyTrust(NULL, &policy, &trustData);

  return trusted && signerMatches;
}

// Mirrors how the CRT/CommandLineToArgvW parse argv[0]: a leading quoted token runs to the next
// quote, otherwise to the next whitespace. Returns everything after argv[0], with leading whitespace stripped.
std::wstring GetArgsAfterArgv0() {
  const wchar_t *p = ::GetCommandLineW();
  if (*p == L'"') {
    ++p;
    while (*p != L'\0' && *p != L'"') ++p;
    if (*p == L'"') ++p;
  } else {
    while (*p != L'\0' && *p != L' ' && *p != L'\t') ++p;
  }
  while (*p == L' ' || *p == L'\t') ++p;
  return std::wstring(p);
}

struct RelayJob {
  HANDLE src;
  HANDLE dst;
  bool closeDstOnEof;
};

// Pumps bytes from src to dst until EOF/error; used for stdin-in and stdout/stderr-drain relays.
DWORD WINAPI RelayThread(LPVOID param) {
  std::unique_ptr<RelayJob> job(static_cast<RelayJob *>(param));
  char buffer[__INSO_RELAY_BUFFER_SIZE];
  DWORD bytesRead = 0;

  while (::ReadFile(job->src, buffer, sizeof(buffer), &bytesRead, NULL) && bytesRead > 0) {
    DWORD totalWritten = 0;
    while (totalWritten < bytesRead) {
      DWORD bytesWritten = 0;
      if (!::WriteFile(job->dst, buffer + totalWritten, bytesRead - totalWritten, &bytesWritten, NULL)) {
        if (job->closeDstOnEof) {
          ::CloseHandle(job->dst);
        }
        return 0;
      }
      totalWritten += bytesWritten;
    }
  }

  if (job->closeDstOnEof) {
    ::CloseHandle(job->dst);
  }
  return 0;
}

ScopedHandle StartRelayThread(HANDLE src, HANDLE dst, bool closeDstOnEof) {
  auto job = std::make_unique<RelayJob>(RelayJob{src, dst, closeDstOnEof});
  HANDLE thread = ::CreateThread(NULL, 0, RelayThread, job.release(), 0, NULL);
  return ScopedHandle(thread);
}

int wmain() {
  if (!ApplyMitigations()) {
    return ExitWithError("failed to apply Windows process mitigation policy; refusing to start.");
  }

  wchar_t selfPath[MAX_PATH];
  DWORD selfPathLen = ::GetModuleFileNameW(NULL, selfPath, _countof(selfPath));
  if (selfPathLen == 0 || selfPathLen == _countof(selfPath)) {
    return ExitWithError("failed to resolve own executable path.");
  }

  std::wstring workDir(selfPath);
  size_t lastSlash = workDir.find_last_of(L"\\");
  if (lastSlash == std::wstring::npos) {
    return ExitWithError("could not determine installation directory.");
  }
  workDir = workDir.substr(0, lastSlash);

  std::wstring payloadPath = workDir + L"\\inso-core-" + INSO_VERSION + L".exe";

  // Diagnostic only: WinVerifyTrust/CreateProcessW below independently re-resolve the path.
  if (::GetFileAttributesW(payloadPath.c_str()) == INVALID_FILE_ATTRIBUTES) {
    return ExitWithError("could not locate " + NarrowUtf8(payloadPath) +
                          " alongside inso.exe; both files must be copied together.");
  }

  if (!VerifySignedBy(payloadPath, INSO_EXPECTED_SIGNER)) {
    return ExitWithError("signature verification failed for " + NarrowUtf8(payloadPath) +
                          "; refusing to launch a potentially tampered binary.");
  }

  SECURITY_ATTRIBUTES sa = {};
  sa.nLength = sizeof(sa);
  sa.bInheritHandle = TRUE;

  HANDLE stdinReadForChild, stdinWriteForParent;
  HANDLE stdoutReadForParent, stdoutWriteForChild;
  HANDLE stderrReadForParent, stderrWriteForChild;

  if (!::CreatePipe(&stdinReadForChild, &stdinWriteForParent, &sa, 0) ||
      !::CreatePipe(&stdoutReadForParent, &stdoutWriteForChild, &sa, 0) ||
      !::CreatePipe(&stderrReadForParent, &stderrWriteForChild, &sa, 0)) {
    return ExitWithError("could not create redirection pipes.");
  }

  ScopedHandle childStdin(stdinReadForChild);
  ScopedHandle parentStdinWrite(stdinWriteForParent);
  ScopedHandle parentStdoutRead(stdoutReadForParent);
  ScopedHandle childStdoutWrite(stdoutWriteForChild);
  ScopedHandle parentStderrRead(stderrReadForParent);
  ScopedHandle childStderrWrite(stderrWriteForChild);

  if (!::SetHandleInformation(parentStdinWrite.Get(), HANDLE_FLAG_INHERIT, 0) ||
      !::SetHandleInformation(parentStdoutRead.Get(), HANDLE_FLAG_INHERIT, 0) ||
      !::SetHandleInformation(parentStderrRead.Get(), HANDLE_FLAG_INHERIT, 0)) {
    return ExitWithError("could not set handle inheritance information.");
  }

  STARTUPINFOW si = {};
  si.cb = sizeof(si);
  si.dwFlags |= STARTF_USESTDHANDLES;
  si.hStdInput = childStdin.Get();
  si.hStdOutput = childStdoutWrite.Get();
  si.hStdError = childStderrWrite.Get();

  std::wstring commandLine = QuotePathIfNeeded(payloadPath) + L" " + GetArgsAfterArgv0();
  std::vector<wchar_t> commandLineBuffer(commandLine.begin(), commandLine.end());
  commandLineBuffer.push_back(L'\0');

  PROCESS_INFORMATION pi = {};
  BOOL created = ::CreateProcessW(NULL, commandLineBuffer.data(), NULL, NULL, /*bInheritHandles=*/TRUE, 0, NULL,
                                   workDir.c_str(), &si, &pi);
  if (!created) {
    return ExitWithError("unable to launch " + NarrowUtf8(payloadPath) + ".");
  }
  ScopedHandle processHandle(pi.hProcess);
  ScopedHandle threadHandle(pi.hThread);

  // These handles now belong solely to the child; the parent's copies must be closed so EOF/pipe
  // signaling works correctly.
  childStdin.Reset();
  childStdoutWrite.Reset();
  childStderrWrite.Reset();

  // Not joined: if stdin is an interactive console with no more input, this thread would block
  // forever after the child exits; process exit tears it down along with everything else.
  StartRelayThread(::GetStdHandle(STD_INPUT_HANDLE), parentStdinWrite.Release(), /*closeDstOnEof=*/true);

  ScopedHandle stdoutDrain = StartRelayThread(parentStdoutRead.Get(), ::GetStdHandle(STD_OUTPUT_HANDLE), false);
  ScopedHandle stderrDrain = StartRelayThread(parentStderrRead.Get(), ::GetStdHandle(STD_ERROR_HANDLE), false);

  ::WaitForSingleObject(processHandle.Get(), INFINITE);

  DWORD exitCode = 1;
  ::GetExitCodeProcess(processHandle.Get(), &exitCode);

  // Give the drain threads a bounded window to flush any output still buffered in the pipes.
  HANDLE drainHandles[] = {stdoutDrain.Get(), stderrDrain.Get()};
  ::WaitForMultipleObjects(2, drainHandles, TRUE, 5000);

  return static_cast<int>(exitCode);
}
