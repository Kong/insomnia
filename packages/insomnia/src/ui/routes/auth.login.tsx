import React from 'react';
import { Button, Dialog, DialogTrigger, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { ActionFunction, Link, redirect, useFetcher, useNavigate } from 'react-router-dom';

import { getAppWebsiteBaseURL } from '../../common/constants';
import { exportAllData } from '../../common/export-all-data';
import { SegmentEvent } from '../analytics';
import { getLoginUrl } from '../auth-session-provider';
import { Icon } from '../components/icon';
import { showAlert } from '../components/modals';
import { useRootLoaderData } from './root';

const GoogleIcon = (props: React.ReactSVGElement['props']) => {
  return (
    <svg {...props} viewBox="0 0 22 22">
      <path
        d="M19.9885 9.20471H19.2502V9.16667H11.0002V12.8333H16.1807C15.4249 14.9678 13.394 16.5 11.0002 16.5C7.96279 16.5 5.50016 14.0374 5.50016 11C5.50016 7.96263 7.96279 5.5 11.0002 5.5C12.4022 5.5 13.6777 6.02892 14.649 6.89288L17.2417 4.30009C15.6046 2.77429 13.4147 1.83334 11.0002 1.83334C5.93787 1.83334 1.8335 5.93771 1.8335 11C1.8335 16.0623 5.93787 20.1667 11.0002 20.1667C16.0625 20.1667 20.1668 16.0623 20.1668 11C20.1668 10.3854 20.1036 9.78542 19.9885 9.20471Z"
        fill="#FFC107"
      />
      <path
        d="M2.89014 6.73338L5.90185 8.94209C6.71676 6.9245 8.69035 5.5 10.9999 5.5C12.4019 5.5 13.6775 6.02892 14.6487 6.89288L17.2415 4.30009C15.6043 2.77429 13.4144 1.83334 10.9999 1.83334C7.47897 1.83334 4.42555 3.82113 2.89014 6.73338Z"
        fill="#FF3D00"
      />
      <path
        d="M11 20.1667C13.3677 20.1667 15.5191 19.2605 17.1458 17.787L14.3087 15.3863C13.3884 16.0834 12.2444 16.5 11 16.5C8.61573 16.5 6.59127 14.9797 5.82861 12.8581L2.83936 15.1612C4.35644 18.1298 7.43736 20.1667 11 20.1667Z"
        fill="#4CAF50"
      />
      <path
        d="M19.9884 9.20471H19.25V9.16666H11V12.8333H16.1805C15.8175 13.8586 15.158 14.7427 14.3073 15.3867C14.3078 15.3862 14.3083 15.3862 14.3087 15.3858L17.1458 17.7865C16.945 17.969 20.1667 15.5833 20.1667 11C20.1667 10.3854 20.1034 9.78541 19.9884 9.20471Z"
        fill="#1976D2"
      />
    </svg>
  );
};

export const action: ActionFunction = async ({
  request,
}) => {
  const data = await request.formData();
  const provider = data.get('provider');
  const url = new URL(getLoginUrl());

  if (typeof provider === 'string' && provider) {
    url.searchParams.set('provider', provider);
  }

  window.main.openInBrowser(url.toString());

  return redirect('/auth/authorize');
};

const Login = () => {
  const loginFetcher = useFetcher();
  const navigate = useNavigate();
  const { workspaceCount } = useRootLoaderData();

  const login = (provider: string) => {
      loginFetcher.submit({
        provider,
      }, {
        action: '/auth/login',
        method: 'POST',
      });
  };

  return (
    <div
      className='flex flex-col gap-[--padding-md]'
    >
      <p className='text-center text-[--color-font] text-2xl py-[--padding-md]'>
        Welcome to Insomnia
      </p>
      <p className='text-[--color-font] text-sm'>
        Discover Local, Cloud or Git storage for your projects.
      </p>
      <Button
        aria-label='Continue with Google'
        onPress={() => {
          login('google');
        }}
        className="w-full items-center border border-solid border-[--hl-md] flex justify-center gap-[--padding-md] aria-pressed:bg-[--hl-sm] rounded-md text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-base"
      >
        <div className='w-[40px] h-[35px] border-r border-solid border-[--hl-sm] flex items-center justify-center bg-[--hl-xs]'>
          <GoogleIcon width="1em" />
        </div>
        <span className='flex-1 items'>
          Continue with Google

        </span>
      </Button>
      <Button
        aria-label='Continue with GitHub'
        onPress={() => {
          login('github');
        }}
        className="w-full items-center border border-solid border-[--hl-md] flex justify-center gap-[--padding-md] aria-pressed:bg-[--hl-sm] rounded-md text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-base"
      >
        <div className='w-[40px] h-[35px] border-r border-solid border-[--hl-sm] flex items-center justify-center bg-[--hl-xs]'>
          <Icon icon={['fab', 'github']} />
        </div>
        <span className='flex-1 items'>
          Continue with GitHub
        </span>
      </Button>
      <Button
        aria-label='Continue with Email'
        onPress={() => {
          login('email');
        }}
        className="w-full items-center border border-solid border-[--hl-md] flex justify-center gap-[--padding-md] aria-pressed:bg-[--hl-sm] rounded-md text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-base"
      >
        <div className='w-[40px] h-[35px] border-r border-solid border-[--hl-sm] flex items-center justify-center bg-[--hl-xs]'>
          <Icon icon="envelope" />
        </div>
        <span className='flex-1 items'>
          Continue with Email
        </span>
      </Button>
      <Button
        aria-label='Continue with SSO'
        onPress={() => {
          login('sso');
        }}
        className="w-full items-center border border-solid border-[--hl-md] flex justify-center gap-[--padding-md] aria-pressed:bg-[--hl-sm] rounded-md text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-base"
      >
        <div className='w-[40px] h-[35px] border-r border-solid border-[--hl-sm] flex items-center justify-center bg-[--hl-xs]'>
          <Icon icon="key" />
        </div>
        <span className='flex-1 items'>
          Continue with SSO
        </span>
      </Button>

      <p className='text-[rgba(var(--color-font-rgb),0.8)] text-xs text-center'>
        By signing up or using Insomnia, you agree to the{' '}
        <a
          className='font-bold outline-none transition-colors hover:text-[--color-font] focus:text-[--color-font]'
          href="https://insomnia.rest/terms"
          rel="noreferrer"
        >
          terms of service
        </a>{' '}
        and{' '}
        <a
          className='font-bold outline-none transition-colors hover:text-[--color-font] focus:text-[--color-font]'
          href="https://insomnia.rest/privacy"
          rel="noreferrer"
        >
          privacy policy
        </a>
        .
      </p>

      <div className='flex gap-[--padding-md] justify-between'>
        <Button
          onPress={() => {
            window.main.trackSegmentEvent({
              event: SegmentEvent.selectScratchpad,
            });
            navigate('/organization/org_scratchpad/project/proj_scratchpad/workspace/wrk_scratchpad/debug');
          }}
          aria-label='Use the Scratch Pad'
          className='flex outline-none transition-colors justify-center text-[rgba(var(--color-font-rgb),0.8)] text-sm gap-[--padding-xs] hover:text-[--color-font] focus:text-[--color-font]'
        >
          <div>
            <i className='fa fa-edit' />
          </div>
          <span>
            Use the local Scratch Pad
          </span>
        </Button>
        <DialogTrigger>
          <Button
            aria-label='Export data and more'
            className='flex transition-colors justify-center text-[rgba(var(--color-font-rgb),0.8)] text-sm gap-[--padding-xs] hover:text-[--color-font] focus:text-[--color-font]'
          >
            <div>
              <i className='fa fa-database' />
            </div>
            <span>
              Export data and more
            </span>
          </Button>
          <ModalOverlay isDismissable className="w-full h-[--visual-viewport-height] fixed top-0 left-0 flex items-center justify-center bg-black/30">
            <Modal className="max-w-lg w-full rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] max-h-full bg-[--color-bg] text-[--color-font]">
              <Dialog className="outline-none">
                {({ close }) => (
                  <div className='flex flex-col gap-4'>
                    <div className='flex gap-2 items-center justify-between'>
                      <Heading className='text-2xl'>Export data and more</Heading>
                      <Button
                        className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                        onPress={close}
                      >
                        <Icon icon="x" />
                      </Button>
                    </div>
                    <p className='text-sm text-[rgba(var(--color-font-rgb),0.8)]'>
                      With Insomnia you can choose where to store your projects: locally with Local Vault, in the cloud with Cloud Sync or in a Git repository (Git Sync). Even with an account, your data is stored based on your settings.
                    </p>
                    <p className='text-sm text-[rgba(var(--color-font-rgb),0.8)]'>
                      You can get started with an account which gives you access to the best Insomnia experience (recommended):
                    </p>
                    <Button
                      onPress={() => {
                        window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/subscribe?plan=free`);
                      }}
                      aria-label='Get started for free'
                      className="px-4 py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-base"
                    >
                      <span>
                        Get started for free
                      </span>
                      <Icon icon='arrow-right' />
                    </Button>

                    <p className='text-sm text-[rgba(var(--color-font-rgb),0.8)]'>
                      You can use Insomnia without an account in a limited way (only 1 collection) with the local Scratch Pad:
                    </p>

                    <Link
                      to="/organization/org_scratchpad/project/proj_scratchpad/workspace/wrk_scratchpad/debug"
                      aria-label='Go to Scratch Pad'
                      className="px-4 py-1 outline-none font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-base"
                    >
                      <span>
                        Go to Scratch Pad
                      </span>
                      <Icon icon='arrow-right' />
                    </Link>

                    <p className='text-sm text-[rgba(var(--color-font-rgb),0.8)]'>
                      Finally, you can export your local Insomnia data (projects, collections and other files) for portability:

                    </p>

                    <Button
                      onPress={async () => {
                        const { filePaths, canceled } = await window.dialog.showOpenDialog({
                          properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
                          buttonLabel: 'Select',
                          title: 'Export All Insomnia Data',
                        });

                        if (canceled) {
                          return;
                        }

                        const [dirPath] = filePaths;

                        try {
                          dirPath && await exportAllData({
                            dirPath,
                          });
                        } catch (e) {
                          showAlert({
                            title: 'Export Failed',
                            message: 'An error occurred while exporting data. Please try again.',
                          });
                          console.error(e);
                        }

                        showAlert({
                          title: 'Export Complete',
                          message: 'All your data have been successfully exported',
                        });
                        window.main.trackSegmentEvent({
                          event: SegmentEvent.exportAllCollections,
                        });
                      }}
                      aria-label='Export all data'
                      className="px-4 py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-base"
                    >
                      <Icon icon="file-export" />
                      <span>Export all data {`(${workspaceCount} files)`}</span>
                    </Button>
                  </div>
                )}
              </Dialog>
            </Modal>
          </ModalOverlay>
        </DialogTrigger>
      </div>
    </div>
  );
};

export default Login;
