import { database as db } from '../../../common/database';
import * as models from '../../../models';
import { Project } from '../../../models/project';
import { Request } from '../../../models/request';
import { RequestGroup } from '../../../models/request-group';
import { Workspace } from '../../../models/workspace';
import { WorkspaceMeta } from '../../../models/workspace-meta';

type MockModel = Partial<Project | Workspace | RequestGroup | Request | WorkspaceMeta>;
const mocksWithoutParentIdProjects: Record<string, MockModel[]> = {
    [models.project.type]: [
        {
            _id: 'proj_1',
            name: 'Proj 1',
            parentId: null,
            remoteId: null,
        } as unknown as Project,
        {
            _id: 'proj_2',
            name: 'Proj 2',
            parentId: null,
            remoteId: null,
        } as unknown as Project,
        {
            _id: 'proj_3',
            name: 'Proj 3',
            parentId: null,
            remoteId: null,
        } as unknown as Project,
    ],
    [models.workspace.type]: [
        {
            _id: 'wrk_1',
            name: 'Wrk 1',
            parentId: null,
        } as unknown as Workspace,
        {
            _id: 'wrk_2',
            name: 'Wrk 2',
            parentId: 'proj_3',
        },
        {
            _id: 'wrk_3',
            name: 'Wrk 3',
            parentId: 'proj_3',
        },
        {
            _id: 'wrk_4',
            name: 'Wrk 4',
            parentId: 'proj_3',
        },
    ],
    [models.requestGroup.type]: [
        {
            _id: 'fld_1',
            parentId: 'wrk_1',
            name: 'Fld 1',
        },
        {
            _id: 'fld_2',
            parentId: 'wrk_1',
            name: 'Fld 2',
        },
        {
            _id: 'fld_3',
            parentId: 'fld_1',
            name: 'Fld 3',
        },
    ],
    [models.request.type]: [
        {
            _id: 'req_1',
            parentId: 'fld_1',
            name: 'Req 1',
        },
        {
            _id: 'req_2',
            parentId: 'fld_1',
            name: 'Req 2',
        },
        {
            _id: 'req_3',
            parentId: 'wrk_1',
            name: 'Req 3',
        },
        {
            _id: 'req_4',
            parentId: 'fld_3',
            name: 'Req 4',
        },
        {
            _id: 'req_5',
            parentId: 'wrk_1',
            name: 'Req 5',
        },
    ],
};

const mocksHiddenWorkspaces: Record<string, MockModel[]> = {
    [models.project.type]: [
        {
            _id: 'proj_1',
            name: 'Proj 1',
            parentId: 'org_1',
            remoteId: 'team_1',
        },
    ],
    [models.workspace.type]: [
        {
            _id: 'wrk_1',
            name: 'Wrk 1',
            parentId: 'proj_1',
        },
        {
            _id: 'wrk_2',
            name: 'Wrk 2',
            parentId: null,
        } as unknown as Workspace,
        {
            _id: 'wrk_3',
            name: 'Wrk 3',
            parentId: null,
        } as unknown as Workspace,
        {
            _id: 'wrk_4',
            name: 'Wrk 4',
            parentId: null,
        } as unknown as Workspace,
    ],
    [models.requestGroup.type]: [
        {
            _id: 'fld_1',
            parentId: 'wrk_1',
            name: 'Fld 1',
        },
        {
            _id: 'fld_2',
            parentId: 'wrk_1',
            name: 'Fld 2',
        },
        {
            _id: 'fld_3',
            parentId: 'fld_1',
            name: 'Fld 3',
        },
    ],
    [models.request.type]: [
        {
            _id: 'req_1',
            parentId: 'fld_1',
            name: 'Req 1',
        },
        {
            _id: 'req_2',
            parentId: 'fld_1',
            name: 'Req 2',
        },
        {
            _id: 'req_3',
            parentId: 'wrk_1',
            name: 'Req 3',
        },
        {
            _id: 'req_4',
            parentId: 'fld_3',
            name: 'Req 4',
        },
        {
            _id: 'req_5',
            parentId: 'wrk_1',
            name: 'Req 5',
        },
    ],
};

