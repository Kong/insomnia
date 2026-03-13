import React, { Fragment, type ReactNode, useEffect, useId, useState } from 'react';
import {
  Button,
  Dialog,
  FileTrigger,
  GridList,
  GridListItem,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  ToggleButton,
} from 'react-aria-components';
import { useParams } from 'react-router';

import type { CaCertificate } from '~/insomnia-data';
import { useCaCertDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.cacert.delete';
import { useCACertNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.cacert.new';
import { useCACertUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.cacert.update';
import { useClientCertDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.clientcert.delete';
import { useClientCertNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.clientcert.new';
import { useClientCertUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.clientcert.update';
import { Tooltip } from '~/ui/components/tooltip';

import type { ClientCertificate } from '../../../models/client-certificate';
import { useWorkspaceLoaderData } from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { Icon } from '../icon';
import { PasswordViewer } from '../viewers/password-viewer';

const AddClientCertificateModal = ({ onClose }: { onClose: () => void }) => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const createClientCertificateFetcher = useClientCertNewActionFetcher();
  const formId = useId();
  const [pfxPath, setPfxPath] = useState<string>('');
  const [certificatePath, setCertificatePath] = useState<string>('');
  const [keyPath, setKeyPath] = useState<string>('');

  useEffect(() => {
    if (createClientCertificateFetcher.data && createClientCertificateFetcher.data.certificate) {
      onClose();
    }
  }, [createClientCertificateFetcher.data, onClose]);

  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="fixed top-0 left-0 z-20 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex w-full max-w-lg flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)"
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-y-hidden outline-hidden">
          {({ close }) => (
            <div className="flex h-full flex-1 flex-col gap-4 overflow-y-hidden">
              <div className="flex items-center justify-between gap-2">
                <Heading slot="title" className="text-2xl">
                  Add Client Certificate
                </Heading>
                <Button
                  className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="flex w-full flex-1 basis-96 flex-col gap-2 overflow-y-auto rounded-sm px-2 select-none">
                <form
                  id={formId}
                  className="flex flex-col gap-2"
                  onSubmit={e => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);

                    const certificate = Object.fromEntries(formData.entries());

                    createClientCertificateFetcher.submit({
                      organizationId,
                      projectId,
                      workspaceId,
                      patch: {
                        ...certificate,
                        isPrivate: certificate.isPrivate === 'on',
                      },
                    });
                  }}
                >
                  <Input name="parentId" type="text" value={workspaceId} readOnly className="hidden" />
                  <Label className="flex flex-col gap-1" aria-label="Host">
                    <span className="text-sm">Host</span>
                    <Input
                      name="host"
                      type="text"
                      required
                      placeholder="example.com"
                      className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                    />
                  </Label>
                  <Tabs className="rounded-xs border border-solid border-(--hl-md)">
                    <TabList className="flex items-center border-b border-solid border-(--hl-md)">
                      <Tab
                        className="flex items-center gap-2 px-2 py-1 text-(--color-font) outline-hidden transition-colors hover:bg-(--hl-sm)/90 hover:no-underline aria-selected:bg-(--hl-md)"
                        id="certificate"
                      >
                        Certificate
                      </Tab>
                      <Tab
                        className="flex items-center gap-2 px-2 py-1 text-(--color-font) outline-hidden transition-colors hover:bg-(--hl-sm)/90 hover:no-underline aria-selected:bg-(--hl-md)"
                        id="pfx"
                      >
                        PFX or PKCS12
                      </Tab>
                    </TabList>
                    <TabPanel className="p-2" id="pfx">
                      <Label className="flex flex-col gap-1" aria-label="Host">
                        <span className="text-sm">PFX or PKCS12 file</span>
                        <FileTrigger
                          allowsMultiple={false}
                          onSelect={fileList => {
                            if (!fileList) {
                              return;
                            }
                            const files = Array.from(fileList);
                            const file = files[0];

                            setPfxPath(window.webUtils.getPathForFile(file));
                          }}
                        >
                          <Button className="flex h-full shrink-0 items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-sm) px-2 py-1 text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) aria-selected:bg-(--hl-sm)">
                            {!pfxPath && <Icon icon="plus" />}
                            <span className="truncate" title={pfxPath}>
                              {pfxPath ? pfxPath : 'Add PFX or PKCS12 file'}
                            </span>
                          </Button>
                        </FileTrigger>
                        <Input name="pfx" type="text" value={pfxPath} readOnly className="hidden" />
                      </Label>
                    </TabPanel>
                    <TabPanel className="flex w-full flex-col gap-2 overflow-hidden p-2" id="certificate">
                      <Label className="flex flex-1 flex-col gap-1" aria-label="Certificate">
                        <span className="text-sm">Certificate</span>
                        <FileTrigger
                          allowsMultiple={false}
                          onSelect={fileList => {
                            if (!fileList) {
                              return;
                            }
                            const files = Array.from(fileList);
                            const file = files[0];

                            setCertificatePath(window.webUtils.getPathForFile(file));
                          }}
                        >
                          <Button
                            data-test-id="add-client-certificate-file-chooser"
                            className="flex h-full shrink-0 items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-sm) px-2 py-1 text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) aria-selected:bg-(--hl-sm)"
                          >
                            {!certificatePath && <Icon icon="plus" />}
                            <span className="truncate" title={certificatePath}>
                              {certificatePath ? certificatePath : 'Add certificate file'}
                            </span>
                          </Button>
                        </FileTrigger>
                        <Input name="cert" type="text" value={certificatePath} readOnly className="hidden" />
                      </Label>
                      <Label className="flex flex-1 flex-col gap-1" aria-label="Key">
                        <span className="text-sm">Key</span>
                        <FileTrigger
                          allowsMultiple={false}
                          onSelect={fileList => {
                            if (!fileList) {
                              return;
                            }
                            const files = Array.from(fileList);
                            const file = files[0];

                            setKeyPath(window.webUtils.getPathForFile(file));
                          }}
                        >
                          <Button
                            data-test-id="add-client-certificate-key-file-chooser"
                            className="flex h-full shrink-0 items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-sm) px-2 py-1 text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) aria-selected:bg-(--hl-sm)"
                          >
                            {!keyPath && <Icon icon="plus" />}
                            <span className="truncate" title={keyPath}>
                              {keyPath ? keyPath : 'Add key file'}
                            </span>
                          </Button>
                        </FileTrigger>
                        <Input name="key" type="text" value={keyPath} readOnly className="hidden" />
                      </Label>
                    </TabPanel>
                  </Tabs>

                  <Label className="flex flex-col gap-1" aria-label="Passphrase">
                    <span className="text-sm">Passphrase</span>
                    <Input
                      name="passphrase"
                      type="password"
                      className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                    />
                  </Label>
                </form>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  onPress={close}
                  className="rounded-xs border border-solid border-(--hl-md) px-3 py-2 text-(--color-font) transition-colors hover:border-(--hl-sm) hover:no-underline"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form={formId}
                  className="flex items-center gap-2 rounded-xs border border-solid border-(--hl-md) bg-(--color-surprise) px-3 py-2 text-(--color-font-surprise) transition-colors hover:border-(--hl-sm) hover:no-underline"
                >
                  <Icon icon="plus" />
                  <span>Add certificate</span>
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

const ClientCertificateGridListItem = ({ certificate }: { certificate: ClientCertificate }) => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const updateClientCertificateFetcher = useClientCertUpdateActionFetcher();
  const deleteClientCertificateFetcher = useClientCertDeleteActionFetcher();

  return (
    <GridListItem className="flex flex-col items-center justify-between gap-2 p-4 outline-hidden ring-inset focus:ring-1 focus:ring-(--hl-md)">
      <div className="flex w-full items-center gap-2">
        {Boolean(certificate.pfx || certificate.cert) && (
          <Tooltip message={certificate.pfx || certificate.cert || ''} position="top">
            <Icon icon="file-contract" className="w-4" />
          </Tooltip>
        )}
        {certificate.key && (
          <Tooltip message={certificate.key} position="top">
            <Icon icon="key" />
          </Tooltip>
        )}
        <div className="flex-1 truncate text-sm text-(--color-font)">{certificate.host}</div>
        {certificate.passphrase && (
          <div className="flex items-center gap-2 truncate">
            <span className="text-sm">{'Password:'}</span>
            <div className="truncate text-sm">
              <PasswordViewer text={certificate.passphrase} />
            </div>
          </div>
        )}
        <div className="flex h-6 items-center gap-2">
          <ToggleButton
            data-test-id="client-certificate-toggle"
            onChange={isSelected => {
              updateClientCertificateFetcher.submit({
                organizationId,
                projectId,
                workspaceId,
                patch: {
                  ...certificate,
                  disabled: !isSelected,
                },
              });
            }}
            isSelected={!certificate.disabled}
            className="flex h-full w-[12ch] shrink-0 items-center justify-start gap-2 rounded-xs px-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
          >
            {({ isSelected }) => (
              <Fragment>
                <Icon
                  icon={isSelected ? 'toggle-on' : 'toggle-off'}
                  className={`${isSelected ? 'text-(--color-success)' : ''}`}
                />
                <span>{isSelected ? 'Enabled' : 'Disabled'}</span>
              </Fragment>
            )}
          </ToggleButton>
          <Button
            isDisabled={deleteClientCertificateFetcher.state !== 'idle'}
            onPress={() => {
              deleteClientCertificateFetcher.submit({
                organizationId,
                projectId,
                workspaceId,
                _id: certificate._id,
              });
            }}
            className="flex aspect-square h-full shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
          >
            <Icon icon="trash" />
          </Button>
        </div>
      </div>
    </GridListItem>
  );
};

export const CACertificate = ({ caCertificate, tip }: { caCertificate?: CaCertificate; tip?: ReactNode }) => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const createCertificateFetcher = useCACertNewActionFetcher();
  const deleteCertificateFetcher = useCaCertDeleteActionFetcher();
  const updateCertificateFetcher = useCACertUpdateActionFetcher();

  return (
    <>
      <Heading className="text-xl">CA Certificate</Heading>
      <p className="max-w-[80ch] text-sm text-(--hl)">
        {tip ||
          'One or more PEM format certificates in a single file to pass to curl. Overrides the root CA certificate. On MacOS please upload your local Keychain certificates here.'}
      </p>
      <div className="flex flex-col gap-2">
        {caCertificate ? (
          <div className="flex items-center justify-between gap-2 rounded-sm border border-solid border-(--hl-sm) p-4">
            <Tooltip message={caCertificate.path || ''} position="top">
              <Icon icon="file-contract" className="w-4" />
            </Tooltip>
            <div className="flex-1 truncate text-sm text-(--color-font)" title={caCertificate.path || ''}>
              {caCertificate?.path?.split('\\')?.pop()?.split('/')?.pop()}
            </div>
            <div className="flex h-6 items-center gap-2">
              <ToggleButton
                onChange={isSelected => {
                  updateCertificateFetcher.submit({
                    organizationId,
                    projectId,
                    workspaceId,
                    patch: { _id: caCertificate._id, disabled: !isSelected },
                  });
                }}
                isSelected={!caCertificate.disabled}
                className="flex h-full w-[12ch] shrink-0 items-center justify-start gap-2 rounded-sm px-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
              >
                {({ isSelected }) => (
                  <Fragment>
                    <Icon
                      icon={isSelected ? 'toggle-on' : 'toggle-off'}
                      className={`${isSelected ? 'text-(--color-success)' : ''}`}
                    />
                    <span>{isSelected ? 'Enabled' : 'Disabled'}</span>
                  </Fragment>
                )}
              </ToggleButton>
              <Button
                isDisabled={deleteCertificateFetcher.state !== 'idle'}
                onPress={() => {
                  deleteCertificateFetcher.submit({
                    organizationId,
                    projectId,
                    workspaceId,
                  });
                }}
                className="flex aspect-square h-full shrink-0 items-center justify-center rounded-sm text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
              >
                <Icon icon="trash" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <FileTrigger
              acceptedFileTypes={['.pem']}
              allowsMultiple={false}
              onSelect={fileList => {
                if (!fileList) {
                  return;
                }
                const files = Array.from(fileList);
                const file = files[0];

                createCertificateFetcher.submit({
                  organizationId,
                  projectId,
                  workspaceId,
                  patch: { parentId: workspaceId, path: window.webUtils.getPathForFile(file) },
                });
              }}
            >
              <Button className="flex h-full flex-1 shrink-0 items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-sm) px-2 py-1 text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) aria-selected:bg-(--hl-sm)">
                <Icon icon="plus" />
                <span>Add CA Certificate</span>
              </Button>
            </FileTrigger>
          </div>
        )}
      </div>
    </>
  );
};

export const CertificatesModal = ({ onClose }: { onClose: () => void }) => {
  const { workspaceId } = useParams() as {
    workspaceId: string;
  };

  const routeData = useWorkspaceLoaderData()!;

  const [isAddClientCertificateModalOpen, setIsAddClientCertificateModalOpen] = useState(false);

  const { caCertificate, clientCertificates } = routeData;

  if (!workspaceId) {
    return null;
  }

  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex h-[calc(100%-var(--padding-xl))] w-full max-w-3xl flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)"
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden">
          {({ close }) => (
            <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <Heading slot="title" className="flex items-center gap-2 text-2xl">
                  Manage Certificates
                </Heading>
                <Button
                  className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-sm text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="flex w-full flex-1 basis-96 flex-col gap-6 overflow-hidden overflow-y-auto rounded select-none">
                <CACertificate caCertificate={caCertificate} />
                <div className="flex items-center justify-between gap-2">
                  <Heading className="text-xl">Client Certificates</Heading>
                  <Button
                    onPress={() => {
                      setIsAddClientCertificateModalOpen(true);
                    }}
                    className="flex h-full shrink-0 items-center justify-center gap-2 rounded-xs px-2 text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) aria-selected:bg-(--hl-sm)"
                  >
                    <Icon icon="plus" />
                    <span>Add client certificate</span>
                  </Button>
                </div>
                {isAddClientCertificateModalOpen && (
                  <AddClientCertificateModal
                    onClose={() => {
                      setIsAddClientCertificateModalOpen(false);
                    }}
                  />
                )}
                <GridList
                  className="divide-y divide-solid divide-(--hl-md) overflow-y-auto rounded-xs border border-solid border-(--hl-md)"
                  items={clientCertificates.map(cert => ({
                    cert,
                    id: cert._id,
                    key: cert._id,
                  }))}
                >
                  {item => <ClientCertificateGridListItem certificate={item.cert} />}
                </GridList>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  onPress={close}
                  className="rounded-xs border border-solid border-(--hl-md) px-3 py-2 text-(--color-font) transition-colors hover:no-underline"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
