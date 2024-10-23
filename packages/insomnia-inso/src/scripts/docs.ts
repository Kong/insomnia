import path from 'node:path';

import * as commander from 'commander';
import fs from 'fs';

import { version } from '../../package.json';

const DOCS_DIR = path.join(__dirname, `../../../../reference/insomnia-inso/${version}`);

function writeMarkdownFile(fileName: string, content: string): void {
    const outputPath = path.join(DOCS_DIR, fileName);
    fs.writeFileSync(outputPath, content);
}

function generateOptionsMarkdown(options: readonly commander.Option[], title: string): string {
    if (options.length === 0) {
        return '';
    }

    const optionList = options.map(option => `- \`${option.flags}\`: ${option.description}\n`).join('');
    return `\n## ${title}\n\n${optionList}`;
}

function generateSubcommandsMarkdown(commandName: string, subcommands: { name: string; description: string }[]): string {
    if (subcommands.length === 0) {
        return '';
    }

    let subcommandsMarkdown = '\n## Subcommands\n\n';
    subcommands.forEach(sub => {
        const subCommandFileName = `${commandName.replace(/\s+/g, '_')}_${sub.name.replace(/\s+/g, '_')}.md`;
        subcommandsMarkdown += `- [\`${commandName} ${sub.name}\`](${generateFileURL(subCommandFileName)}): ${sub.description}\n`;
    });

    return subcommandsMarkdown;
}

function generateCommandMarkdownContent(command: commander.Command, programOptions: readonly commander.Option[], parentName?: string): string {
    const commandName = parentName ? `${parentName} ${command.name()}` : command.name();
    const usage = command.usage() || '[options]';

    let commandMarkdown = `# ${commandName}\n\n`;
    commandMarkdown += `## Command Description\n\n${command.description()}\n\n`;
    commandMarkdown += `## Syntax\n\n\`${commandName} ${usage}\`\n`;

    if (command.options.length > 0) {
        commandMarkdown += generateOptionsMarkdown(command.options, 'Local Flags');
    }

    commandMarkdown += generateOptionsMarkdown(programOptions, 'Global Flags');
    commandMarkdown += generateSubcommandsMarkdown(commandName, command.commands.map(sub => ({
        name: sub.name(),
        description: sub.description() || 'No description available',
    })));

    return commandMarkdown;
}

export function generateCommandMarkdown(command: commander.Command, programOptions: readonly commander.Option[], parentName?: string): { name: string; fileName: string; description: string; subcommands: readonly commander.Command[] } {
    const commandName = parentName ? `${parentName} ${command.name()}` : command.name();
    const fileName = `${commandName.replace(/\s+/g, '_')}.md`;

    const commandMarkdown = generateCommandMarkdownContent(command, programOptions, parentName);
    writeMarkdownFile(fileName, commandMarkdown);

    return {
        name: commandName,
        fileName,
        description: command.description() || 'No description available',
        subcommands: command.commands,
    };
}

function generateFileURL(fileName: string): string {
    return `/insomnia-inso/${fileName.replace('.md', '')}/`;
}

function generateIndexContent(globalOptions: readonly commander.Option[], allCommands: { name: string; description: string; fileName: string; subcommands: any[] }[]): string {
    let indexContent = '# CLI Documentation \n';

    indexContent += generateOptionsMarkdown(globalOptions, 'Global Flags');

    indexContent += '\n## Commands\n\n';
    allCommands.forEach(({ name, description, fileName }) => {
        indexContent += `- [\`${name}\`](${generateFileURL(fileName)}): ${description}\n`;
    });

    allCommands.forEach(({ name, subcommands }) => {
        indexContent += generateSubcommandsMarkdown(name, subcommands);
    });

    return indexContent;
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

    const indexContent = generateIndexContent(program.options, allCommands);
    writeMarkdownFile('index.md', indexContent);
}
