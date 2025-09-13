import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { parse } from 'csv-parse/sync';

// --------------------------
// Type Definitions
// --------------------------
interface Config {
    csvConfigPath: string;
    testFilesDir: string;
    targetProject: string;
    playwrightCli: string;
    projectRoot: string; // Project root directory (contains playwright.config.ts)
}

interface TestFile {
    fullPath: string;
    relativePath: string;
    baseName: string;
    prefix: string;
    normalizedPath: string;
}

interface CsvRule {
    run?: string;
    path?: string;
    filename?: string;
}

// --------------------------
// Configuration - Critical path corrections
// --------------------------
const projectRoot = path.resolve(__dirname, '../../'); // Resolve to project root (2 levels up from dist/scripts)
const SETTINGS: Config = {
    csvConfigPath: path.resolve(projectRoot, 'test-config.csv'),
    testFilesDir: path.resolve(projectRoot, 'tests'),
    targetProject: 'WJTest',
    playwrightCli: path.resolve(projectRoot, 'node_modules/.bin/playwright'),
    projectRoot: projectRoot
};

// --------------------------
// Validate target project exists in Playwright config
// --------------------------
function validatePlaywrightProject() {
    const configPath = path.resolve(SETTINGS.projectRoot, 'playwright.config.ts');

    // Check if config file exists
    if (!fs.existsSync(configPath)) {
        console.error(`❌ Playwright config file not found at: ${configPath}`);
        process.exit(1);
    }

    // Basic check for target project in config
    const configContent = fs.readFileSync(configPath, 'utf8');
    if (!configContent.includes(`name: '${SETTINGS.targetProject}'`)) {
        console.error(`❌ Project '${SETTINGS.targetProject}' not found in playwright.config.ts`);
        console.error('Please verify the project name in your Playwright configuration');
        process.exit(1);
    }
}

// --------------------------
// Validate critical file system paths
// --------------------------
function validatePaths(): void {
    // Validate Playwright CLI executable
    if (!fs.existsSync(SETTINGS.playwrightCli)) {
        const windowsCliPath = `${SETTINGS.playwrightCli}.cmd`;
        if (fs.existsSync(windowsCliPath)) {
            SETTINGS.playwrightCli = windowsCliPath;
        } else {
            console.error(`❌ Playwright CLI not found at: ${SETTINGS.playwrightCli}`);
            process.exit(1);
        }
    }

    // Validate test directory exists
    if (!fs.existsSync(SETTINGS.testFilesDir) || !fs.lstatSync(SETTINGS.testFilesDir).isDirectory()) {
        console.error(`❌ Test directory not found: ${SETTINGS.testFilesDir}`);
        process.exit(1);
    }

    // Validate CSV configuration file exists
    if (!fs.existsSync(SETTINGS.csvConfigPath) || !fs.lstatSync(SETTINGS.csvConfigPath).isFile()) {
        console.error(`❌ CSV configuration file not found: ${SETTINGS.csvConfigPath}`);
        process.exit(1);
    }
}

// --------------------------
// Validate test files exist in filesystem
// --------------------------
function validateTestFiles(testFiles: string[]): void {
    testFiles.forEach(filePath => {
        const fullPath = path.resolve(SETTINGS.projectRoot, filePath);
        if (!fs.existsSync(fullPath)) {
            console.error(`❌ Test file not found: ${fullPath}`);
            process.exit(1);
        }
    });
}

// --------------------------
// 1. Get list of test files included by CSV configuration
// --------------------------
function getTestsIncludedByCSV(): string[] {
    validatePaths();
    validatePlaywrightProject();

    // Read and parse CSV configuration
    const csvData = fs.readFileSync(SETTINGS.csvConfigPath, 'utf8');
    const inclusionRules: CsvRule[] = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    });

    // Get all valid test files in test directory
    const allTestFiles: TestFile[] = fs.readdirSync(SETTINGS.testFilesDir)
        .filter(fileName => {
            const fullPath = path.join(SETTINGS.testFilesDir, fileName);
            return fileName.endsWith('.test.ts') &&
                !fileName.startsWith('_') &&
                fs.lstatSync(fullPath).isFile();
        })
        .map(fileName => {
            const fullPath = path.resolve(SETTINGS.testFilesDir, fileName);
            return {
                fullPath,
                relativePath: path.relative(SETTINGS.projectRoot, fullPath).replace(/\\/g, '/'),
                baseName: fileName,
                prefix: fileName.replace('.test.ts', ''),
                normalizedPath: fullPath.replace(/\\/g, '/')
            };
        });

    // Filter files based on CSV rules
    const includedTests = allTestFiles.filter(testFile => {
        return inclusionRules.some(rule => {
            if (rule.run?.toLowerCase() === 'no') return false;

            const pathCondition = rule.path
                ? testFile.normalizedPath.includes(rule.path.replace(/\\/g, '/'))
                : true;

            const prefixCondition = rule.filename
                ? testFile.prefix.startsWith(rule.filename)
                : true;

            return pathCondition && prefixCondition;
        });
    });

    // Handle empty result
    if (includedTests.length === 0) {
        console.warn('⚠️  No test files matched the CSV inclusion rules');
        process.exit(0);
    }

    // Validate and log included files
    const testFilePaths = includedTests.map(test => test.relativePath);
    validateTestFiles(testFilePaths);

    console.log(`✅ ${includedTests.length} test file(s) included by CSV:`);
    includedTests.forEach(test => console.log(`- ${test.relativePath}`));

    return testFilePaths;
}

// --------------------------
// 2. Execute tests via Playwright CLI
// --------------------------
function executePlaywrightTests(testFilePaths: string[]): void {
    const cliArguments: string[] = [
        'test',
        ...testFilePaths.map(path => `"${path}"`), // Quote paths to handle spaces/special characters
        '--project',
        SETTINGS.targetProject
    ];

    console.log('\n▶️  Starting Playwright test execution...');
    console.log(`📌 Working directory: ${SETTINGS.projectRoot}`);
    console.log(`📌 Command: ${SETTINGS.playwrightCli} ${cliArguments.join(' ')}`);

    // Spawn Playwright process with correct working directory
    const testProcess = spawn(SETTINGS.playwrightCli, cliArguments, {
        stdio: 'inherit',
        shell: true,
        cwd: SETTINGS.projectRoot // Critical: Run from project root to find config
    });

    // Handle process exit
    testProcess.on('exit', (code: number | null) => {
        console.log(`\n📋 Playwright test run finished with exit code: ${code}`);
        process.exit(code || 0);
    });

    // Handle process startup errors
    testProcess.on('error', (error: Error) => {
        console.error('❌ Failed to start Playwright process:', error.message);
        process.exit(1);
    });
}

// --------------------------
// Main execution flow
// --------------------------
try {
    const testsToRun = getTestsIncludedByCSV();
    console.log('\n📂 Tests to be executed (relative to project root):', testsToRun);
    executePlaywrightTests(testsToRun);
} catch (error) {
    console.error('❌ Fatal error during setup:', (error as Error).message);
    process.exit(1);
}