const mocksNoProblem: Record<string, MockModel[]> = {
    [models.project.type]: [
        {
            _id: 'proj_1',
            name: 'Proj 1',
            parentId: 'org_1',
            remoteId: null,
        },
        {
            _id: 'proj_2',
            name: 'Proj 2',
            parentId: 'org_2',
            remoteId: null,
        },
        {
            _id: 'proj_3',
            name: 'Proj 3',
            parentId: 'org_3',
            remoteId: 'team_proj_3',
        },
    ],
    [models.workspace.type]: [
        {
            _id: 'wrk_1',
            name: 'Wrk 1',
            parentId: 'proj_1',
        },
        {
            _id: 'wrk_2',
            name: 'Wrk 2',
            parentId: 'proj_3',
        },
    ],
    [models.requestGroup.type]: [
        {
            _id: 'fld_1',
            parentId: 'wrk_1',
            name: 'Fld 1',
        },
        {
            _id: 'fld_2',
            parentId: 'wrk_1',
            name: 'Fld 2',
        },
        {
            _id: 'fld_3',
            parentId: 'fld_1',
            name: 'Fld 3',
        },
    ],
    [models.request.type]: [
        {
            _id: 'req_1',
            parentId: 'fld_1',
            name: 'Req 1',
        },
        {
            _id: 'req_2',
            parentId: 'fld_1',
            name: 'Req 2',
        },
        {
            _id: 'req_3',
            parentId: 'wrk_1',
            name: 'Req 3',
        },
        {
            _id: 'req_4',
            parentId: 'fld_3',
            name: 'Req 4',
        },
        {
            _id: 'req_5',
            parentId: 'wrk_1',
            name: 'Req 5',
        },
    ],
};

const mocksToBeRepaired: Record<string, MockModel[]> = {
    [models.project.type]: [
        {
            _id: 'proj_1',
            name: 'Proj 1',
            parentId: null,
            remoteId: 'team_1',
        } as unknown as Project,
        {
            _id: 'proj_2',
            name: 'Proj 2',
            parentId: null,
            remoteId: 'team_2',
        } as unknown as Project,
        {
            _id: 'proj_3',
            name: 'Proj 3',
            parentId: null,
            remoteId: null,
        } as unknown as Project,
    ],
    [models.workspace.type]: [
        {
            _id: 'wrk_1',
            name: 'Wrk 1',
            parentId: null,
        } as unknown as Workspace,
        {
            _id: 'wrk_2',
            name: 'Wrk 2',
            parentId: 'proj_3',
        },
        {
            _id: 'wrk_3',
            name: 'Wrk 3',
            parentId: 'proj_3',
        },
        {
            _id: 'wrk_4',
            name: 'Wrk 4',
            parentId: 'proj_3',
        },
    ],
    [models.requestGroup.type]: [
        {
            _id: 'fld_1',
            parentId: 'wrk_1',
            name: 'Fld 1',
        },
        {
            _id: 'fld_2',
            parentId: 'wrk_1',
            name: 'Fld 2',
        },
        {
            _id: 'fld_3',
            parentId: 'fld_1',
            name: 'Fld 3',
        },
    ],
    [models.request.type]: [
        {
            _id: 'req_1',
            parentId: 'fld_1',
            name: 'Req 1',
        },
        {
            _id: 'req_2',
            parentId: 'fld_1',
            name: 'Req 2',
        },
        {
            _id: 'req_3',
            parentId: 'wrk_1',
            name: 'Req 3',
        },
        {
            _id: 'req_4',
            parentId: 'fld_3',
            name: 'Req 4',
        },
        {
            _id: 'req_5',
            parentId: 'wrk_1',
            name: 'Req 5',
        },
    ],
};

const mocksToBeRepairedWithValidProjects: Record<string, MockModel[]> = {
    [models.project.type]: [
        {
            _id: 'proj_1',
            name: 'Proj 1',
            parentId: null,
            remoteId: 'team_1',
        } as unknown as Project,
        {
            _id: 'proj_2',
            name: 'Proj 2',
            parentId: null,
            remoteId: 'team_2',
        } as unknown as Project,
        {
            _id: 'proj_3',
            name: 'Proj 3',
            parentId: null,
            remoteId: null,
        } as unknown as Project,
    ],
    [models.workspace.type]: [
        {
            _id: 'wrk_1',
            name: 'Wrk 1',
            parentId: null,
        } as unknown as Workspace,
        {
            _id: 'wrk_2',
            name: 'Wrk 2',
            parentId: 'proj_3',
        },
        {
            _id: 'wrk_3',
            name: 'Wrk 3',
            parentId: 'proj_3',
        },
        {
            _id: 'wrk_4',
            name: 'Wrk 4',
            parentId: 'proj_3',
        },
    ],
    [models.requestGroup.type]: [
        {
            _id: 'fld_1',
            parentId: 'wrk_1',
            name: 'Fld 1',
        },
        {
            _id: 'fld_2',
            parentId: 'wrk_1',
            name: 'Fld 2',
        },
        {
            _id: 'fld_3',
            parentId: 'fld_1',
            name: 'Fld 3',
        },
    ],
    [models.request.type]: [
        {
            _id: 'req_1',
            parentId: 'fld_1',
            name: 'Req 1',
        },
        {
            _id: 'req_2',
            parentId: 'fld_1',
            name: 'Req 2',
        },
        {
            _id: 'req_3',
            parentId: 'wrk_1',
            name: 'Req 3',
        },
        {
            _id: 'req_4',
            parentId: 'fld_3',
            name: 'Req 4',
        },
        {
            _id: 'req_5',
            parentId: 'wrk_1',
            name: 'Req 5',
        },
    ],
};

