import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "@package/misc/fixtures";
import { launchInsomniaElectron } from "@package/misc/launch";
import { expect } from "@playwright/test";

const STUB = path.resolve(import.meta.dirname, "../../../misc/native-dialog-stub.cjs");
const QUIT = 0;
const SHOW_DATA_FOLDER = 1;

interface LoggedEntry {
  kind: "messageBox" | "answer" | "openPath";
  [key: string]: any;
}

const childPids = (pid: number): number[] => {
  try {
    return execFileSync("pgrep", ["-P", String(pid)], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
      .map(Number);
  } catch {
    return []; // pgrep exits with 1 when there is none
  }
};

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

test("The app does not start when a datastore cannot be loaded: it names the datastore and the data folder, and the data stays as it is", async ({
  dataPath,
}) => {
  // More than 90% of the lines of insomnia.Request.db are not documents
  fs.mkdirSync(dataPath, { recursive: true });
  const damaged = path.join(dataPath, "insomnia.Request.db");
  fs.writeFileSync(damaged, `${Array.from({ length: 20 }, (_, i) => `{ this line ${i} is not a document`).join("\n")}\n`);
  const before = fs.readFileSync(damaged);

  const logFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "insomnia-native-dialog-")), "dialog.jsonl");
  fs.writeFileSync(logFile, "");
  const readLog = (): LoggedEntry[] =>
    fs
      .readFileSync(logFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));

  const app = await launchInsomniaElectron({
    dataPath,
    skipOnboarding: true,
    vaultKey: "",
    vaultSalt: "",
    preloadScripts: [STUB],
    extraEnv: {
      INSOMNIA_TEST_NATIVE_DIALOG_LOG: logFile,
      // Show Data Folder twice, then Quit; each dialog stays open for a moment, like a real one
      INSOMNIA_TEST_NATIVE_DIALOG_RESPONSES: [SHOW_DATA_FOLDER, SHOW_DATA_FOLDER, QUIT].join(","),
      INSOMNIA_TEST_NATIVE_DIALOG_DELAY_MS: "1500",
    },
  });
  const child = app.process();
  const exited = new Promise<number | null>((resolve) => child.once("exit", (code) => resolve(code)));

  try {
    // The dialog is up, and there is no window behind it
    await expect.poll(() => readLog().some((entry) => entry.kind === "messageBox")).toBe(true);
    expect(app.windows()).toHaveLength(0);
    const firstDialog = readLog().find((entry) => entry.kind === "messageBox");
    expect(firstDialog).toMatchObject({
      type: "error",
      title: "Insomnia cannot start",
      message: "Insomnia could not load its local database.",
      buttons: ["Quit", "Show Data Folder"],
    });
    // It says which datastore failed and where the data is, and that nothing was changed
    expect(firstDialog!.detail).toContain("Request");
    expect(firstDialog!.detail).toContain(`Data folder: ${dataPath}`);
    expect(firstDialog!.detail).toContain("were not changed");
    const pid = child.pid!;
    const children = childPids(pid);

    // Show Data Folder opens the data folder and comes back to the dialog; Quit ends the app
    const exitCode = await exited;
    const log = readLog();
    const answers = log.filter((entry) => entry.kind === "answer").map((entry) => entry.response);
    expect(answers).toEqual([SHOW_DATA_FOLDER, SHOW_DATA_FOLDER, QUIT]);
    expect(log.filter((entry) => entry.kind === "openPath").map((entry) => entry.path)).toEqual([dataPath, dataPath]);
    expect(log.filter((entry) => entry.kind === "messageBox")).toHaveLength(3);

    // Nothing is left running, and the exit code says the start failed
    expect(exitCode).toBe(1);
    await expect.poll(() => isAlive(pid)).toBe(false);
    for (const childPid of children) {
      await expect.poll(() => isAlive(childPid), { message: `child process ${childPid}` }).toBe(false);
    }

    // The data files are exactly as they were: nothing was repaired, moved or deleted
    expect(fs.readFileSync(damaged).equals(before)).toBe(true);
    expect(fs.readdirSync(dataPath).filter((file) => file.endsWith(".bak") || file.includes("corrupt"))).toEqual([]);
  } finally {
    await app.close().catch(() => {});
    fs.rmSync(path.dirname(logFile), { recursive: true, force: true });
  }
});
