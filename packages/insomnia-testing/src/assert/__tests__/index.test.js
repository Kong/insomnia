// @flow
import chai from 'chai';
import { chaiHttp } from '../index';

describe('assert', () => {
  describe('chaiHttp', () => {
    beforeEach(() => {
      // Add http helper
      chai.use(chaiHttp);
    });

    describe('status', () => {
      it('should assert correct status code', () => {
        const resp = newResponse({ status: 200 });
        chai.expect(resp).to.have.status(200);
      });

      it('should assert incorrect status code', () => {
        const resp = newResponse({ status: 200 });
        const fn = () => chai.expect(resp).to.have.status(400);
        expect(fn).toThrowError('expected response to have status code 400 but got 200');
      });

      it('should assert negation of status code', () => {
        const resp = newResponse({ status: 200 });
        chai.expect(resp).to.not.have.status(300);
      });

      it('should assert incorrect negation of status code', () => {
        const resp = newResponse({ status: 200 });
        const fn = () => chai.expect(resp).to.not.have.status(200);
        expect(fn).toThrowError('expected response to not have status code 200');
      });
    });

    describe('content-type', () => {
      it('should assert content-type', () => {
        const resJson = newResponse({
          headers: [{ name: 'content-type', value: 'application/json' }],
        });

        const resText = newResponse({
          headers: [{ name: 'content-type', value: 'text/plain' }],
        });

        const resHtml = newResponse({
          headers: [{ name: 'content-type', value: 'text/html' }],
        });

        chai.expect(resJson).to.be.json;
        chai.expect(resText).to.be.text;
        chai.expect(resHtml).to.be.html;
      });

      it('should assert negation of content-type', () => {
        const resp = newResponse({
          headers: [{ name: 'content-type', value: 'application/json' }],
        });
        const fn = () => chai.expect(resp).to.be.text;
        expect(fn).toThrowError('s');
      });
    });
  });
});

function newResponse(patch: Object): Object {
  return {
    status: patch.status || 0,
    body: patch.body || '',
    headers: patch.headers || [],
  };
}