const mocksToBeRepairedWithNoDupe: Record<string, MockModel[]> = {
    [models.project.type]: [
        {
            _id: 'proj_1',
            name: 'Proj 1',
            parentId: null,
            remoteId: 'team_1',
        } as unknown as Project,
        {
            _id: 'proj_2',
            name: 'Proj 2',
            parentId: null,
            remoteId: 'team_2',
        } as unknown as Project,
        {
            _id: 'proj_3',
            name: 'Proj 3',
            parentId: null,
            remoteId: null,
        } as unknown as Project,
    ],
    [models.workspace.type]: [
        {
            _id: 'wrk_1',
            name: 'Wrk 1',
            parentId: 'proj_1',
        },
        {
            _id: 'wrk_2',
            name: 'Wrk 2',
            parentId: 'proj_1',
        },
        {
            _id: 'wrk_3',
            name: 'Wrk 3',
            parentId: 'proj_2',
        },
        {
            _id: 'wrk_4',
            name: 'Wrk 4',
            parentId: 'proj_2',
        },
        {
            _id: 'wrk_5',
            name: 'Wrk 5',
            parentId: 'proj_3',
        },
        {
            _id: 'wrk_6',
            name: 'Wrk 6',
            parentId: 'proj_3',
        },
    ],
    [models.requestGroup.type]: [
        {
            _id: 'fld_1',
            parentId: 'wrk_1',
            name: 'Fld 1',
        },
        {
            _id: 'fld_2',
            parentId: 'wrk_1',
            name: 'Fld 2',
        },
        {
            _id: 'fld_3',
            parentId: 'fld_1',
            name: 'Fld 3',
        },
    ],
    [models.request.type]: [
        {
            _id: 'req_1',
            parentId: 'fld_1',
            name: 'Req 1',
        },
        {
            _id: 'req_2',
            parentId: 'fld_1',
            name: 'Req 2',
        },
        {
            _id: 'req_3',
            parentId: 'wrk_1',
            name: 'Req 3',
        },
        {
            _id: 'req_4',
            parentId: 'fld_3',
            name: 'Req 4',
        },
        {
            _id: 'req_5',
            parentId: 'wrk_1',
            name: 'Req 5',
        },
    ],
};

const mockRemoteBackgroundCheck = {
    myWorkspaceId: 'org_my',
    remoteFileSnapshot: {
        'org_my': {
            ownedByMe: true,
            isPersonal: true,
            fileIdMap: {
                'wrk_1': 'team_1',
                'wrk_2': 'team_1',
                'wrk_3': 'team_2',
                'wrk_4': 'team_3',
            },
            projectIds: ['team_1', 'team_2', 'team_3', 'team_4', 'team_5'],
        },
        'org_1': {
            ownedByMe: false,
            isPersonal: false,
            fileIdMap: {},
            projectIds: [],
        },
    },
    byRemoteProjectId: new Map([
        ['team_1', 'org_my'],
        ['team_2', 'org_my'],
        ['team_3', 'org_my'],
        ['team_4', 'org_my'],
        ['team_5', 'org_my'],
        ['team_6', 'org_1'],
    ]),
    byRemoteFileId: new Map([
        ['wrk_1', {
            remoteOrgId: 'org_my',
            remoteProjectId: 'team_1',
        }],
        ['wrk_2', {
            remoteOrgId: 'org_my',
            remoteProjectId: 'team_1',
        }],
        ['wrk_3', {
            remoteOrgId: 'org_my',
            remoteProjectId: 'team_2',
        }],
        ['wrk_4', {
            remoteOrgId: 'org_my',
            remoteProjectId: 'team_2',
        }],
    ]),
};

const mockRemoteBackgroundCheckMessedUp = {
    myWorkspaceId: 'org_my',
    remoteFileSnapshot: {
        'org_my': {
            ownedByMe: true,
            isPersonal: true,
            fileIdMap: {
            },
            projectIds: [],
        },
        'org_1': {
            ownedByMe: false,
            isPersonal: false,
            fileIdMap: {},
            projectIds: [],
        },
    },
    byRemoteProjectId: new Map(),
    byRemoteFileId: new Map(),
};

export function fakeDatabase(data: Record<string, MockModel[]>) {
    const promises: Promise<models.BaseModel>[] = [];
    for (const type of Object.keys(data)) {
        for (const doc of data[type]) {
            // @ts-expect-error -- TSCONVERSION
            promises.push(db.insert<models.BaseModel>({ ...doc, type }));
        }
    }
    return Promise.all(promises);
}

export { mocksWithoutParentIdProjects, mocksHiddenWorkspaces, mocksNoProblem, mocksToBeRepaired, mocksToBeRepairedWithValidProjects, mocksToBeRepairedWithNoDupe };
export { mockRemoteBackgroundCheck, mockRemoteBackgroundCheckMessedUp };
