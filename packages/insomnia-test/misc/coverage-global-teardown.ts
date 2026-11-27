import { generateCoverageReport } from "./coverage";

export default async function globalTeardown(): Promise<void> {
  await generateCoverageReport();
}
