import classNames from 'classnames';
import type { FC } from 'react';

import { Banner } from '~/basic-components/banner';
import { Icon } from '~/basic-components/icon';
import { LearnMoreLink } from '~/basic-components/link';
import { type ProjectScopeKeys, scopeToIconMap, scopeToLabelMap } from '~/common/get-workspace-label';
import type { ScannedInsomniaFile } from '~/main/git-service';

interface Props {
  isScanning: boolean;
  insomniaFiles: ScannedInsomniaFile[] | undefined;
  repoURI?: string;
  // "Open local folder" doesn't clone from anywhere and doesn't necessarily push
  // anywhere either, so the copy needs to drop the remote-specific wording.
  isLocalFolder?: boolean;
}

export const GitRepoScanResult: FC<Props> = ({ isScanning, insomniaFiles, repoURI, isLocalFolder }) => {
  const fileTypeCountMap: Partial<Record<ProjectScopeKeys, number>> = {};

  insomniaFiles?.forEach(({ scope }) => {
    if (!fileTypeCountMap[scope]) {
      fileTypeCountMap[scope] = 0;
    }
    fileTypeCountMap[scope]++;
  });

  return (
    <>
      <div className="rounded border border-solid border-(--hl-sm) px-4 pt-4 text-left">
        <h3 className="mb-2 text-lg font-bold text-(--color-font)">Insomnia files in {isLocalFolder ? 'folder' : 'repo'}</h3>
        <p className="mb-4 text-(--hl)">{repoURI}</p>
        {isScanning ? (
          <div className="flex min-h-[134px] flex-col justify-center">
            <p className="text-center text-base text-(--hl)">
              <Icon icon="circle-notch" className="mr-2 animate-spin" />
              {isLocalFolder ? 'Scanning folder for Insomnia files...' : 'Scanning remote repo for Insomnia files...'}
            </p>
          </div>
        ) : insomniaFiles?.length === 0 ? (
          <div className="flex min-h-[134px] flex-col justify-center">
            <p className="text-center text-base text-(--hl)">
              <span className="mb-2 block font-bold text-(--color-font)">
                No Insomnia files found − let’s start something new!
              </span>
              {isLocalFolder
                ? 'There were no Insomnia files in the selected folder, so you’ll begin with a blank project.'
                : 'There were no Insomnia files in the selected repo or branch, so you’ll begin with a blank project locally. When you commit and push changes, they will be available on the remote repo selected.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col justify-center py-2">
            <table className="text-base">
              <thead>
                <tr className="border-b border-solid border-(--hl-sm)">
                  <th className="w-[86px] pb-2 text-base normal-case">Count</th>
                  <th className="pb-2 text-base normal-case">File type</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(fileTypeCountMap)
                  .sort()
                  .map((scope, idx) => (
                    <tr key={scope}>
                      <td
                        className={classNames('pl-3 text-base leading-10 text-(--color-font)', {
                          'pt-2': idx === 0,
                        })}
                      >
                        {fileTypeCountMap[scope as ProjectScopeKeys]}
                      </td>
                      <td className={classNames('text-base leading-10 text-(--color-font)', { 'pt-2': idx === 0 })}>
                        <Icon icon={scopeToIconMap[scope as ProjectScopeKeys]} className="mr-2 w-4" />
                        {scopeToLabelMap[scope as ProjectScopeKeys]}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {insomniaFiles && insomniaFiles?.some(file => file.path === '.insomnia') && (
        <Banner
          type="warning"
          message={
            <>
              There are out of date Insomnia project files in the selected repo. By cloning this project, outdated files
              will automatically be migrated to the latest version.{' '}
              <LearnMoreLink href="https://developer.konghq.com/insomnia/storage/#what-happens-if-my-git-repository-contains-legacy-insomnia-content-when-i-create-a-git-sync-project" />
            </>
          }
          title="Migrate legacy files?"
          className="mt-4 text-left"
        />
      )}
    </>
  );
};
