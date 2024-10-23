import path from 'node:path';

import * as commander from 'commander';
import fs from 'fs';

import { version } from '../../package.json';

const DOCS_DIR = path.join(__dirname, `../reference/insomnia-inso/${version}`);

function writeMarkdownFile(fileName: string, content: string): void {
    const outputPath = path.join(DOCS_DIR, fileName);
    fs.writeFileSync(outputPath, content);
}

function generateOptionsMarkdown(options: readonly commander.Option[], title: string): string {
    return options.length ? `## ${title}

${options.map(option => `- \`${option.flags}\`: ${option.description}
`).join('')}
` : '';
}

function generateSubcommandsMarkdown(commandName: string, subcommands: { name: string; description: string }[]): string {
    return subcommands.length ? `## Subcommands

${subcommands.map(sub => `- [\`${commandName} ${sub.name}\`](/insomnia-inso/${commandName.replace(/\s+/g, '_')}_${sub.name.replace(/\s+/g, '_')}/): ${sub.description}
`).join('')}
` : '';
}

export function generateCommandMarkdown(command: commander.Command, programOptions: readonly commander.Option[], parentName?: string): { name: string; fileName: string; description: string; subcommands: readonly commander.Command[] } {
    const commandName = parentName ? `${parentName} ${command.name()}` : command.name();
    const fileName = `${commandName.replace(/\s+/g, '_')}.md`;

    writeMarkdownFile(fileName, `# ${commandName}

## Command Description

${command.description()}

## Syntax

\`${commandName} ${command.usage() || '[options]'}\`

${command.options.length > 0 ? generateOptionsMarkdown(command.options, 'Local Flags') : ''}${generateOptionsMarkdown(programOptions, 'Global Flags')}${generateSubcommandsMarkdown(commandName, command.commands.map(sub => ({
    name: sub.name(),
    description: sub.description() || 'No description available',
})))}`);

    return {
        name: commandName,
        fileName,
        description: command.description() || 'No description available',
        subcommands: command.commands,
    };
}

export function generateDocumentation(program: commander.Command): void {
    if (!fs.existsSync(DOCS_DIR)) {
        fs.mkdirSync(DOCS_DIR, { recursive: true });
    }

    const allCommands: any[] = [];

    program.commands.forEach(command => {
        const commandData = generateCommandMarkdown(command, program.options, '');

        allCommands.push({
            name: commandData.name,
            description: commandData.description,
            fileName: commandData.fileName,
            subcommands: commandData.subcommands.map(sub => ({
                name: sub.name(),
                description: sub.description() || 'No description available',
                fileName: `${commandData.name.replace(/\s+/g, '_')}_${sub.name().replace(/\s+/g, '_')}.md`,
            })),
        });

        commandData.subcommands.forEach(sub => {
            generateCommandMarkdown(sub, program.options, commandData.name);
        });
    });

    writeMarkdownFile('index.md', `# CLI Documentation 
${generateOptionsMarkdown(program.options, 'Global Flags')}
## Commands

${allCommands.map(({ name, description, fileName }) => `- [\`${name}\`](/insomnia-inso/${fileName.replace('.md', '')}/): ${description}
`).join('')}
${allCommands.map(({ name, subcommands }) => `${generateSubcommandsMarkdown(name, subcommands)}
`).join('')}`);
}
