import fs from 'node:fs';
import path from 'node:path';

import madge from 'madge';

const MAX_CIRCULAR_REFERENCES = 200;

madge(path.join(__dirname, '../src'), {
  fileExtensions: ['ts', 'tsx'],
})
  .then(res => {
    const circularReferences = res.circular();
    const count = circularReferences.length;

    console.log(`Found ${count} circular references`);

    // Exit with error if in CI environment and exceeds limit
    if (process.env.CI && count > MAX_CIRCULAR_REFERENCES) {
      console.error(`❌ Circular references count (${count}) exceeds the limit (${MAX_CIRCULAR_REFERENCES})`);
      process.exit(1);
    }

    // Generate detailed report for CI environment
    if (process.env.CI) {
      const outputPath = path.join(__dirname, '../../../circular-references.md');
      const markdownContent = generateMarkdownReport(circularReferences, count);
      fs.writeFileSync(outputPath, markdownContent);
      console.log(`📝 Circular references report saved to ${outputPath}`);
    } else {
      // Output to console for local development
      circularReferences.forEach(cycle => console.log(cycle.join(' -> ')));
    }
  })
  .catch(err => {
    console.error('Error analyzing circular references:', err);
    process.exit(1);
  });

function generateMarkdownReport(circularReferences: string[][], count: number): string {
  const timestamp = new Date().toISOString();

  return `# Circular References Report

**Generated at:** ${timestamp}  
**Total circular references:** ${count}  
**Limit:** ${MAX_CIRCULAR_REFERENCES}  
**Status:** ${count > MAX_CIRCULAR_REFERENCES ? '❌ FAILED' : '✅ PASSED'}

<details>
<summary>Click to view all circular references (${count})</summary>

\`\`\`
${circularReferences.map(cycle => cycle.join(' -> ')).join('\n')}
\`\`\`

</details>

## Analysis

${
  count > MAX_CIRCULAR_REFERENCES
    ? `⚠️ **Warning:** The number of circular references (${count}) exceeds the limit of ${MAX_CIRCULAR_REFERENCES}. Please consider refactoring to reduce circular dependencies.`
    : `✅ **Good:** The number of circular references (${count}) is within the acceptable limit of ${MAX_CIRCULAR_REFERENCES}.`
}

---
*This report was generated automatically by the circular reference checker.*
`;
}
