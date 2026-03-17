import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { ElectronApplication } from '@playwright/test';

/**
 * Creates a temporary directory for export operations.
 * @returns The path to the temporary directory
 */
export function createTempExportDir(): string {
  const prefix = path.join(os.tmpdir(), 'insomnia-export-test-');
  const tempDir = fs.mkdtempSync(prefix);
  return tempDir;
}

/**
 * Waits for export files to be created in the directory.
 * Used for project-level exports that don't show an alert.
 * @param dirPath - The directory to check for files
 * @param expectedCount - The expected number of files
 * @param timeout - Maximum time to wait in milliseconds (default: 10000)
 */
export async function waitForExportFiles(dirPath: string, expectedCount: number, timeout = 10_000): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 100;

  while (Date.now() - startTime < timeout) {
    const files = getExportedFiles(dirPath);
    if (files.length >= expectedCount) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  const files = getExportedFiles(dirPath);
  throw new Error(`Timeout waiting for ${expectedCount} export files. Found ${files.length} files in ${dirPath}`);
}

/**
 * Gets all exported files from a directory recursively.
 * @param dirPath - The directory path to search
 * @returns Array of file paths
 */
export function getExportedFiles(dirPath: string): string[] {
  const files: string[] = [];

  const readDir = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        readDir(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  };

  if (fs.existsSync(dirPath)) {
    readDir(dirPath);
  }

  return files;
}

/**
 * Reads the content of an exported file.
 * @param filePath - The file path to read
 * @returns The file content as string
 */
export function readExportedFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Cleans up the temporary export directory.
 * @param dirPath - The directory path to clean up
 */
export function cleanupExportDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Mocks the showSaveDialog to return a specific file path.
 * Used for single file exports.
 * @param filePath - The file path to return
 */
export async function mockSaveDialogForFile(app: ElectronApplication, filePath: string): Promise<void> {
  await app.evaluate(async ({ ipcMain }, filePath) => {
    // Override the showSaveDialog handler to return our temp file path
    ipcMain.removeHandler('showSaveDialog');
    ipcMain.handle('showSaveDialog', async () => {
      return { filePath, canceled: false };
    });
  }, filePath);
}

/**
 * Mocks the showOpenDialog to return a specific directory path.
 * Used for "Export all data" which uses folder selection.
 * @param dirPath - The directory path to return
 */
export async function mockOpenDialogForDirectory(app: ElectronApplication, dirPath: string): Promise<void> {
  await app.evaluate(async ({ ipcMain }, dirPath) => {
    // Override the showOpenDialog handler to return our temp directory
    ipcMain.removeHandler('showOpenDialog');
    ipcMain.handle('showOpenDialog', async () => {
      return { filePaths: [dirPath], canceled: false };
    });
  }, dirPath);
}
