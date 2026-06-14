// Hardens the pkg-built Windows inso.exe against DLL sideloading by setting
// DependentLoadFlags = LOAD_LIBRARY_SEARCH_SYSTEM32 (0x0800) in the PE Load
// Config Directory. The Windows loader applies this before resolving the import
// table, so startup DLLs (e.g. cryptbase.dll) resolve from System32 instead of
// the application directory. This is the PE-level equivalent of the MSVC
// /DEPENDENTLOADFLAG:0x800 linker option.
//
// No-ops on non-PE inputs (e.g. the macOS/Linux `inso` binary), so it is safe to
// run unconditionally from `postpackage`.
//
// Usage: node patch-pe.js <path-to-exe>

const fs = require('node:fs');
const path = require('node:path');

const LOAD_LIBRARY_SEARCH_SYSTEM32 = 0x0800;
// IMAGE_DIRECTORY_ENTRY_LOAD_CONFIG
const LOAD_CONFIG_DIRECTORY_INDEX = 10;
// Offset of the DependentLoadFlags WORD inside IMAGE_LOAD_CONFIG_DIRECTORY64
// (follows ProcessHeapFlags DWORD @72 and CSDVersion WORD @76).
const DEPENDENT_LOAD_FLAGS_OFFSET = 78;

const target = path.resolve(process.argv[2] || 'binaries/inso.exe');

function fail(message) {
  console.error(`patch-pe: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(target)) {
  // On macOS/Linux pkg produces `binaries/inso` (not .exe); nothing to patch.
  console.log(`patch-pe: ${target} not found, skipping (non-Windows build)`);
  process.exit(0);
}

const buf = fs.readFileSync(target);

// DOS header: "MZ" magic, e_lfanew (DWORD) at 0x3C points to the PE header.
if (buf.length < 0x40 || buf.readUInt16LE(0) !== 0x5a4d) {
  console.log(`patch-pe: ${target} is not a PE binary, skipping`);
  process.exit(0);
}

const peOffset = buf.readUInt32LE(0x3c);
if (buf.readUInt32LE(peOffset) !== 0x00004550) {
  // "PE\0\0"
  console.log(`patch-pe: ${target} has no PE signature, skipping`);
  process.exit(0);
}

const coffHeaderOffset = peOffset + 4;
const numberOfSections = buf.readUInt16LE(coffHeaderOffset + 2);
const sizeOfOptionalHeader = buf.readUInt16LE(coffHeaderOffset + 16);
const optionalHeaderOffset = coffHeaderOffset + 20;

const magic = buf.readUInt16LE(optionalHeaderOffset);
if (magic !== 0x20b) {
  // 0x20b = PE32+ (64-bit). pkg ships a 64-bit Node; bail loudly otherwise.
  fail(`unexpected optional header magic 0x${magic.toString(16)} (expected PE32+ 0x20b)`);
}

// Data directory array begins 112 bytes into the PE32+ optional header.
// Each entry is { RVA: DWORD, Size: DWORD }.
const dataDirOffset = optionalHeaderOffset + 112 + LOAD_CONFIG_DIRECTORY_INDEX * 8;
const loadConfigRva = buf.readUInt32LE(dataDirOffset);
const loadConfigSize = buf.readUInt32LE(dataDirOffset + 4);

if (loadConfigRva === 0 || loadConfigSize === 0) {
  fail('binary has no Load Config Directory; cannot set DependentLoadFlags');
}

if (loadConfigSize < DEPENDENT_LOAD_FLAGS_OFFSET + 2) {
  fail(
    `Load Config Directory size (${loadConfigSize}) is too small to contain ` +
    `DependentLoadFlags (need >= ${DEPENDENT_LOAD_FLAGS_OFFSET + 2})`,
  );
}

// Map the Load Config RVA to a file offset using the section headers.
const sectionHeadersOffset = optionalHeaderOffset + sizeOfOptionalHeader;
let loadConfigFileOffset = -1;
for (let i = 0; i < numberOfSections; i++) {
  const s = sectionHeadersOffset + i * 40;
  const virtualSize = buf.readUInt32LE(s + 8);
  const virtualAddress = buf.readUInt32LE(s + 12);
  const sizeOfRawData = buf.readUInt32LE(s + 16);
  const pointerToRawData = buf.readUInt32LE(s + 20);
  const span = Math.max(virtualSize, sizeOfRawData);
  if (loadConfigRva >= virtualAddress && loadConfigRva < virtualAddress + span) {
    loadConfigFileOffset = pointerToRawData + (loadConfigRva - virtualAddress);
    break;
  }
}

if (loadConfigFileOffset < 0) {
  fail(`could not map Load Config RVA 0x${loadConfigRva.toString(16)} to a file offset`);
}

const flagsFileOffset = loadConfigFileOffset + DEPENDENT_LOAD_FLAGS_OFFSET;
const current = buf.readUInt16LE(flagsFileOffset);

if (current === LOAD_LIBRARY_SEARCH_SYSTEM32) {
  console.log(`patch-pe: DependentLoadFlags already 0x0800 at offset 0x${flagsFileOffset.toString(16)} (no-op)`);
  process.exit(0);
}

buf.writeUInt16LE(LOAD_LIBRARY_SEARCH_SYSTEM32, flagsFileOffset);
fs.writeFileSync(target, buf);

// Verify the write landed.
const written = fs.readFileSync(target).readUInt16LE(flagsFileOffset);
if (written !== LOAD_LIBRARY_SEARCH_SYSTEM32) {
  fail(`verification failed: DependentLoadFlags reads 0x${written.toString(16)} after write`);
}

console.log(
  `patch-pe: set DependentLoadFlags 0x${current.toString(16)} -> 0x0800 ` +
  `at offset 0x${flagsFileOffset.toString(16)} in ${path.basename(target)}`,
);
