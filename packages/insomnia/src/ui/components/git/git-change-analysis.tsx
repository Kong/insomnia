import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import React, { useState } from 'react';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';

import {
  type ChangeVerdict,
  type EntityRef,
  formatChangeReportAsText,
  VERDICT_LABELS,
} from '~/common/insomnia-v5-change-report';
import type { GitDiffDiagnostics } from '~/main/git-service';
import { Icon } from '~/ui/components/icon';

const MAX_ROWS = 25;

const VERDICT_STYLES: Record<ChangeVerdict, { className: string; icon: IconProp }> = {
  'identical': { className: 'bg-(--hl-xs) text-(--color-font)', icon: 'equals' },
  'order-only': { className: 'bg-(--color-warning)/20 text-(--color-warning)', icon: 'arrows-up-down' },
  'metadata-only': { className: 'bg-(--color-warning)/20 text-(--color-warning)', icon: 'clock' },
  'content-changed': { className: 'bg-(--color-danger)/20 text-(--color-font-danger)', icon: 'pen' },
  'unparsable': { className: 'bg-(--color-danger)/20 text-(--color-font-danger)', icon: 'triangle-exclamation' },
};

const shortOid = (oid: string | null) => (oid ? oid.slice(0, 10) : '—');

const baseName = (filepath: string) => filepath.split(/[\\/]/).pop() || 'collection.yaml';

const Section = ({ title, count, children }: { title: string; count: number; children: React.ReactNode }) => {
  if (count === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="font-semibold text-(--color-font)">
        {title} ({count})
      </div>
      <div className="flex flex-col gap-1 pl-2">{children}</div>
    </div>
  );
};

const EntityLine = ({ entity, suffix }: { entity: EntityRef; suffix?: string }) => (
  <div className="break-all">
    <span className="text-(--hl-xl)">[{entity.kind}]</span> <span className="text-(--color-font)">{entity.path}</span>{' '}
    <span className="text-(--hl)">({entity.id})</span>
    {suffix ? <span className="text-(--hl-xl)"> {suffix}</span> : null}
  </div>
);

const Truncated = ({ total }: { total: number }) =>
  total > MAX_ROWS ? (
    <div className="text-(--hl)">…and {total - MAX_ROWS} more — use “Copy report” for the full list</div>
  ) : null;

