import * as models from '../../models';

export const data = {
  [models.workspace.type]: [
    {
      _id: 'wrk_1',
      name: 'Wrk 1'
    }
  ],

  [models.requestGroup.type]: [
    {
      _id: 'fld_1',
      parentId: 'wrk_1',
      name: 'Fld 1'
    },
    {
      _id: 'fld_2',
      parentId: 'wrk_1',
      name: 'Fld 2'
    },
    {
      _id: 'fld_3',
      parentId: 'fld_1',
      name: 'Fld 3'
    }
  ],

  [models.request.type]: [
    {
      _id: 'req_1',
      parentId: 'fld_1',
      name: 'Req 1'
    },
    {
      _id: 'req_2',
      parentId: 'fld_1',
      name: 'Req 2'
    },
    {
      _id: 'req_3',
      parentId: 'wrk_1',
      name: 'Req 3'
    },
    {
      _id: 'req_4',
      parentId: 'fld_3',
      name: 'Req 4'
    },
    {
      _id: 'req_5',
      parentId: 'wrk_1',
      name: 'Req 5'
    }
  ]
};
