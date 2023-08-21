import React from 'react';
import { ActionFunction, LoaderFunction, redirect, useFetcher } from 'react-router-dom';

import { getCurrentSessionId } from '../../account/session';
import { database } from '../../common/database';
import FileSystemDriver from '../../sync/store/drivers/file-system-driver';
import { migrateCollectionsIntoRemoteProject } from '../../sync/vcs/migrate-collections';
import { migrateLocalToCloudProjects } from '../../sync/vcs/migrate-to-cloud-projects';
import { InsomniaLogo } from '../components/insomnia-icon';
import { TrailLinesContainer } from '../components/trail-lines-container';

export const action: ActionFunction = async () => {
  await migrateLocalToCloudProjects();

  return redirect('/auth/login');
};
export const loader: LoaderFunction = async () => {
  // const sessionId = getCurrentSessionId();

  // const localProjects = await database.find('Project', {
  //   remoteId: null,
  // });

  // if (!localProjects.length || !sessionId) {
  //   return redirect('/onboarding/scratchpad');
  // }

  return null;
};

export const OnboardingCloudMigration = () => {
  const { Form, state } = useFetcher();
  return <div className='relative h-full w-full text-left text-sm flex bg-[--color-bg]'>
    <TrailLinesContainer>
      <div
        className='flex justify-center items-center flex-col h-full w-[600px] min-h-[450px]'
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
              <p className='text-sm'>
                We have detected that you have previously created data with Insomnia, which will be automatically synchronized to the cloud after logging-in or creating a new account. Your data is end-to-end encrypted (E2EE) and secure.
              </p>
              <ul className='text-left flex flex-col gap-2 text-sm'>
                <li><i className="fa fa-check text-emerald-600" /> End-to-end encryption (E2EE) enabled.</li>
                <li><i className="fa fa-check text-emerald-600" /> Automatic sync across clients enabled.</li>
                <li><i className="fa fa-check text-emerald-600" /> Unlimited user collaboration activated.</li>
              </ul>
            </div>
            <div className="flex justify-center items-center py-6">
              <svg
                width={476}
                height={104}
                viewBox="0 0 476 104"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x={0.5} y={0.5} width={103} height={103} rx={7.5} fill="#1F1F1F" />
                <mask
                  id="a"
                  style={{
                    maskType: 'alpha',
                  }}
                  maskUnits="userSpaceOnUse"
                  x={27}
                  y={27}
                  width={50}
                  height={50}
                >
                  <path fill="url(#paint0_linear_358_1740)" d="M27 27H77V77H27z" />
                </mask>
                <g mask="url(#a)">
                  <path
                    d="M43.176 31.412h12.5l8.088 4.411 4.412 6.618v21.324h-25V31.412z"
                    fill="#fff"
                    fillOpacity={0.9}
                  />
                  <path
                    d="M66.584 66.583H43.667c-1.146 0-2.127-.408-2.943-1.224-.816-.816-1.224-1.797-1.224-2.942V33.25c0-1.146.408-2.127 1.224-2.943.816-.816 1.797-1.224 2.943-1.224H58.25l12.5 12.5v20.834c0 1.145-.408 2.126-1.224 2.942-.816.816-1.796 1.224-2.942 1.224zM56.167 43.667V33.25h-12.5v29.167h22.917v-18.75H56.167zm-20.833 31.25c-1.146 0-2.127-.408-2.943-1.224-.816-.816-1.224-1.797-1.224-2.943V41.583h4.167V70.75H58.25v4.167H35.334z"
                    fill="url(#paint1_linear_358_1740)"
                  />
                </g>
                <rect
                  x={0.5}
                  y={0.5}
                  width={103}
                  height={103}
                  rx={7.5}
                  stroke="#AB89ED"
                />
                <path
                  d="M104 51h-1v2h1v-2zm72 2l10 4.773V46.227L176 51v2zm-72 0h73v-2h-73v2z"
                  fill="url(#paint2_linear_358_1740)"
                />
                <rect
                  x={186.5}
                  y={0.5}
                  width={103}
                  height={103}
                  rx={7.5}
                  fill="#1F1F1F"
                />
                <mask
                  id="b"
                  style={{
                    maskType: 'alpha',
                  }}
                  maskUnits="userSpaceOnUse"
                  x={213}
                  y={19}
                  width={50}
                  height={54}
                >
                  <path fill="url(#paint3_linear_358_1740)" d="M213 19H263V73H213z" />
                </mask>
                <g mask="url(#b)">
                  <path fill="#fff" fillOpacity={0.9} d="M218 48H258V73H218z" />
                  <path
                    d="M219.373 87.823c-1.753 0-3.253-.63-4.501-1.89-1.248-1.26-1.872-2.774-1.872-4.543V49.224c0-1.77.624-3.284 1.872-4.543 1.248-1.26 2.748-1.89 4.501-1.89h3.186v-6.433c0-4.45 1.553-8.243 4.66-11.38 3.106-3.136 6.864-4.704 11.271-4.704 4.408 0 8.165 1.569 11.272 4.705 3.106 3.136 4.66 6.929 4.66 11.379v6.433h3.186c1.752 0 3.253.63 4.5 1.89 1.248 1.26 1.872 2.774 1.872 4.543V81.39c0 1.77-.624 3.284-1.872 4.544-1.247 1.26-2.748 1.89-4.5 1.89h-38.235zm0-6.433h38.235V49.224h-38.235V81.39zm19.117-9.65c1.753 0 3.253-.63 4.501-1.89 1.248-1.26 1.872-2.774 1.872-4.543 0-1.769-.624-3.284-1.872-4.543-1.248-1.26-2.748-1.89-4.501-1.89-1.752 0-3.252.63-4.5 1.89-1.248 1.26-1.872 2.774-1.872 4.543 0 1.77.624 3.284 1.872 4.544 1.248 1.26 2.748 1.89 4.5 1.89zm-9.559-28.95h19.118v-6.432c0-2.681-.929-4.96-2.788-6.836-1.859-1.876-4.116-2.814-6.771-2.814-2.655 0-4.912.938-6.771 2.814-1.858 1.877-2.788 4.155-2.788 6.836v6.433z"
                    fill="url(#paint4_linear_358_1740)"
                  />
                </g>
                <path
                  d="M230.099 72.227v2h2v-2h-2zm-4.195 0v-2h-2v2h2zm0 2.22h-2v2h2v-2zm4.781 0h2v-2h-2v2zm0 1.553v2h2v-2h-2zm-6.545 0h-2v2h2v-2zm0-8.637v-2h-2v2h2zm6.334 0h2v-2h-2v2zm0 1.53v2h2v-2h-2zm-4.57 0v-2h-2v2h2zm0 1.834h-2v2h2v-2zm4.195 0h2v-2h-2v2zm0-.5h-4.195v4h4.195v-4zm-6.195 2v2.22h4v-2.22h-4zm2 4.22h4.781v-4h-4.781v4zm2.781-2V76h4v-1.553h-4zm2-.447h-6.545v4h6.545v-4zm-4.545 2v-8.637h-4V76h4zm-2-6.637h6.334v-4h-6.334v4zm4.334-2v1.53h4v-1.53h-4zm2-.47h-4.57v4h4.57v-4zm-6.57 2v1.834h4v-1.834h-4zm2 3.834h4.195v-4h-4.195v4zm2.195-2v1.5h4v-1.5h-4zm5.012-1.284l-1.8-.872-.002.004 1.802.868zm-.188 1.043v2h1.92l.078-1.918-1.998-.082zm-1.623 0l-1.999-.075-.078 2.075h2.077v-2zm.393-1.752l1.769.932.001-.001-1.77-.93zm4.517-.521l-1.371 1.456.006.006 1.365-1.462zm.235 3.65l-1.587-1.218-.007.01 1.594 1.208zm-1.213 1.084l-1.156-1.632-.003.002 1.159 1.63zm-.668.475l1.158 1.63-1.158-1.63zm-.862.644l-1.295-1.523-.009.008-.01.008 1.314 1.507zm-.386.463l-1.715-1.029-1.818 3.03h3.533v-2zm3.709 0h2v-2h-2v2zm0 1.471v2h2v-2h-2zm-5.819 0l-1.999-.051-.053 2.051h2.052v-2zm.393-1.67l1.797.878.025-.05.021-.052-1.843-.776zm1.687-1.799l1.162 1.628.002-.001-1.164-1.627zm1.494-1.183l1.45 1.378.005-.006.005-.005-1.46-1.367zm1.758-3.398c-.654-.783-1.554-1.075-2.39-1.075v4a.76.76 0 01-.279-.065 1.061 1.061 0 01-.4-.295l3.069-2.565zm-2.39-1.075c-.496 0-1.061.092-1.602.388a2.937 2.937 0 00-1.235 1.308l3.599 1.745a1.063 1.063 0 01-.441.455c-.195.107-.334.104-.321.104v-4zm-2.839 1.7c-.291.603-.362 1.292-.384 1.83l3.996.163c.008-.176.021-.287.032-.346.005-.028.008-.034.004-.022a.74.74 0 01-.045.112l-3.603-1.737zm1.614-.089H231.3v4h1.623v-4zm.376 2.076c.02-.545.116-.805.163-.896l-3.539-1.863c-.421.8-.587 1.707-.622 2.608l3.998.15zm.164-.897a.402.402 0 01.062-.093.17.17 0 01.039-.028c.038-.02.177-.081.502-.081v-4c-1.712 0-3.281.7-4.144 2.341l3.541 1.86zm.603-.202c.513 0 .695.132.773.206l2.742-2.912c-.984-.926-2.231-1.294-3.515-1.294v4zm.779.212c.072.067.162.168.162.513h4c0-1.296-.441-2.512-1.432-3.437l-2.73 2.924zm.162.513a.68.68 0 01-.149.457l3.173 2.437a4.68 4.68 0 00.976-2.894h-4zm-.156.466c-.066.088-.281.311-.775.661l2.312 3.264c.63-.446 1.224-.946 1.65-1.506l-3.187-2.419zm-.778.663l-.668.475 2.317 3.26.668-.474-2.317-3.261zm-.667.474c-.416.296-.769.556-.999.752l2.591 3.047c.082-.07.304-.24.724-.538l-2.316-3.26zm-1.018.768a3.913 3.913 0 00-.787.941l3.43 2.058-.005.006-.009.01-2.629-3.015zm.928 3.97h3.709v-4h-3.709v4zm1.709-2V76h4v-1.47h-4zm2-.529h-5.819v4h5.819v-4zm-3.819 2.051c.009-.348.08-.619.19-.843l-3.594-1.756a5.98 5.98 0 00-.595 2.497l3.999.102zm.236-.945s.011-.024.045-.075c.035-.05.089-.12.171-.207.168-.179.422-.402.79-.665l-2.323-3.256c-.986.704-1.915 1.57-2.37 2.651l3.687 1.552zm1.008-.948c.748-.536 1.402-1.035 1.78-1.432l-2.899-2.757a6.565 6.565 0 01-.336.285c-.214.17-.503.386-.873.65l2.328 3.254zm1.79-1.443c.638-.681 1.062-1.56 1.062-2.586h-4a.383.383 0 01.031-.151c.017-.04.026-.038-.012.002l2.919 2.735zm1.062-2.586c0-.75-.218-1.526-.764-2.18l-3.069 2.566a.757.757 0 01-.139-.247.48.48 0 01-.028-.14h4zm6.789 2.098v2h2v-2h-2zm-4.196 0v-2h-2v2h2zm0 2.22h-2v2h2v-2zm4.782 0h2v-2h-2v2zm0 1.553v2h2v-2h-2zm-6.545 0h-2v2h2v-2zm0-8.637v-2h-2v2h2zm6.334 0h2v-2h-2v2zm0 1.53v2h2v-2h-2zm-4.571 0v-2h-2v2h2zm0 1.834h-2v2h2v-2zm4.196 0h2v-2h-2v2zm0-.5h-4.196v4h4.196v-4zm-6.196 2v2.22h4v-2.22h-4zm2 4.22h4.782v-4h-4.782v4zm2.782-2V76h4v-1.553h-4zm2-.447h-6.545v4h6.545v-4zm-4.545 2v-8.637h-4V76h4zm-2-6.637h6.334v-4h-6.334v4zm4.334-2v1.53h4v-1.53h-4zm2-.47h-4.571v4h4.571v-4zm-6.571 2v1.834h4v-1.834h-4zm2 3.834h4.196v-4h-4.196v4zm2.196-2v1.5h4v-1.5h-4zm9.657 1.5v2h2v-2h-2zm-4.195 0v-2h-2v2h2zm0 2.22h-2v2h2v-2zm4.781 0h2v-2h-2v2zm0 1.553v2h2v-2h-2zm-6.545 0h-2v2h2v-2zm0-8.637v-2h-2v2h2zm6.334 0h2v-2h-2v2zm0 1.53v2h2v-2h-2zm-4.57 0v-2h-2v2h2zm0 1.834h-2v2h2v-2zm4.195 0h2v-2h-2v2zm0-.5h-4.195v4h4.195v-4zm-6.195 2v2.22h4v-2.22h-4zm2 4.22h4.781v-4h-4.781v4zm2.781-2V76h4v-1.553h-4zm2-.447h-6.545v4h6.545v-4zm-4.545 2v-8.637h-4V76h4zm-2-6.637h6.334v-4h-6.334v4zm4.334-2v1.53h4v-1.53h-4zm2-.47h-4.57v4h4.57v-4zm-6.57 2v1.834h4v-1.834h-4zm2 3.834h4.195v-4h-4.195v4zm2.195-2v1.5h4v-1.5h-4z"
                  fill="#1F1F1F80"
                />
                <path
                  d="M230.099 72.227h-4.195v2.22h4.781V76h-6.545v-8.637h6.334v1.53h-4.57v1.834h4.195v1.5zm4.904-2.995c-.199-.238-.484-.357-.855-.357-.508 0-.854.19-1.037.568-.106.22-.168.567-.188 1.043H231.3c.027-.722.158-1.306.393-1.752.445-.847 1.236-1.271 2.373-1.271.898 0 1.613.25 2.144.75.531.496.797 1.154.797 1.975 0 .628-.187 1.187-.562 1.675-.247.325-.651.686-1.213 1.084l-.668.475c-.418.297-.705.512-.862.644a1.915 1.915 0 00-.386.463h3.709V76h-5.819a4 4 0 01.393-1.67c.238-.566.801-1.166 1.687-1.799.77-.55 1.268-.945 1.494-1.183.348-.371.522-.778.522-1.22 0-.359-.1-.657-.299-.896zm9.088 2.995h-4.196v2.22h4.782V76h-6.545v-8.637h6.334v1.53h-4.571v1.834h4.196v1.5zm7.657 0h-4.195v2.22h4.781V76h-6.545v-8.637h6.334v1.53h-4.57v1.834h4.195v1.5z"
                  fill="#fff"
                />
                <rect
                  x={186.5}
                  y={0.5}
                  width={103}
                  height={103}
                  rx={7.5}
                  stroke="#5D27C9"
                />
                <path
                  d="M300 51l-10-4.773v11.547L300 53v-2zm72 1l-10-5.773v11.547L372 52zm-73 1h64v-2h-64v2z"
                  fill="url(#paint5_linear_358_1740)"
                />
                <rect
                  x={372.5}
                  y={0.5}
                  width={103}
                  height={103}
                  rx={7.5}
                  fill="#1F1F1F"
                />
                <path
                  d="M430.287 69.949v-4.867h8.796c1.45 0 2.878-.347 4.156-1.011a8.704 8.704 0 003.169-2.792 8.343 8.343 0 001.43-3.911 8.265 8.265 0 00-.647-4.102 8.547 8.547 0 00-2.572-3.318 8.93 8.93 0 00-3.887-1.748 9.074 9.074 0 00-4.278.238 8.846 8.846 0 00-3.654 2.166v-.122c0-3.872-1.589-7.585-4.417-10.323-2.828-2.738-6.663-4.277-10.662-4.277-4 0-7.835 1.539-10.663 4.277-2.828 2.738-4.416 6.451-4.416 10.323v.017h-5.027v-.017c-.004-4.542 1.634-8.943 4.628-12.44 2.995-3.497 7.158-5.87 11.769-6.708a20.679 20.679 0 0113.48 2.12c4.101 2.208 7.274 5.734 8.972 9.97a14.264 14.264 0 015.713.1 14.034 14.034 0 015.183 2.329 13.532 13.532 0 013.767 4.16 13.09 13.09 0 011.708 5.28 12.981 12.981 0 01-.644 5.496 13.294 13.294 0 01-2.885 4.775 13.822 13.822 0 01-4.633 3.238 14.214 14.214 0 01-5.59 1.147h-8.796z"
                  fill="url(#paint6_linear_358_1740)"
                />
                <path
                  d="M432.795 61.154c0 10.339-8.508 18.846-18.846 18.846-10.339 0-18.846-8.507-18.846-18.846s8.507-18.846 18.846-18.846c10.338 0 18.846 8.507 18.846 18.846z"
                  fill="#1E1E1E"
                />
                <path
                  d="M429.532 61.782c0 8.546-7.037 15.583-15.583 15.583s-15.584-7.037-15.584-15.583S405.403 46.2 413.949 46.2s15.583 7.037 15.583 15.583z"
                  fill="#fff"
                  stroke="#5849BE"
                  strokeWidth={1.5}
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M411.027 51.29c.93-.258 1.91-.397 2.921-.397 6.01 0 10.889 4.88 10.889 10.89 0 6.009-4.879 10.888-10.889 10.888-6.009 0-10.888-4.88-10.888-10.889 0-1.011.138-1.991.396-2.92a5.443 5.443 0 004.489 2.362 5.448 5.448 0 005.445-5.446 5.44 5.44 0 00-2.363-4.488z"
                  fill="#4000BF"
                />
                <rect
                  x={372.5}
                  y={0.5}
                  width={103}
                  height={103}
                  rx={7.5}
                  stroke="#C502BD"
                />
                <defs>
                  <linearGradient
                    id="paint0_linear_358_1740"
                    x1={27}
                    y1={27.0202}
                    x2={90.5328}
                    y2={69.0485}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#4000BF" />
                    <stop offset={1} stopColor="#B49CE3" />
                  </linearGradient>
                  <linearGradient
                    id="paint1_linear_358_1740"
                    x1={31.167}
                    y1={29.1018}
                    x2={85.6809}
                    y2={60.2463}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#4000BF" />
                    <stop offset={1} stopColor="#B49CE3" />
                  </linearGradient>
                  <linearGradient
                    id="paint2_linear_358_1740"
                    x1={186}
                    y1={52.0001}
                    x2={104}
                    y2={52}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#5922C7" />
                    <stop offset={1} stopColor="#AA89ED" />
                  </linearGradient>
                  <linearGradient
                    id="paint3_linear_358_1740"
                    x1={213}
                    y1={19.0218}
                    x2={279.417}
                    y2={59.7036}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#4000BF" />
                    <stop offset={1} stopColor="#B49CE3" />
                  </linearGradient>
                  <linearGradient
                    id="paint4_linear_358_1740"
                    x1={213}
                    y1={20.3017}
                    x2={287.545}
                    y2={57.5192}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#4000BF" />
                    <stop offset={1} stopColor="#B49CE3" />
                  </linearGradient>
                  <linearGradient
                    id="paint5_linear_358_1740"
                    x1={372}
                    y1={52.0001}
                    x2={290}
                    y2={52}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#C502BD" />
                    <stop offset={1} stopColor="#602BCA" />
                  </linearGradient>
                  <linearGradient
                    id="paint6_linear_358_1740"
                    x1={397.615}
                    y1={31.0157}
                    x2={451.285}
                    y2={81.4078}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#4000BF" />
                    <stop offset={1} stopColor="#B49CE3" />
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
                  While not needed, you can <button className='text-[--color-font] font-bold'> export your data </button> for portability.
                </p>
              </div>
              <button disabled={state !== 'idle'} className='hover:no-underline bg-[#4000BF] text-sm hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm'>
                Continue
              </button>
            </Form>
          </div>
        </div>
      </div>
    </TrailLinesContainer>
  </div>;
};
