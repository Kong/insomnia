// @flow
import React from 'react';
import ListGroupItem from './list-group-item';
import ListGroup from './list-group';
import UnitTestItem from './unit-test-item';
import UnitTestResultItem from './unit-test-result-item';

export default { title: 'Lists | List Group' };

export const _default = () => (
  <div style={{ width: '350px' }}>
    <ListGroup>
      <ListGroupItem>List</ListGroupItem>
      <ListGroupItem>of</ListGroupItem>
      <ListGroupItem>things...</ListGroupItem>
    </ListGroup>
  </div>
);

export const _bordered = () => (
  <div style={{ width: '350px' }}>
    <ListGroup bordered>
      <ListGroupItem>Bordered</ListGroupItem>
      <ListGroupItem>list</ListGroupItem>
      <ListGroupItem>of</ListGroupItem>
      <ListGroupItem>things...</ListGroupItem>
    </ListGroup>
  </div>
);

export const _indented = () => (
  <div style={{ width: '350px' }}>
    <ListGroup bordered>
      <ListGroupItem indentLevel={0}>Indent 0</ListGroupItem>
      <ListGroupItem indentLevel={1}>Indent 1</ListGroupItem>
      <ListGroupItem indentLevel={2}>Indent 2</ListGroupItem>
      <ListGroupItem indentLevel={3}>Indent 3</ListGroupItem>
      <ListGroupItem indentLevel={4}>Indent 4</ListGroupItem>
      <ListGroupItem indentLevel={3}>Indent 3</ListGroupItem>
      <ListGroupItem indentLevel={2}>Indent 2</ListGroupItem>
      <ListGroupItem indentLevel={1}>Indent 1</ListGroupItem>
      <ListGroupItem indentLevel={0}>Indent 0</ListGroupItem>
    </ListGroup>
  </div>
);

export const _selectable = () => {
  const [selected, setSelected] = React.useState(-1);
  return (
    <div style={{ width: '350px' }}>
      <ListGroup>
        <ListGroupItem selectable isSelected={selected === 0} onClick={() => setSelected(0)}>
          Selectable
        </ListGroupItem>
        <ListGroupItem selectable isSelected={selected === 1} onClick={() => setSelected(1)}>
          list
        </ListGroupItem>
        <ListGroupItem selectable isSelected={selected === 2} onClick={() => setSelected(2)}>
          of
        </ListGroupItem>
        <ListGroupItem selectable isSelected={selected === 3} onClick={() => setSelected(3)}>
          things...
        </ListGroupItem>
      </ListGroup>
    </div>
  );
};

const unitTestResults = [
  {
    _id: 'ut_A',
    title: 'Title of my test',
    duration: '23',
    err: {
      message: '',
    },
  },
  {
    _id: 'ut_B',
    title: 'Title of my test',
    duration: '201',
    err: {
      message: 'expected 200 to equal 200',
    },
  },
  {
    _id: 'ut_C',
    title: 'Title of my test',
    duration: '87',
    err: {
      message: 'expected 200 to equal 200',
    },
  },
  {
    _id: 'ut_D',
    title: 'Title of my test',
    duration: '300',
    err: {
      message: 'expected 200 to equal 200',
    },
  },
];

const unitTests = [
  {
    _id: 'ut_2225a18649504b008b94d726f3dfa19A',
    type: 'UnitTest',
    parentId: 'uts_1ef3b15dbf844b349a309c41b652472a',
    modified: 1599660181045,
    created: 1598532257797,
    requestId: 'req_wrk_3f5704e2fc744ac8b1a3c343791dbee9f2d8c170',
    name: 'Returns 200',
    code:
      'const response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);\nconst response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);\nconst response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);\nconst response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);\nconst response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);',
  },
  {
    _id: 'ut_2225a18649504b008b94d726f3dfa19d',
    type: 'UnitTest',
    parentId: 'uts_1ef3b15dbf844b349a309c41b652472a',
    modified: 1599660181045,
    created: 1598532257797,
    requestId: 'req_wrk_3f5704e2fc744ac8b1a3c343791dbee9f2d8c170',
    name: 'Returns 200',
    code:
      'const response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);\nconst response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);\nconst response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);\nconst response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);\nconst response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);',
  },
];

const unitTestRequests = [
  {
    name: 'Tags /  [GET] List Tags',
    request: {
      _id: 'req_wrk_758bf05cec5940bfb172e29449412220f2d8c170',
      type: 'Request',
      parentId: 'fld_wrk_758bf05cec5940bfb172e29449412220848eed0f',
      modified: 1599149817249,
      created: 1588864830793,
      url: '{{ base_url }}/tags',
      name: 'List Tags',
      description: '',
      method: 'GET',
      body: {},
      parameters: [],
      headers: [],
      authentication: {},
      metaSortKey: -1588864830793,
      isPrivate: false,
      settingStoreCookies: true,
      settingSendCookies: true,
      settingDisableRenderRequestBody: false,
      settingEncodeUrl: true,
      settingRebuildPath: true,
      settingFollowRedirects: 'global',
    },
  },
  {
    name: 'Tags /  [GET] List Tags by Tag Name',
    request: {
      _id: 'req_wrk_758bf05cec5940bfb172e29449412220969d3aeb',
      type: 'Request',
      parentId: 'fld_wrk_758bf05cec5940bfb172e29449412220848eed0f',
      modified: 1599149817246,
      created: 1588864830792,
      url: '{{ base_url }}/tags/{{ tag }}',
      name: 'List Tags by Tag Name',
      description: '',
      method: 'GET',
      body: {},
      parameters: [],
      headers: [],
    },
  },
  {
    name: ' [GET] asdf asdsadasfd',
    request: {
      _id: 'req_3dfdad515dc84962baaacd769088fffa',
      type: 'Request',
      parentId: 'wrk_758bf05cec5940bfb172e29449412220',
      modified: 1599149244361,
      created: 1599149176770,
      url: '',
      name: 'asdf asdsadasfd',
      description: '',
      method: 'GET',
      body: {},
      parameters: [],
      headers: [],
    },
  },
  {
    name: ' [GET] List Services',
    request: {
      _id: 'req_wrk_758bf05cec5940bfb172e2944941222096633c4a',
      type: 'Request',
      parentId: 'wrk_758bf05cec5940bfb172e29449412220',
      modified: 1599149817244,
      created: 1588864830790,
      url: '{{ base_url }}/services',
      name: 'List Services',
      description: '',
      method: 'GET',
      body: {},
      parameters: [
        {
          name: 'offset',
          disabled: true,
          value: 'string',
        },
        {
          name: 'size',
          disabled: true,
          value: '100',
        },
        {
          name: 'tags',
          disabled: true,
          value: 'string',
        },
      ],
      headers: [],
    },
  },
];

const _handleRequestSelected = () => {
  console.log('Request selected...');
};

export const _unitTests = () => (
  <div style={{ width: '100%' }}>
    <ListGroup>
      {unitTests.map((test, i) => (
        <UnitTestItem
          testNameEditable={test.name}
          item={test}
          key={test._id}
          onSetActiveRequest={_handleRequestSelected}
          selectableRequests={unitTestRequests}>
          <div style={{ padding: '10px 15px', border: '1px solid #eee', margin: '10px' }}>
            CodeMirror instance.
          </div>
        </UnitTestItem>
      ))}
    </ListGroup>
  </div>
);

export const _unitTestResults = () => (
  <div style={{ width: '350px' }}>
    <ListGroup>
      {unitTestResults.map((test, i) => (
        <UnitTestResultItem item={test} key={test._id} />
      ))}
    </ListGroup>
  </div>
);
