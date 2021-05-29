import { PostmanV210Types } from 'insomnia-importers';
import * as models from '../models/index';
import uuid from 'uuid';

export function convert(
  inputData: Array<models.BaseModel>,
  fileName: string,
) {
  const outputData = <PostmanV210Types.HttpsSchemaGetpostmanComJsonCollectionV210>{
    info: {
      _postman_id: '',
      name: '',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [],
  };
  outputData.info._postman_id = uuid.v4();

  const insomniaParentChildrenNodesMap = generateInsomniaParentChildrenNodesMap(inputData);
  const postmanItemTrees = getPostmanItemTrees(insomniaParentChildrenNodesMap);
  outputData.item.push(...postmanItemTrees);
  outputData.info.name = fileName;

  return outputData;
}

const rootId = 'd1097c3b-2011-47a4-8f95-87b8f4b54d6d'; // unique guid for root

function generateInsomniaParentChildrenNodesMap(
  insomniaParentChildAdjacencyList: Array<models.BaseModel>,
) {
  const insomniaParentChildrenNodesMap = new Map<string, Array<models.BaseModel>>();
  let tempChildrenNodesArray: Array<models.BaseModel> | undefined;
  insomniaParentChildAdjacencyList.forEach(insomniaElement => {
    // @ts-expect-error -- First fix the older _type assignments in getExportData() in packages/insomnia-app/app/common/import.tsx
    const insomniaElementType = insomniaElement._type;
    switch (insomniaElementType) {
      case 'workspace':
        tempChildrenNodesArray = insomniaParentChildrenNodesMap.get(rootId);
        if (tempChildrenNodesArray === undefined) tempChildrenNodesArray = [];
        tempChildrenNodesArray.push(insomniaElement);
        insomniaParentChildrenNodesMap.set(rootId, tempChildrenNodesArray);
        break;
      case 'request':
      case 'request_group':
        tempChildrenNodesArray = insomniaParentChildrenNodesMap.get(insomniaElement.parentId);
        if (tempChildrenNodesArray === undefined) tempChildrenNodesArray = [];
        tempChildrenNodesArray.push(insomniaElement);
        insomniaParentChildrenNodesMap.set(insomniaElement.parentId, tempChildrenNodesArray);
        break;
      default:
        console.warn('Warning: Item type unsupported; skipped!!! ... ' + insomniaElementType);
    }
  });
  return insomniaParentChildrenNodesMap;
}

function getPostmanItemTrees(
  insomniaParentChildrenNodesMap: Map<string, Array<models.BaseModel>>,
) {
  const postmanItemTrees: Array<PostmanV210Types.Items1> = [];
  const roots = insomniaParentChildrenNodesMap.get(rootId); // 'roots' means root workspaces
  if (roots && roots.length > 0) {
    if (roots.length === 1) { // if only one workspace is involved, directly process for the workspace child elements to avoid extra workspace folder
      const firstRoot = roots[0];
      const rootChildren = insomniaParentChildrenNodesMap.get(firstRoot._id);
      if (rootChildren) {
        rootChildren.forEach(insomniaElement => {
          postmanItemTrees.push(generatePostmanItemTreeRecursively(insomniaElement, insomniaParentChildrenNodesMap));
        });
      }
    } else { // if multiple workspaces are involved, pass them for processing so that folders for the workspaces are created
      roots.forEach(root => {
        postmanItemTrees.push(generatePostmanItemTreeRecursively(root, insomniaParentChildrenNodesMap));
      });
    }
  }
  return postmanItemTrees;
}

function generatePostmanItemTreeRecursively(insomniaElement, insomniaParentChildrenNodesMap) {
  let postmanItem: PostmanV210Types.Items1 = <PostmanV210Types.Items1>{};
  switch (insomniaElement._type) {
    case 'request_group':
    case 'workspace':
      postmanItem.name = insomniaElement.name;
      const itemList: Array<PostmanV210Types.Items1> = [];
      insomniaParentChildrenNodesMap.get(insomniaElement._id).forEach(child => {
        itemList.push(generatePostmanItemTreeRecursively(child, insomniaParentChildrenNodesMap));
      });
      postmanItem.item = itemList;
      break;
    case 'request':
      postmanItem = transformItem(insomniaElement);
      break;
    default:
      console.warn('Warning: Item type unsupported; skipped!!! ... ' + insomniaElement._type);
  }
  return postmanItem;
}

function transformItem(insomniaItem) {
  const postmanItem: PostmanV210Types.Items1 = <PostmanV210Types.Items1>{};
  postmanItem.name = insomniaItem.name;
  const request: PostmanV210Types.Request1 = <PostmanV210Types.Request1>{};
  request.method = insomniaItem.method;
  request.header = transformHeaders(insomniaItem.headers);
  if (Object.keys(insomniaItem.body).length > 0) {
    request.body = transformBody(insomniaItem.body);
  }
  request.url = transformUrl(insomniaItem.url);
  if (insomniaItem.parameters && insomniaItem.parameters.length > 0) {
    if (request.url.raw !== undefined && request.url.raw.includes('?')) {
      console.warn('Warning: Query params detected in both the raw query and the "parameters" object of Insomnia request!!! Exported Postman collection may need manual editing for erroneous "?" in url.');
    }
    const queryParams: Array<PostmanV210Types.QueryParam> = [];
    insomniaItem.parameters.forEach(param => {
      queryParams.push({ key: param.name, value: param.value });
    });
    request.url.query = queryParams;
  }
  request.auth = <PostmanV210Types.Auth>{}; // todo
  if (Object.keys(insomniaItem.authentication).length > 0) {
    console.warn('Warning: Auth param export not yet supported!!!');
  }
  postmanItem.request = request;
  postmanItem.response = [];
  return postmanItem;
}

function transformUrl(insomniaUrl) {
  const postmanUrl: PostmanV210Types.Url = {};
  if (insomniaUrl === '') return postmanUrl;
  postmanUrl.raw = insomniaUrl;
  const urlParts = insomniaUrl.split(/:\/\//);
  let rawHostAndPath = '';
  if (urlParts.length === 1) {
    rawHostAndPath = urlParts[0];
  } else if (urlParts.length === 2) {
    postmanUrl.protocol = urlParts[0];
    rawHostAndPath = urlParts[1];
  } else {
    console.error('Error: Unexpected number of components found in the URL string.');
    throw new Error('Unexpected number of components found in the URL string.');
  }
  const hostAndPath = rawHostAndPath.split(/\/(.+)/);
  postmanUrl.host = hostAndPath[0].split(/\./);
  postmanUrl.path = hostAndPath[1] === undefined ? [] : hostAndPath[1].split(/\//);
  return postmanUrl;
}

function transformHeaders(insomniaHeaders) {
  const outputHeaders: Array<PostmanV210Types.Header> = [];
  insomniaHeaders.forEach(element => {
    const header: PostmanV210Types.Header = <PostmanV210Types.Header>{};
    header.key = element.name;
    header.value = element.value;
    outputHeaders.push(header);
  });
  return outputHeaders;
}

function transformBody(insomniaBody) {
  const body: PostmanV210Types.Request1['body'] = {};
  switch (insomniaBody.mimeType) {
    case '':
    case 'application/json':
    case 'application/xml':
      body.mode = 'raw';
      body.raw = insomniaBody.text;
      break;
    case 'multipart/form-data':
      body.mode = 'formdata';
      body.formdata = [];
      insomniaBody.params.forEach(param => {
        body.formdata?.push({ key: param.name, value: param.value });
      });
      break;
    case 'application/x-www-form-urlencoded':
      body.mode = 'urlencoded';
      body.urlencoded = [];
      insomniaBody.params.forEach(param => {
        body.urlencoded?.push({ key: param.name, value: param.value });
      });
      break;
    case 'application/octet-stream':
      body.mode = 'file';
      body.file = {};
      body.file.src = '/C:/PleaseSelectAFile';
      console.warn('Warning: A file is supposed to be a part of the request!!! Would need to be manually selected in Postman.');
      break;
    default:
      console.warn('Warning: Body type unsupported; skipped!!! ... ' + insomniaBody.mimeType);
      body.mode = 'raw';
      body.raw = 'Insomnia to Postman export: Unsupported body type ' + insomniaBody.mimeType;
      break;
  }
  return body;
}
