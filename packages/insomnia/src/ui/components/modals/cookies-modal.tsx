import clone from 'clone';
import { isValid } from 'date-fns';
import React, { useState } from 'react';
import { Button, Dialog, Group, Heading, Input, ListBox, ListBoxItem, Modal, ModalOverlay, Tab, TabList, TabPanel, Tabs, TextField } from 'react-aria-components';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';
import { Cookie as ToughCookie } from 'tough-cookie';
import { v4 as uuidv4 } from 'uuid';

import { cookieToString } from '../../../common/cookies';
import { fuzzyMatch } from '../../../common/misc';
import type { Cookie, CookieJar } from '../../../models/cookie-jar';
import { useNunjucks } from '../../context/nunjucks/use-nunjucks';
import type { WorkspaceLoaderData } from '../../routes/workspace';
import { PromptButton } from '../base/prompt-button';
import { OneLineEditor } from '../codemirror/one-line-editor';
import { Icon } from '../icon';
import { RenderedText } from '../rendered-text';

// Use tough-cookie MAX_DATE value
// https://github.com/salesforce/tough-cookie/blob/5ae97c6a28122f3fb309adcd8428274d9b2bd795/lib/cookie.js#L77
const MAX_TIME = 2147483647000;
const ItemsPerPage = 5;
const DefaultCookie: Cookie = {
  id: uuidv4(),
  key: 'foo',
  value: 'bar',
  domain: 'domain.com',
  expires: MAX_TIME as unknown as Date,
  path: '/',
  secure: false,
  httpOnly: false,
};

export function chunkArray<T>(array: T[], chunkSize: number = ItemsPerPage): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

interface Props {
  setIsOpen: (isOpen: boolean) => void;
}

