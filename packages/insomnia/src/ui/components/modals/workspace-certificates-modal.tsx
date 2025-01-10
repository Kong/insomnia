import React, { Fragment, useEffect, useId, useState } from 'react';
import { Button, Dialog, FileTrigger, GridList, GridListItem, Heading, Input, Label, Modal, ModalOverlay, Tab, TabList, TabPanel, Tabs, ToggleButton } from 'react-aria-components';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import type { ClientCertificate } from '../../../models/client-certificate';
import type { WorkspaceLoaderData } from '../../routes/workspace';
import { Icon } from '../icon';
import { PasswordViewer } from '../viewers/password-viewer';

const AddClientCertificateModal = ({ onClose }: { onClose: () => void }) => {
  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();

  const createClientCertificateFetcher = useFetcher();
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
      className="w-full h-[--visual-viewport-height] fixed z-20 top-0 left-0 flex items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex flex-col w-full max-w-lg rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] bg-[--color-bg] text-[--color-font]"
      >
        <Dialog
          className="outline-none flex-1 h-full flex flex-col overflow-y-hidden"
        >
          {({ close }) => (
            <div className='flex-1 flex flex-col gap-4 overflow-y-hidden h-full'>
              <div className='flex gap-2 items-center justify-between'>
                <Heading slot="title" className='text-2xl'>Add Client Certificate</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className='rounded flex-1 w-full basis-96 flex flex-col gap-2 select-none px-2 overflow-y-auto'>
                <form
                  id={formId}
                  className='flex flex-col gap-2'
                  onSubmit={e => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);

                    const certificate = Object.fromEntries(formData.entries());

                    createClientCertificateFetcher.submit({
                      ...certificate,
                      isPrivate: certificate.isPrivate === 'on',
                    }, {
                      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/clientcert/new`,
                      method: 'post',
                      encType: 'application/json',
                    });
                  }}
                >
                  <Input
                    name='parentId'
                    type='text'
                    value={workspaceId}
                    readOnly
                    className='hidden'
                  />
                  <Label className='flex flex-col gap-1' aria-label='Host'>
                    <span className='text-sm'>Host</span>
                    <Input
                      name='host'
                      type='text'
                      required
                      placeholder='example.com'
                      className='py-1 w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors'
                    />
                  </Label>
                  <Tabs className="rounded-sm border border-solid border-[--hl-md]">
                    <TabList className="flex items-center border-b border-solid border-[--hl-md]">
                      <Tab className="hover:no-underline aria-selected:bg-[--hl-md] hover:bg-[--hl-sm] outline-none gap-2 flex items-center hover:bg-opacity-90 py-1 px-2 text-[--color-font] transition-colors" id="certificate">Certificate</Tab>
                      <Tab className="hover:no-underline aria-selected:bg-[--hl-md] hover:bg-[--hl-sm] outline-none gap-2 flex items-center hover:bg-opacity-90 py-1 px-2 text-[--color-font] transition-colors" id="pfx">PFX or PKCS12</Tab>
                    </TabList>
                    <TabPanel className="p-2" id="pfx">
                      <Label className='flex flex-col gap-1' aria-label='Host'>
                        <span className='text-sm'>PFX or PKCS12 file</span>
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
                          <Button className="flex flex-shrink-0 border-solid border border-[--hl-sm] py-1 gap-2 items-center justify-center px-2 h-full aria-pressed:bg-[--hl-sm] aria-selected:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-base">
                            {!pfxPath && <Icon icon="plus" />}
                            <span className='truncate' title={pfxPath}>{pfxPath ? pfxPath : 'Add PFX or PKCS12 file'}</span>
                          </Button>
                        </FileTrigger>
                        <Input
                          name='pfx'
                          type='text'
                          value={pfxPath}
                          readOnly
                          className='hidden'
                        />
                      </Label>
                    </TabPanel>
                    <TabPanel className="flex flex-col overflow-hidden w-full gap-2 p-2" id="certificate">
                      <Label className='flex-1 flex flex-col gap-1' aria-label='Certificate'>
                        <span className='text-sm'>Certificate</span>
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
                          <Button data-test-id='add-client-certificate-file-chooser' className="flex flex-shrink-0 border-solid border border-[--hl-sm] py-1 gap-2 items-center justify-center px-2 h-full aria-pressed:bg-[--hl-sm] aria-selected:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-base">
                            {!certificatePath && <Icon icon="plus" />}
                            <span className='truncate' title={certificatePath}>{certificatePath ? certificatePath : 'Add certificate file'}</span>
                          </Button>
                        </FileTrigger>
                        <Input
                          name='cert'
                          type='text'
                          value={certificatePath}
                          readOnly
                          className='hidden'
                        />
                      </Label>
                      <Label className='flex-1 flex flex-col gap-1' aria-label='Key'>
                        <span className='text-sm'>Key</span>
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
                          <Button data-test-id='add-client-certificate-key-file-chooser' className="flex flex-shrink-0 border-solid border border-[--hl-sm] py-1 gap-2 items-center justify-center px-2 h-full aria-pressed:bg-[--hl-sm] aria-selected:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-base">
                            {!keyPath && <Icon icon="plus" />}
                            <span className='truncate' title={keyPath}>{keyPath ? keyPath : 'Add key file'}</span>
                          </Button>
                        </FileTrigger>
                        <Input
                          name='key'
                          type='text'
                          value={keyPath}
                          readOnly
                          className='hidden'
                        />
                      </Label>
                    </TabPanel>
                  </Tabs>

                  <Label className='flex flex-col gap-1' aria-label='Passphrase'>
                    <span className='text-sm'>Passphrase</span>
                    <Input
                      name='passphrase'
                      type='password'
                      className='py-1 w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors'
                    />
                  </Label>
                </form>
              </div>
              <div className='flex items-center gap-2 justify-end'>
                <Button
                  onPress={close}
                  className="hover:no-underline hover:bg-opacity-90 border border-solid border-[--hl-md] hover:border-[--hl-sm] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
                >
                  Cancel
                </Button>
                <Button type="submit" form={formId} className="hover:no-underline gap-2 flex items-center bg-opacity-100 bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] text-[--color-font-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] hover:border-[--hl-sm] py-2 px-3 transition-colors rounded-sm">
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

const ClientCertificateGridListItem = ({ certificate }: {
  certificate: ClientCertificate;
}) => {
  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();
  const updateClientCertificateFetcher = useFetcher();
  const deleteClientCertificateFetcher = useFetcher();

  return (
    <GridListItem className="outline-none flex flex-col gap-2 items-center justify-between p-4 ring-inset focus:ring-1 focus:ring-[--hl-md]">
      <div className='flex items-center gap-2 w-full'>
        {Boolean(certificate.pfx || certificate.cert) && <Icon icon="file-contract" className='w-4' title={certificate.pfx || certificate.cert || ''} />}
        {certificate.key && <Icon icon="key" title={certificate.key} />}
        <div className='flex-1 text-sm text-[--color-font] truncate'>{certificate.host}</div>
        {certificate.passphrase && (
          <div className='flex items-center gap-2 truncate'>
            <span className='text-sm'>{'Password:'}</span>
            <div className='truncate text-sm'>
              <PasswordViewer text={certificate.passphrase} />
            </div>
          </div>
        )}
        <div className='flex items-center gap-2 h-6'>
          <ToggleButton
            data-test-id="client-certificate-toggle"
            onChange={isSelected => {
              updateClientCertificateFetcher.submit({ ...certificate, disabled: !isSelected }, {
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/clientcert/update`,
                method: 'post',
                encType: 'application/json',
              });
            }}
            isSelected={!certificate.disabled}
            className="w-[12ch] flex flex-shrink-0 gap-2 items-center justify-start px-2 h-full rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
          >
            {({ isSelected }) => (
              <Fragment>
                <Icon icon={isSelected ? 'toggle-on' : 'toggle-off'} className={`${isSelected ? 'text-[--color-success]' : ''}`} />
                <span>{
                  isSelected ? 'Enabled' : 'Disabled'
                }</span>
              </Fragment>
            )}
          </ToggleButton>
          <Button
            isDisabled={deleteClientCertificateFetcher.state !== 'idle'}
            onPress={() => {
              deleteClientCertificateFetcher.submit(JSON.stringify(certificate), {
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/clientcert/delete`,
                method: 'delete',
                encType: 'application/json',
              });
            }}
            className="flex flex-shrink-0 items-center justify-center aspect-square h-full aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
          >
            <Icon icon="trash" />
          </Button>
        </div>
      </div>
    </GridListItem>
  );
};

export const CertificatesModal = ({ onClose }: {
  onClose: () => void;
}) => {
  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();

  const routeData = useRouteLoaderData(
    ':workspaceId'
  ) as WorkspaceLoaderData;

  const [isAddClientCertificateModalOpen, setIsAddClientCertificateModalOpen] = useState(false);

  const createCertificateFetcher = useFetcher();
  const deleteCertificateFetcher = useFetcher();
  const updateCertificateFetcher = useFetcher();

  const {
    caCertificate,
    clientCertificates,
  } = routeData;

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
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex flex-col w-full max-w-3xl h-[calc(100%-var(--padding-xl))] rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] bg-[--color-bg] text-[--color-font]"
      >
        <Dialog
          className="outline-none flex-1 h-full flex flex-col overflow-hidden"
        >
          {({ close }) => (
            <div className='flex-1 flex flex-col gap-4 overflow-hidden h-full'>
              <div className='flex gap-2 items-center justify-between'>
                <Heading slot="title" className='text-2xl flex items-center gap-2'>Manage Certificates</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className='rounded flex-1 w-full overflow-hidden basis-96 flex flex-col gap-6 select-none overflow-y-auto'>
                <Heading className='text-xl'>CA Certificate</Heading>
                <div className='flex flex-col gap-2'>
                  {caCertificate ? (
                    <div className='flex gap-2 items-center justify-between rounded-sm border border-solid border-[--hl-sm] p-4'>
                      <Icon icon="file-contract" className='w-4' />
                      <div className='flex-1 text-sm text-[--color-font] truncate' title={caCertificate.path || ''}>{caCertificate?.path?.split('\\')?.pop()?.split('/')?.pop()}</div>
                      <div className='flex items-center gap-2 h-6'>
                        <ToggleButton
                          onChange={isSelected => {
                            updateCertificateFetcher.submit({ _id: caCertificate._id, disabled: !isSelected }, {
                              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/cacert/update`,
                              method: 'post',
                              encType: 'application/json',
                            });
                          }}
                          isSelected={!caCertificate.disabled}
                          className="w-[12ch] flex flex-shrink-0 gap-2 items-center justify-start px-2 h-full rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                        >
                          {({ isSelected }) => (
                            <Fragment>
                              <Icon icon={isSelected ? 'toggle-on' : 'toggle-off'} className={`${isSelected ? 'text-[--color-success]' : ''}`} />
                              <span>{
                                isSelected ? 'Enabled' : 'Disabled'
                              }</span>
                            </Fragment>
                          )}
                        </ToggleButton>
                        <Button
                          isDisabled={deleteCertificateFetcher.state !== 'idle'}
                          onPress={() => {
                            deleteCertificateFetcher.submit({}, {
                              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/cacert/delete`,
                              method: 'delete',
                            });
                          }}
                          className="flex flex-shrink-0 items-center justify-center aspect-square h-full aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                        >
                          <Icon icon="trash" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className='flex gap-2 items-center justify-between'>
                      <FileTrigger
                        acceptedFileTypes={['.pem']}
                        allowsMultiple={false}
                        onSelect={fileList => {
                          if (!fileList) {
                            return;
                          }
                          const files = Array.from(fileList);
                          const file = files[0];

                          createCertificateFetcher.submit({ parentId: workspaceId, path: window.webUtils.getPathForFile(file) }, {
                            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/cacert/new`,
                            method: 'post',
                            encType: 'application/json',
                          });
                        }}
                      >
                        <Button className="flex flex-1 flex-shrink-0 border-solid border border-[--hl-sm] py-1 gap-2 items-center justify-center px-2 h-full aria-pressed:bg-[--hl-sm] aria-selected:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-base">
                          <Icon icon="plus" />
                          <span>Add CA Certificate</span>
                        </Button>
                      </FileTrigger>
                    </div>
                  )}
                  <p className="text-sm text-[--hl] italic max-w-[80ch]">
                    <Icon icon='info-circle' className='pr-2' />
                    One or more PEM format certificates in a single file to pass to curl. Overrides the root CA certificate.
                    On MacOS please upload your local Keychain certificates here.
                  </p>
                </div>
                <div className='flex items-center gap-2 justify-between'>
                  <Heading className='text-xl'>Client Certificates</Heading>
                  <Button
                    onPress={() => {
                      setIsAddClientCertificateModalOpen(true);
                    }}
                    className="flex flex-shrink-0 gap-2 items-center justify-center px-2 h-full aria-pressed:bg-[--hl-sm] aria-selected:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-base"
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
                  className="border border-solid border-[--hl-md] rounded-sm divide-y divide-solid divide-[--hl-md] overflow-y-auto"
                  items={clientCertificates.map(cert => ({
                    cert,
                    id: cert._id,
                    key: cert._id,
                  }))}
                >
                  {item => <ClientCertificateGridListItem certificate={item.cert} />}
                </GridList>
              </div>
              <div className='flex items-center gap-2 justify-end'>
                <Button
                  onPress={close}
                  className="hover:no-underline hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
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
