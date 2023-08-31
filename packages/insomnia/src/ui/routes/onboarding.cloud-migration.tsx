import React from 'react';
import { Button } from 'react-aria-components';
import { ActionFunction, LoaderFunction, redirect, useFetcher } from 'react-router-dom';

import { database } from '../../common/database';
import { exportAllData } from '../../common/export-all-data';
import { project } from '../../models';
import { InsomniaLogo } from '../components/insomnia-icon';
import { showAlert } from '../components/modals';
import { TrailLinesContainer } from '../components/trail-lines-container';

export const action: ActionFunction = async () => {
  window.localStorage.setItem('hasSeenOnboarding', 'true');

  return redirect('/auth/login');
};

export const loader: LoaderFunction = async () => {
  const localProjects = await database.find(project.type, {
    remoteId: null,
  });

  if (localProjects.length > 0) {
    return null;
  }

  return redirect('/auth/login');
};

export const OnboardingCloudMigration = () => {
  const { Form, state } = useFetcher();
  return (
    <div className='relative h-full w-full text-left text-base flex bg-[--color-bg]'>
      <TrailLinesContainer>
        <div
          className='flex justify-center items-center flex-col h-full w-[540px] min-h-[min(450px,90%)]'
        >
          <div
            className='flex flex-col gap-[var(--padding-sm)] items-center justify-center p-[--padding-lg] pt-12 w-full h-full bg-[--hl-xs] rounded-[var(--radius-md)] border-solid border border-[--hl-sm] relative'
          >
            <InsomniaLogo
              className='transform translate-x-[-50%] translate-y-[-50%] absolute top-0 left-1/2 w-16 h-16'
            />
            <div className='text-[--color-font] flex flex-col gap-4'>
              <h1 className='text-xl text-center'>Activating cloud synchronization</h1>
              <div className='flex flex-col gap-4'>
                <p>
                  We have detected that you have previously created data with Insomnia, which will be automatically synchronized to the cloud after logging-in or creating a new account. Your data is end-to-end encrypted (E2EE) and secure.
                </p>
                <ul className='text-left flex flex-col gap-2'>
                  <li><i className="fa fa-check text-emerald-600" /> End-to-end encryption (E2EE) enabled.</li>
                  <li><i className="fa fa-check text-emerald-600" /> Automatic sync across clients enabled.</li>
                  <li><i className="fa fa-check text-emerald-600" /> Unlimited user collaboration activated.</li>
                </ul>
              </div>
              <div className="flex justify-center items-center py-6">
                <svg
                  viewBox="0 0 480 108"
                  xmlns="http://www.w3.org/2000/svg"
                  fillRule="evenodd"
                  clipRule="evenodd"
                >
                  <path
                    d="M103.5 8c0-4.139-3.361-7.5-7.5-7.5H8A7.504 7.504 0 00.5 8v88c0 4.139 3.361 7.5 7.5 7.5h88c4.139 0 7.5-3.361 7.5-7.5V8z"
                    fill="#1f1f1f"
                    transform="translate(-272 -246) translate(274 248)"
                  />
                  <path
                    d="M43.176 31.412h12.5l8.088 4.411 4.412 6.618v21.324h-25V31.412z"
                    fill="#fff"
                    fillOpacity={0.9}
                    fillRule="nonzero"
                    transform="translate(-272 -246) translate(274 248)"
                  />
                  <path
                    d="M66.584 66.583H43.667c-1.146 0-2.127-.408-2.943-1.224-.816-.816-1.224-1.797-1.224-2.942V33.25c0-1.146.408-2.127 1.224-2.943.816-.816 1.797-1.224 2.943-1.224H58.25l12.5 12.5v20.834c0 1.145-.408 2.126-1.224 2.942-.816.816-1.796 1.224-2.942 1.224zM56.167 43.667V33.25h-12.5v29.167h22.917v-18.75H56.167zm-20.833 31.25c-1.146 0-2.127-.408-2.943-1.224-.816-.816-1.224-1.797-1.224-2.943V41.583h4.167V70.75H58.25v4.167H35.334z"
                    fill="url(#_Linear1)"
                    fillRule="nonzero"
                    transform="translate(-272 -246) translate(274 248)"
                  />
                  <path
                    d="M103.5 8c0-4.139-3.361-7.5-7.5-7.5H8A7.504 7.504 0 00.5 8v88c0 4.139 3.361 7.5 7.5 7.5h88c4.139 0 7.5-3.361 7.5-7.5V8z"
                    fill="none"
                    stroke="#ab89ed"
                    strokeWidth="1px"
                    transform="translate(-272 -246) translate(274 248)"
                  />
                  <path
                    d="M104 51h-1v2h1v-2zm72 2l10 4.773V46.227L176 51v2zm-72 0h73v-2h-73v2z"
                    fill="url(#_Linear2)"
                    fillRule="nonzero"
                    transform="translate(-272 -246) translate(274 248)"
                  />
                  <path
                    d="M289.5 8c0-4.139-3.361-7.5-7.5-7.5h-88a7.504 7.504 0 00-7.5 7.5v88c0 4.139 3.361 7.5 7.5 7.5h88c4.139 0 7.5-3.361 7.5-7.5V8z"
                    fill="#1f1f1f"
                    transform="translate(-272 -246) translate(274 248)"
                  />
                  <path
                    fill="#fff"
                    fillOpacity={0.9}
                    fillRule="nonzero"
                    transform="translate(-272 -246) matrix(1 0 0 1.39641 274 228.972)"
                    d="M218 48H258V73H218z"
                  />
                  <path
                    d="M219.373 87.823c-1.753 0-3.253-.63-4.501-1.89-1.248-1.26-1.872-2.774-1.872-4.543V49.224c0-1.77.624-3.284 1.872-4.543 1.248-1.26 2.748-1.89 4.501-1.89h3.186v-6.433c0-4.45 1.553-8.243 4.66-11.38 3.106-3.136 6.864-4.704 11.271-4.704 4.408 0 8.165 1.569 11.272 4.705 3.106 3.136 4.66 6.929 4.66 11.379v6.433h3.186c1.752 0 3.253.63 4.5 1.89 1.248 1.26 1.872 2.774 1.872 4.543V81.39c0 1.77-.624 3.284-1.872 4.544-1.247 1.26-2.748 1.89-4.5 1.89h-38.235v-.001zm0-6.433h38.235V49.224h-38.235V81.39zm19.117-9.65c1.753 0 3.253-.63 4.501-1.89 1.248-1.26 1.872-2.774 1.872-4.543 0-1.769-.624-3.284-1.872-4.543-1.248-1.26-2.748-1.89-4.501-1.89-1.752 0-3.252.63-4.5 1.89-1.248 1.26-1.872 2.774-1.872 4.543 0 1.77.624 3.284 1.872 4.544 1.248 1.26 2.748 1.89 4.5 1.89v-.001zm-9.559-28.95h19.118v-6.432c0-2.681-.929-4.96-2.788-6.836-1.859-1.876-4.116-2.814-6.771-2.814-2.655 0-4.912.938-6.771 2.814-1.858 1.877-2.788 4.155-2.788 6.836v6.433-.001z"
                    fill="url(#_Linear3)"
                    fillRule="nonzero"
                    transform="translate(-272 -246) translate(274 248)"
                  />
                  <path
                    d="M289.5 8c0-4.139-3.361-7.5-7.5-7.5h-88a7.504 7.504 0 00-7.5 7.5v88c0 4.139 3.361 7.5 7.5 7.5h88c4.139 0 7.5-3.361 7.5-7.5V8z"
                    fill="none"
                    stroke="#5d27c9"
                    strokeWidth="1px"
                    transform="translate(-272 -246) translate(274 248)"
                  />
                  <path
                    d="M300 51l-10-4.773v11.547L300 53v-2zm72 1l-10-5.773v11.547L372 52zm-73 1h64v-2h-64v2z"
                    fill="url(#_Linear4)"
                    fillRule="nonzero"
                    transform="translate(-272 -246) translate(274 248)"
                  />
                  <path
                    d="M475.5 8c0-4.139-3.361-7.5-7.5-7.5h-88a7.504 7.504 0 00-7.5 7.5v88c0 4.139 3.361 7.5 7.5 7.5h88c4.139 0 7.5-3.361 7.5-7.5V8z"
                    fill="#1f1f1f"
                    transform="translate(-272 -246) translate(274 248)"
                  />
                  <path
                    d="M430.287 69.949v-4.867h8.796a9.02 9.02 0 004.156-1.011 8.702 8.702 0 003.169-2.792 8.337 8.337 0 001.43-3.911 8.268 8.268 0 00-.647-4.102 8.542 8.542 0 00-2.572-3.318 8.924 8.924 0 00-3.887-1.748 9.074 9.074 0 00-4.278.238 8.84 8.84 0 00-3.654 2.166v-.122c0-3.872-1.589-7.585-4.417-10.323-2.828-2.738-6.663-4.277-10.662-4.277-4 0-7.835 1.539-10.663 4.277-2.828 2.738-4.416 6.451-4.416 10.323v.017h-5.027v-.017c-.004-4.542 1.634-8.943 4.628-12.44 2.995-3.497 7.158-5.87 11.769-6.708a20.682 20.682 0 0113.48 2.12c4.101 2.208 7.274 5.734 8.972 9.97a14.276 14.276 0 015.713.1 14.036 14.036 0 015.183 2.329 13.519 13.519 0 013.767 4.16 13.086 13.086 0 011.708 5.28 12.98 12.98 0 01-.644 5.496 13.287 13.287 0 01-2.885 4.775 13.827 13.827 0 01-4.633 3.238 14.228 14.228 0 01-5.59 1.147h-8.796z"
                    fill="url(#_Linear5)"
                    fillRule="nonzero"
                    transform="translate(-272 -246) translate(274 248)"
                  />
                  <path
                    d="M432.795 61.154c0 10.339-8.508 18.846-18.846 18.846-10.339 0-18.846-8.507-18.846-18.846s8.507-18.846 18.846-18.846c10.338 0 18.846 8.507 18.846 18.846z"
                    fill="#1e1e1e"
                    fillRule="nonzero"
                    transform="translate(-272 -246) translate(274 248)"
                  />
                  <path
                    d="M429.532 61.782c0 8.546-7.037 15.583-15.583 15.583s-15.584-7.037-15.584-15.583S405.403 46.2 413.949 46.2s15.583 7.037 15.583 15.583v-.001z"
                    fill="#fff"
                    fillRule="nonzero"
                    stroke="#5849be"
                    strokeWidth="1.5px"
                    transform="translate(-272 -246) translate(274 248)"
                  />
                  <path
                    d="M411.027 51.29c.93-.258 1.91-.397 2.921-.397 6.01 0 10.889 4.88 10.889 10.89 0 6.009-4.879 10.888-10.889 10.888-6.009 0-10.888-4.88-10.888-10.889 0-1.011.138-1.991.396-2.92a5.446 5.446 0 004.489 2.362c2.987-.002 5.444-2.459 5.445-5.446a5.443 5.443 0 00-2.363-4.488z"
                    fill="#4000bf"
                    transform="translate(-272 -246) translate(274 248)"
                  />
                  <path
                    d="M475.5 8c0-4.139-3.361-7.5-7.5-7.5h-88a7.504 7.504 0 00-7.5 7.5v88c0 4.139 3.361 7.5 7.5 7.5h88c4.139 0 7.5-3.361 7.5-7.5V8z"
                    fill="none"
                    stroke="#c502bd"
                    strokeWidth="1px"
                    transform="translate(-272 -246) translate(274 248)"
                  />
                  <defs>
                    <linearGradient
                      id="_Linear1"
                      x1={0}
                      y1={0}
                      x2={1}
                      y2={0}
                      gradientUnits="userSpaceOnUse"
                      gradientTransform="rotate(29.74 -39.219 73.242) scale(62.7833)"
                    >
                      <stop offset={0} stopColor="#4000bf" />
                      <stop offset={1} stopColor="#b49ce3" />
                    </linearGradient>
                    <linearGradient
                      id="_Linear2"
                      x1={0}
                      y1={0}
                      x2={1}
                      y2={0}
                      gradientUnits="userSpaceOnUse"
                      gradientTransform="rotate(-180 93 26) scale(82)"
                    >
                      <stop offset={0} stopColor="#5922c7" />
                      <stop offset={1} stopColor="#aa89ed" />
                    </linearGradient>
                    <linearGradient
                      id="_Linear3"
                      x1={0}
                      y1={0}
                      x2={1}
                      y2={0}
                      gradientUnits="userSpaceOnUse"
                      gradientTransform="scale(83.3193) rotate(26.531 .761 5.544)"
                    >
                      <stop offset={0} stopColor="#4000bf" />
                      <stop offset={1} stopColor="#b49ce3" />
                    </linearGradient>
                    <linearGradient
                      id="_Linear4"
                      x1={0}
                      y1={0}
                      x2={1}
                      y2={0}
                      gradientUnits="userSpaceOnUse"
                      gradientTransform="rotate(-180 186 26) scale(82)"
                    >
                      <stop offset={0} stopColor="#c502bd" />
                      <stop offset={1} stopColor="#602bca" />
                    </linearGradient>
                    <linearGradient
                      id="_Linear5"
                      x1={0}
                      y1={0}
                      x2={1}
                      y2={0}
                      gradientUnits="userSpaceOnUse"
                      gradientTransform="rotate(43.196 159.635 517.692) scale(73.6195)"
                    >
                      <stop offset={0} stopColor="#4000bf" />
                      <stop offset={1} stopColor="#b49ce3" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <Form method='POST' className='gap-2 flex justify-between items-center'>
                <div>
                  <p
                    className='text-[10px]'
                    style={{
                      color: 'rgba(var(--color-font-rgb), 0.8)',
                    }}
                  >
                    While not needed, you can <Button
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
                          console.time('Export');
                          dirPath && await exportAllData({
                            dirPath,
                          });
                          console.timeEnd('Export');
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
                      }}
                      className='focus:text-[--color-font] hover:text-[--color-font] font-bold transition-colors'
                    > export your data </Button> for portability.
                  </p>
                </div>
                <button disabled={state !== 'idle'} className='hover:no-underline font-bold bg-[#4000BF] text-sm hover:bg-opacity-90 py-2 px-3 text-[--color-font] transition-colors rounded-sm'>
                  Continue
                </button>
              </Form>
            </div>
          </div>
        </div>
      </TrailLinesContainer>
    </div>
  );
};
