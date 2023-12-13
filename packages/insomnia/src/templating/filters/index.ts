import { PluginTemplateFilter } from '../extensions';
import currentRequest from './current-request';
import currentResponse from './current-response';
import domXPath from './dom-xpath';
import jmespath from './jmespath';
import jsonDiff from './json-diff';
import jsonParse from './json-parse';
import jsonPath from './json-path';
import processNumber from './number-processing';
import stringReplace from './string-replace';
import transformUriComponent from './transform-uri-component';
import xml2json from './xml2json';

const filters: PluginTemplateFilter[] = [
    jmespath,
    jsonParse,
    jsonDiff,
    jsonPath,
    xml2json,
    processNumber,
    transformUriComponent,
    stringReplace,
    currentRequest,
    currentResponse,
    domXPath,
];

export default filters;
