import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { ElectronApplication, Page } from '@playwright/test';

/**
 * Page Object for the Data tab in Preferences (Import/Export functionality)
 */
export class DataPage {
  readonly page: Page;
  readonly app: ElectronApplication;

  constructor(page: Page, app: ElectronApplication) {
    this.page = page;
    this.app = app;
  }

  /**
   * Opens the settings modal and navigates to the Data tab
   */
  async openDataTab() {
    await this.page.getByTestId('settings-button').click();
    await this.page.locator('text=Insomnia Preferences').first().click();
    await this.page.getByRole('tab', { name: 'Data' }).click();
    await this.page.getByTestId('import-export-tab').waitFor({ state: 'visible' });
  }

  /**
   * Closes the settings modal
   */
  async closeSettingsModal() {
    await this.page.locator('.app').press('Escape');
  }

  /**
   * Creates a temporary directory for export
   * @returns The path to the temporary directory
   */
  createTempExportDir(): string {
    const tempDir = path.join(os.tmpdir(), `insomnia-export-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    return tempDir;
  }

  /**
   * Mocks the showOpenDialog to return a specific directory path
   * Used for "Export all data" which uses folder selection
   * @param dirPath - The directory path to return
   */
  async mockOpenDialogForDirectory(dirPath: string) {
    await this.app.evaluate(async ({ ipcMain }, dirPath) => {
      // Override the showOpenDialog handler to return our temp directory
      ipcMain.removeHandler('showOpenDialog');
      ipcMain.handle('showOpenDialog', async () => {
        return { filePaths: [dirPath], canceled: false };
      });
    }, dirPath);
  }

  /**
   * Mocks the showSaveDialog to return a specific file path
   * Used for single file exports
   * @param filePath - The file path to return
   */
  async mockSaveDialogForFile(filePath: string) {
    await this.app.evaluate(async ({ ipcMain }, filePath) => {
      // Override the showSaveDialog handler to return our temp file path
      ipcMain.removeHandler('showSaveDialog');
      ipcMain.handle('showSaveDialog', async () => {
        return { filePath, canceled: false };
      });
    }, filePath);
  }

  /**
   * Clicks the "Export project" button
   * Note: The button text varies based on whether there's an active workspace:
   * - With workspace: 'Export the "{projectName}" $Project' (note the $ is a bug in source)
   * - Without workspace: 'Export files from the "{projectName}" Project'
   * @param projectName - The name of the project
   */
  async clickExportProjectButton(projectName: string) {
    // Use regex to match either button text pattern (handles the $ bug in source)
    const buttonPattern = new RegExp(`Export.*"${projectName}".*\\$?[Pp]roject`);
    await this.page.getByRole('button', { name: buttonPattern }).click();
  }

  /**
   * Clicks the "Export all data" button
   */
  async clickExportAllDataButton() {
    await this.page.getByRole('button', { name: /Export all data/ }).click();
  }

  /**
   * Handles the export type selection modal (Insomnia v5 or HAR)
   * @param format - The format to select ('yaml' for Insomnia v5, 'har' for HAR)
   */
  async selectExportFormat(format: 'yaml' | 'har') {
    await this.page.getByText('Which format would you like to export as?').waitFor({ state: 'visible' });

    // The modal uses a <select> element, so we need to use selectOption
    await this.page.getByLabel('Select Modal').locator('select').selectOption(format);

    await this.page.getByRole('button', { name: 'Done' }).click();
  }

  /**
   * Waits for the export complete alert modal
   */
  async waitForExportCompleteAlert() {
    await this.page.getByText('Export Complete').waitFor({ state: 'visible', timeout: 10_000 });
    await this.page.getByRole('button', { name: 'Ok' }).click();
  }

  /**
   * Waits for export files to be created in the directory
   * Used for project-level exports that don't show an alert
   * @param dirPath - The directory to check for files
   * @param expectedCount - The expected number of files
   * @param timeout - Maximum time to wait in milliseconds (default: 10000)
   */
  async waitForExportFiles(dirPath: string, expectedCount: number, timeout = 10_000): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 100;

    while (Date.now() - startTime < timeout) {
      const files = this.getExportedFiles(dirPath);
      if (files.length >= expectedCount) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    const files = this.getExportedFiles(dirPath);
    throw new Error(`Timeout waiting for ${expectedCount} export files. Found ${files.length} files in ${dirPath}`);
  }

  /**
   * Gets all exported files from a directory
   * @param dirPath - The directory path to search
   * @returns Array of file paths
   */
  getExportedFiles(dirPath: string): string[] {
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
   * Reads the content of an exported file
   * @param filePath - The file path to read
   * @returns The file content as string
   */
  readExportedFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf8');
  }

  /**
   * Cleans up the temporary export directory
   * @param dirPath - The directory path to clean up
   */
  cleanupExportDir(dirPath: string) {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }

  /**
   * Parses YAML export content and returns normalized object for comparison
   * Removes dynamic fields like timestamps, ids that change each export
   * @param content - The YAML content string
   * @returns Normalized object for comparison
   */
  normalizeExportContent(content: string): Record<string, unknown> {
    const { parse } = require('yaml');
    const parsed = parse(content);

    // Helper to recursively remove dynamic fields
    const removeDynamicFields = (obj: unknown): unknown => {
      if (Array.isArray(obj)) {
        return obj.map(removeDynamicFields);
      }
      if (obj && typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
          // Skip dynamic fields that change between exports
          if (['created', 'modified', 'id', '_id', 'parentId'].includes(key)) {
            continue;
          }
          // Recursively process nested objects/arrays
          if (key === 'meta') {
            const meta = value as Record<string, unknown>;
            result[key] = {
              ...(removeDynamicFields(meta) as object),
            };
          } else {
            result[key] = removeDynamicFields(value);
          }
        }
        return result;
      }
      return obj;
    };

    return removeDynamicFields(parsed) as Record<string, unknown>;
  }

  /**
   * Compares exported YAML content with expected fixture
   * Handles dynamic fields by replacing them with placeholders
   * @param actualContent - The actual exported content
   * @param expectedFixturePath - Path to the expected fixture file
   * @returns Comparison result with differences if any
   */
  compareWithFixture(
    actualContent: string,
    expectedFixturePath: string,
  ): {
    matches: boolean;
    differences?: string;
    normalizedActual?: string;
    normalizedExpected?: string;
  } {
    const fs = require('node:fs');
    const path = require('node:path');
    const { parse, stringify } = require('yaml');

    // Read expected fixture (path is relative to fixtures directory)
    const fixturePath = path.resolve(__dirname, '../../fixtures', expectedFixturePath);
    if (!fs.existsSync(fixturePath)) {
      return {
        matches: false,
        differences: `Fixture file not found: ${expectedFixturePath}`,
      };
    }

    const expectedContent = fs.readFileSync(fixturePath, 'utf8');

    try {
      const actualParsed = parse(actualContent);
      const expectedParsed = parse(expectedContent);

      // Normalize actual content by replacing dynamic fields with {{dynamic}}
      const normalizeForComparison = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(normalizeForComparison);
        }
        if (obj && typeof obj === 'object') {
          const result: any = {};
          for (const [key, value] of Object.entries(obj)) {
            // Replace dynamic fields with placeholder
            if (['id', '_id', 'created', 'modified', 'metaSortKey'].includes(key)) {
              result[key] = '{{dynamic}}';
            } else if (key === 'meta' && value && typeof value === 'object') {
              // Handle meta object specially
              result[key] = normalizeForComparison(value);
            } else {
              result[key] = normalizeForComparison(value);
            }
          }
          return result;
        }
        return obj;
      };

      const normalizedActual = normalizeForComparison(actualParsed);
      const normalizedExpected = normalizeForComparison(expectedParsed);

      // Convert back to YAML for string comparison
      const normalizedActualYaml = stringify(normalizedActual);
      const normalizedExpectedYaml = stringify(normalizedExpected);

      const matches = normalizedActualYaml === normalizedExpectedYaml;

      return {
        matches,
        differences: matches ? undefined : this.getDifferences(normalizedActualYaml, normalizedExpectedYaml),
        normalizedActual: normalizedActualYaml,
        normalizedExpected: normalizedExpectedYaml,
      };
    } catch (error) {
      return {
        matches: false,
        differences: `Error parsing YAML: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Gets detailed differences between two YAML strings
   * @param actual - Actual YAML content
   * @param expected - Expected YAML content
   * @returns String describing the differences
   */
  private getDifferences(actual: string, expected: string): string {
    const actualLines = actual.split('\n');
    const expectedLines = expected.split('\n');
    const differences: string[] = [];

    const maxLines = Math.max(actualLines.length, expectedLines.length);

    for (let i = 0; i < maxLines; i++) {
      const actualLine = actualLines[i] ?? '';
      const expectedLine = expectedLines[i] ?? '';

      if (actualLine !== expectedLine) {
        differences.push(`Line ${i + 1}:`, `  Expected: ${expectedLine}`, `  Actual:   ${actualLine}`);
      }
    }

    return differences.join('\n');
  }
}