export const CookiesModal = ({ setIsOpen }: Props) => {
  const { handleRender } = useNunjucks();

  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();
  const { activeCookieJar } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const updateCookieJarFetcher = useFetcher<CookieJar>();

  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<string>('');
  const [filteredCookies, setFilteredCookies] = useState<Cookie[][]>(chunkArray(activeCookieJar?.cookies || []));

  const updateCookieJar = (cookieJarId: string, patch: CookieJar) => {
    updateCookieJarFetcher.submit(JSON.stringify({ patch, cookieJarId }), {
      encType: 'application/json',
      method: 'post',
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/cookieJar/update`,
    });

    setFilteredCookies(chunkArray(patch.cookies));
  };

  const handleFilterChange = async (value: string) => {
    setFilter(value);
    const renderedCookies: Cookie[] = [];

    for (const cookie of (activeCookieJar?.cookies || [])) {
      try {
        renderedCookies.push(await handleRender(cookie));
      } catch (err) {
        renderedCookies.push(cookie);
      }
    }

    if (!value) {
      setFilteredCookies(chunkArray(renderedCookies));
      return;
    }

    const filteredCookies: Cookie[] = [];

    renderedCookies.forEach(cookie => {
      if (fuzzyMatch(value, JSON.stringify(cookie), { splitSpace: true })) {
        filteredCookies.push(cookie);
      }
    });

    setFilteredCookies(chunkArray(filteredCookies));
  };

  const handleCookieDelete = (cookieId: string) => {
    const updatedActiveCookieJar = activeCookieJar;
    updatedActiveCookieJar.cookies = activeCookieJar.cookies.filter(c => c.id !== cookieId);
    updateCookieJar(activeCookieJar._id, updatedActiveCookieJar);
  };

  const handleDeleteAll = () => {
    const updatedActiveCookieJar = activeCookieJar;
    updatedActiveCookieJar.cookies = [];

    updateCookieJar(activeCookieJar._id, updatedActiveCookieJar);
  };

  const handleAddCookie = () => {
    const updatedActiveCookieJar = activeCookieJar;
    updatedActiveCookieJar.cookies = [DefaultCookie, ...activeCookieJar.cookies];

    updateCookieJar(activeCookieJar._id, updatedActiveCookieJar);
  };

  const handleCookieUpdate = (cookie: Cookie) => {
    const newCookie = clone(cookie);

    // transform to Date object or fallback to null
    let dateFormat = null;

    if (newCookie.expires && isValid(new Date(newCookie.expires))) {
      dateFormat = new Date(newCookie.expires);
    }
    newCookie.expires = dateFormat;

    // Clone so we don't modify the original
    const cookieJar = clone(activeCookieJar);
    const index = activeCookieJar.cookies.findIndex(c => c.id === cookie.id);

    if (index < 0) {
      console.warn(`Could not find cookie with id=${cookie.id} to edit`);
      return;
    }

    cookieJar.cookies = [...cookieJar.cookies.slice(0, index), newCookie, ...cookieJar.cookies.slice(index + 1)];
    updateCookieJar(cookieJar._id, cookieJar);
  };

  return (
    <ModalOverlay
      isDismissable={true}
      isOpen={true}
      onOpenChange={setIsOpen}
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-[--color-bg] theme--transparent-overlay"
    >
      <Modal className="fixed top-[100px] w-full max-w-[900px] rounded-md border border-solid border-[--hl-sm] p-[32px] h-fit bg-[--color-bg] text-[--color-font] theme--dialog">
        <Dialog className="outline-none relative">
          {({ close }) => (
            <>
              {activeCookieJar && (
                <div className="flex flex-col gap-4">
                  <Heading slot="title" className="text-[22px] leading-[34px] mb-[14px]">
                    Manage Cookies
                  </Heading>
                  <Button onPress={close} className="fa fa-times absolute top-0 right-0 text-xl" />

                  <div className='flex gap-4 justify-between'>
                    <Group
                      className="w-[50%] bg-[--hl-xs] py-[4px] px-[8px] rounded flex items-center gap-2"
                    >
                      <i className="fa fa-search" />
                      <TextField
                        value={filter}
                        onChange={handleFilterChange}
                        aria-label="Cookie search query"
                        className="flex-1"
                      >
                        <Input
                          className="w-full"
                          placeholder="Search cookies"
                        />
                      </TextField>
                      {filter && (
                        <Button onPress={() => handleFilterChange('')}>
                          <Icon icon="circle-xmark" className='h-4 w-4' />
                        </Button>
                      )}
                    </Group>
                    <div className="flex gap-4 items-end">
                      <Button
                        className="flex items-center gap-2 min-w-[75px] py-1 px-2 font-semibold aria-pressed:bg-[--hl-sm] text-[--color-font] transition-all text-sm"
                        onPress={handleAddCookie}
                      >
                        <Icon icon="plus" /> Add Cookie
                      </Button>
                      <PromptButton
                        className="flex items-center gap-2 min-w-[85px] py-1 px-2 font-semibold aria-pressed:bg-[--hl-sm] text-[--color-font] transition-all text-sm"
                        confirmMessage='Confirm'
                        onClick={handleDeleteAll}
                      >
                        <Icon icon="trash" /> Delete All
                      </PromptButton>
                    </div>
                  </div>
                  <hr className="border my-[14px]" />
                  {filteredCookies.length === 0 ?
                    (<div className='flex items-center justify-center h-[200px]'>
                      <p className="text-[12px] text-[--color-font]">{filter ? `No cookies match your search: "${filter}"` : 'No cookies found.'}</p>
                    </div>)
                    : (
                      <>
                        <CookieList
                          cookies={filteredCookies[page] || []}
                          onCookieDelete={handleCookieDelete}
                          onUpdateCookie={handleCookieUpdate}
                        />
                        <PaginationBar
                          isPrevDisabled={page === 0}
                          isNextDisabled={filteredCookies.length === 1 || page === filteredCookies.length - 1}
                          isHidden={filteredCookies.length === 1}
                          page={page + 1}
                          totalPages={filteredCookies.length}
                          onPrevPress={() => {
                            setPage(page - 1);
                          }}
                          onNextPress={() => {
                            setPage(page + 1);
                          }}
                        />
                      </>
                    )
                  }
                </div>
              )}
              <div className='flex items-center justify-between gap-3 mt-[2rem]'>
                <div className="italic text-[12px]">
                  * cookies are automatically sent with relevant requests
                </div>
                <Button
                  className="text-[--color-font-surprise] font-semibold border border-solid border-[--hl-md] bg-opacity-100 bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] px-4 py-2 h-full flex items-center justify-center gap-2 aria-pressed:opacity-80 rounded-md hover:bg-opacity-80 focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  Done
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export interface CookieListProps {
  cookies: Cookie[];
  onCookieDelete: (cookieId: string) => void;
  onUpdateCookie: (cookie: Cookie) => void;
}

const CookieList = ({ cookies, onCookieDelete, onUpdateCookie }: CookieListProps) => {
  const [cookieToEdit, setCookieToEdit] = useState<Cookie | null>(null);

  return (
    <>
    <ListBox
      aria-label="Cookies list"
      className="flex flex-col w-full min-h-[200px]"
    >
      {cookies.map((cookie, index) => {
        const cookieJSON = ToughCookie.fromJSON(cookie);
        const cookieString = cookieJSON ? cookieToString(cookieJSON) : '';

        if (cookie.expires && !isValid(new Date(cookie.expires))) {
          cookie.expires = null;
        }

        return (
          <ListBoxItem
            key={cookie.id}
            id={cookie.id}
            data-testid={`cookie-test-iteration-${index}`}
            textValue={cookie.domain}
            className='flex justify-between outline-none gap-2 leading-[36px] odd:bg-[--hl-xs] px-2 py-1 rounded-sm min-h-[40px]'
          >
            <span className='flex items-center leading-relaxed min-w-[20%] break-all'><RenderedText>{cookie.domain || ''}</RenderedText></span>
            <span className='flex items-center leading-relaxed w-[70%] break-all'><RenderedText>{cookieString || ''}</RenderedText></span>
            <div className='flex gap-1 min-w-[10%] items-center justify-end'>
              <Button
                className="flex items-center gap-2 min-w-[35px] py-1 px-2 justify-center font-semibold aria-pressed:bg-[--hl-sm] text-[--color-font] transition-all text-sm"
                onPress={() => setCookieToEdit(cookie)}
              >
                Edit
              </Button>
              <PromptButton
                className="flex items-center gap-2 min-w-[15px] py-1 px-2 font-semibold aria-pressed:bg-[--hl-sm] text-[--color-font] transition-all text-sm"
                confirmMessage=""
                doneMessage=''
                onClick={() => onCookieDelete(cookie.id)}
                title="Delete cookie"
              >
                <i className="fa fa-trash-o" />
              </PromptButton>
            </div>
          </ListBoxItem>
        );
      })}
    </ListBox>
      {cookieToEdit && <CookieModifyModal
        isOpen={cookieToEdit !== null}
        cookie={cookieToEdit as Cookie}
        setIsOpen={() => setCookieToEdit(null)}
        onUpdateCookie={onUpdateCookie}
      />}
    </>
  );
};

interface PaginationBarProps {
  isPrevDisabled?: boolean;
  isNextDisabled?: boolean;
  isHidden?: boolean;
  page: number;
  totalPages: number;
  onPrevPress?: () => void;
  onNextPress?: () => void;
};

const PaginationBar = ({ isNextDisabled, isPrevDisabled, isHidden, page, totalPages, onPrevPress, onNextPress }: PaginationBarProps) => {
  if (isHidden) {
    return null;
  }

  return (
    <div className="flex flex-col items-end">
      <div className="flex h-[50px] w-full flex-shrink-0 items-center justify-between">
        <Button
          isDisabled={isPrevDisabled}
          aria-label="previous page"
          className="flex h-[25px] items-center justify-center gap-[5px] p-1"
          onPress={onPrevPress}
        >
          <Icon icon="arrow-left" className="h-[12px] w-[12px] text text-[--color-font] disabled:text-[#00000080]" />
          <p className="m-0 text-[12px] font-normal capitalize leading-[15px] text-[--color-font] disabled:text-[#00000080]">Previous</p>
        </Button>
        <div className="flex gap-2 items-center">
          <p className="m-0 text-[10px] font-normal leading-[15px] text-[--color-font] disabled:text-[#00000080]">{page}</p>
          <p className="m-0 text-[10px] font-normal leading-[15px] text-[--color-font] disabled:text-[#00000080]">of</p>
          <p className="m-0 text-[10px] font-normal leading-[15px] text-[--color-font] disabled:text-[#00000080]">{totalPages}</p>
        </div>
        <Button
          isDisabled={isNextDisabled}
          aria-label="next page"
          className="flex h-[25px] items-center justify-center gap-[5px] p-1"
          onPress={onNextPress}
        >
          <p className="m-0 text-[12px] font-normal capitalize leading-[15px] text-[--color-font] disabled:text-[#00000080]">Next</p>
          <Icon icon="arrow-right" className="h-[12px] w-[12px] text-[--color-font] disabled:text-[#00000080]" />
        </Button>
      </div>
    </div>
  );
};

interface CookieModifyModalProps {
  cookie: Cookie;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onUpdateCookie: (cookie: Cookie) => void;
}

const CookieModifyModal = (({ cookie, isOpen, setIsOpen, onUpdateCookie }: CookieModifyModalProps) => {
  const [editCookie, setEditCookie] = useState<Cookie>(cookie);

  let localDateTime: string;
  if (editCookie && editCookie.expires && isValid(new Date(editCookie.expires))) {
    localDateTime = new Date(editCookie.expires).toISOString().slice(0, 16);
  }

  let rawDefaultValue;
  if (!editCookie) {
    rawDefaultValue = '';
  } else {
    try {
      const c = ToughCookie.fromJSON(JSON.stringify(editCookie));
      rawDefaultValue = c ? cookieToString(c) : '';
    } catch (err) {
      console.warn('Failed to parse cookie string', err);
      rawDefaultValue = '';
    }
  }

  return (
    <ModalOverlay
      isDismissable={true}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-[--color-bg] theme--transparent-overlay"
    >
      <Modal className="fixed top-[100px] w-full max-w-[900px] rounded-md border border-solid border-[--hl-sm] p-[32px] h-fit bg-[--color-bg] text-[--color-font] theme--dialog">
        <Dialog className="outline-none relative">
          {({ close }) => (
            <>
              {editCookie && (
                <>
                  <div className="flex flex-col gap-4">
                    <Heading slot="title" className="text-[22px] leading-[34px] mb-[14px]">
                      Manage Cookies
                    </Heading>
                    <Button onPress={close} className="fa fa-times absolute top-0 right-0 text-xl" />

                    <Tabs aria-label='Cookie modify tabs' className="flex-1 w-full h-full flex flex-col">
                      <TabList className='w-full flex-shrink-0  overflow-x-auto border-solid scro border-b border-b-[--hl-md] bg-[--color-bg] flex items-center h-[--line-height-sm]' aria-label='Request pane tabs'>
                        <Tab
                          className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
                          id='friendly'
                        >
                          Friendly
                        </Tab>
                        <Tab
                          className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
                          id='raw'
                        >
                          Raw
                        </Tab>
                      </TabList>
                      <TabPanel className='w-full flex-1 flex flex-col overflow-y-auto pt-3' id='friendly'>
                        <div className="form-row">
                          <div className="form-control form-control--outlined">
                            <label data-testid="CookieKey">
                              Key
                              <OneLineEditor
                                id="cookie-key"
                                defaultValue={(editCookie && editCookie.key || '').toString()}
                                onChange={value => setEditCookie({ ...editCookie, key: value.trim() })}
                              />
                            </label>
                          </div>
                          <div className="form-control form-control--outlined">
                            <label data-testid="CookieValue">
                              Value
                              <OneLineEditor
                                id="cookie-value"
                                defaultValue={(editCookie && editCookie.value || '').toString()}
                                onChange={value => setEditCookie({ ...editCookie, value: value.trim() })}
                              />
                            </label>
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-control form-control--outlined">
                            <label data-testid="CookieDomain">
                              Domain
                              <OneLineEditor
                                id="cookie-domain"
                                defaultValue={(editCookie && editCookie.domain || '').toString()}
                                onChange={value => setEditCookie({ ...editCookie, domain: value.trim() })}
                              />
                            </label>
                          </div>
                          <div className="form-control form-control--outlined">
                            <label data-testid="CookiePath">
                              Path
                              <OneLineEditor
                                id="cookie-path"
                                defaultValue={(editCookie && editCookie.path || '').toString()}
                                onChange={value => setEditCookie({ ...editCookie, path: value.trim() })}
                              />
                            </label>
                          </div>
                        </div>
                        <div className="form-control form-control--outlined">
                          <label data-testid="CookieExpires">
                            Expires
                            <input
                              type="datetime-local"
                              defaultValue={localDateTime}
                              className='calendar-invert'
                              onChange={event => setEditCookie({ ...editCookie, expires: event.target.value })}
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2 w-full">
                          <label className="flex items-center gap-1">
                            <input
                              className="space-left"
                              type="checkbox"
                              name="secure"
                              defaultChecked={editCookie.secure || false}
                              onChange={event => setEditCookie({ ...editCookie, secure: event.target.checked })}
                            />
                            Secure
                          </label>
                          <label className="flex items-center gap-1">
                            <input
                              className="space-left"
                              type="checkbox"
                              name="httpOnly"
                              defaultChecked={editCookie.httpOnly || false}
                              onChange={event => setEditCookie({ ...editCookie, httpOnly: event.target.checked })}
                            />
                            httpOnly
                          </label>
                        </div>
                      </TabPanel>
                      <TabPanel className='w-full flex-1 flex flex-col overflow-y-auto pt-3' id='raw'>
                        <div className="form-control form-control--outlined">
                          <label>
                            Raw Cookie String
                            <input
                              type="text"
                              onChange={event => {
                                try {
                                  // NOTE: Perform toJSON so we have a plain JS object instead of Cookie instance
                                  const parsed = ToughCookie.parse(event.target.value, { loose: true })?.toJSON();
                                  if (parsed) {
                                    // Make sure cookie has an id
                                    parsed.id = editCookie.id;
                                    setEditCookie(parsed as Cookie);
                                  }
                                } catch (err) {
                                  console.warn(`Failed to parse cookie string "${event.target.value}"`, err);
                                  return;
                                }
                              }}
                              defaultValue={rawDefaultValue}
                            />
                          </label>
                        </div>
                      </TabPanel>
                    </Tabs>
                  </div>
                </>
              )}
              <div className='flex items-center justify-end mt-[2rem]'>
                <Button
                  className="text-[--color-font-surprise] font-semibold border border-solid border-[--hl-md] bg-opacity-100 bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] px-4 py-2 h-full flex items-center justify-center gap-2 aria-pressed:opacity-80 rounded-md hover:bg-opacity-80 focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={() => {
                    onUpdateCookie(editCookie as Cookie);
                    setIsOpen(false);
                  }}
                >
                  Done
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
});