export const GitChangeAnalysis = ({ diagnostics }: { diagnostics: GitDiffDiagnostics }) => {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const { report } = diagnostics;
  const verdictStyle = VERDICT_STYLES[report.verdict];

  const copyReport = () => {
    window.clipboard.writeText(
      formatChangeReportAsText(report, {
        appVersion: diagnostics.appVersion,
        file: diagnostics.filepath,
        comparing: diagnostics.comparing,
        beforeOid: diagnostics.beforeOid ?? 'none',
        afterOid: diagnostics.afterOid ?? 'none',
        diffViewNormalizedTheCommittedSide: diagnostics.displayNormalized,
      }),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportCommittedYaml = async () => {
    if (!diagnostics.committedYaml) {
      return;
    }

    setExportError(null);
    try {
      const name = baseName(diagnostics.filepath).replace(/\.ya?ml$/i, '');
      const { canceled, filePath } = await window.dialog.showSaveDialog({
        title: 'Export committed YAML',
        buttonLabel: 'Export',
        defaultPath: window.path.join(window.app.getPath('desktop'), `${name}.committed.yaml`),
      });

      if (canceled || !filePath) {
        return;
      }

      await window.main.writeFile({ path: filePath, content: diagnostics.committedYaml });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="flex shrink-0 flex-col gap-2 rounded-xs border border-solid border-(--hl-md) p-2 font-mono text-xs">
      <div className="flex items-center gap-2">
        <Button
          className="flex items-center gap-2"
          onPress={() => setExpanded(value => !value)}
          aria-label="Toggle change analysis"
        >
          <Icon icon={expanded ? 'chevron-down' : 'chevron-right'} className="size-3 text-(--hl-xl)" />
          <span className="font-sans font-semibold text-(--color-font)">Change analysis</span>
        </Button>
        <span className={`flex items-center gap-2 rounded-xs px-2 py-1 font-sans ${verdictStyle.className}`}>
          <Icon icon={verdictStyle.icon} className="size-3" />
          {VERDICT_LABELS[report.verdict]}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-(--hl-xl)">
            edited {report.contentChanged.length} · added {report.added.length} · removed {report.removed.length} ·
            moved {report.moved.length} · reordered {report.reordered.length} · metadata {report.metadataChanged.length}
          </span>
          <Button
            className="rounded-xs border border-solid border-(--hl-md) px-2 py-1 font-sans hover:bg-(--hl-xs)"
            onPress={copyReport}
          >
            {copied ? 'Copied!' : 'Copy report'}
          </Button>
          <TooltipTrigger>
            <Button
              className="rounded-xs border border-solid border-(--hl-md) px-2 py-1 font-sans hover:bg-(--hl-xs) disabled:opacity-50"
              isDisabled={!diagnostics.committedYaml}
              onPress={exportCommittedYaml}
            >
              <Icon icon="file-export" className="mr-2 size-3" />
              Export committed YAML
            </Button>
            <Tooltip
              offset={8}
              className="max-w-xs rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) p-2 font-sans text-xs text-(--color-font) shadow-lg"
            >
              {diagnostics.committedYaml
                ? 'Saves the file exactly as it is committed in your Git repository, so support can reproduce the problem. It contains your collection data — only share it if your policy allows.'
                : 'This file has no committed version yet.'}
            </Tooltip>
          </TooltipTrigger>
        </div>
      </div>

      {expanded && (
        <div className="flex max-h-[45vh] flex-col gap-3 overflow-y-auto">
          <div className="grid grid-cols-2 gap-x-4 text-(--hl-xl)">
            <div>Insomnia {diagnostics.appVersion}</div>
            <div>{diagnostics.comparing}</div>
            <div className="break-all">file: {diagnostics.filepath}</div>
            <div>
              blob: {shortOid(diagnostics.beforeOid)} → {shortOid(diagnostics.afterOid)}
            </div>
            <div>
              size: {report.stats.beforeBytes}B / {report.stats.beforeLines} lines → {report.stats.afterBytes}B /{' '}
              {report.stats.afterLines} lines
            </div>
            <div>
              entries: {report.stats.beforeEntities} → {report.stats.afterEntities}
            </div>
            <div className="col-span-2">
              schema_version: {report.stats.beforeSchemaVersion} → {report.stats.afterSchemaVersion}
            </div>
          </div>

          {diagnostics.displayNormalized && (
            <div className="rounded-xs bg-(--color-warning)/20 p-2 font-sans text-(--color-warning)">
              <Icon icon="triangle-exclamation" className="mr-2" />
              The committed side shown in the diff below was rewritten for display (schema migration + entries re-sorted
              to match your local copy). The analysis above is based on the untouched file, so it may list changes the
              diff view does not show.
            </div>
          )}

          {report.parseErrors.map(error => (
            <div key={error.side} className="rounded-xs bg-(--color-danger)/20 p-2 text-(--color-font-danger)">
              Failed to parse the {error.side} version: {error.message}
            </div>
          ))}

          {exportError && (
            <div className="rounded-xs bg-(--color-danger)/20 p-2 font-sans text-(--color-font-danger)">
              Could not export the committed YAML: {exportError}
            </div>
          )}

          {report.verdict === 'order-only' && (
            <div className="rounded-xs bg-(--hl-xs) p-2 font-sans text-(--color-font)">
              Every entry still has identical field values. Only the order in which they are written to the file
              changed, so committing this is safe and loses nothing.
            </div>
          )}

          <Section title="Content changes" count={report.contentChanged.length}>
            {report.contentChanged.slice(0, MAX_ROWS).map(entity => (
              <div key={entity.id} className="flex flex-col">
                <EntityLine entity={entity} />
                {entity.fields.map(field => (
                  <div key={field.field} className="pl-4 break-all">
                    <span className={field.isMetadata ? 'text-(--hl)' : 'text-(--color-font)'}>{field.field}</span>:{' '}
                    <span className="text-(--color-font-danger)">{field.before}</span>
                    <span className="text-(--hl)"> → </span>
                    <span className="text-(--color-font-success)">{field.after}</span>
                  </div>
                ))}
              </div>
            ))}
            <Truncated total={report.contentChanged.length} />
          </Section>

          <Section title="Added" count={report.added.length}>
            {report.added.slice(0, MAX_ROWS).map(entity => (
              <EntityLine key={entity.id} entity={entity} />
            ))}
            <Truncated total={report.added.length} />
          </Section>

          <Section title="Removed" count={report.removed.length}>
            {report.removed.slice(0, MAX_ROWS).map(entity => (
              <EntityLine key={entity.id} entity={entity} />
            ))}
            <Truncated total={report.removed.length} />
          </Section>

          <Section title="Moved to a different parent" count={report.moved.length}>
            {report.moved.slice(0, MAX_ROWS).map(entity => (
              <EntityLine key={entity.id} entity={entity} suffix={`${entity.fromContainer} → ${entity.toContainer}`} />
            ))}
            <Truncated total={report.moved.length} />
          </Section>

          <Section title="Reordered (same parent, position changed)" count={report.reordered.length}>
            {report.reordered.slice(0, MAX_ROWS).map(entity => (
              <EntityLine
                key={entity.id}
                entity={entity}
                suffix={`#${entity.fromIndex} → #${entity.toIndex} in ${entity.container}`}
              />
            ))}
            <Truncated total={report.reordered.length} />
          </Section>

          <Section title="Insomnia metadata only (timestamps / sort keys)" count={report.metadataChanged.length}>
            {report.metadataChanged.slice(0, MAX_ROWS).map(entity => (
              <div key={entity.id} className="flex flex-col">
                <EntityLine entity={entity} />
                {entity.fields.map(field => (
                  <div key={field.field} className="pl-4 break-all text-(--hl)">
                    {field.field}: {field.before} → {field.after}
                  </div>
                ))}
              </div>
            ))}
            <Truncated total={report.metadataChanged.length} />
          </Section>
        </div>
      )}
    </div>
  );
};
