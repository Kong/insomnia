/* global describe, it */

'use strict'

var fixtures = require('./fixtures')
var fs = require('fs')
var glob = require('glob')
var HTTPSnippet = require('../src')
var path = require('path')
var should = require('should')
var targets = require('../src/targets')

var base = './test/fixtures/output/'

// read all output files
var output = glob.sync('**/*', {cwd: base, nodir: true}).reduce(function (obj, name) {
  obj[name] = fs.readFileSync(base + name)
  return obj
}, {})

var clearInfo = function (key) {
  return !~['info', 'index'].indexOf(key)
}

var itShouldHaveTests = function (target, client) {
  it(target + ' should have tests', function (done) {
    fs.readdir(path.join(__dirname, 'targets', target), function (err, files) {
      should.not.exist(err)
      files.length.should.be.above(0)
      files.should.containEql(client + '.js')
      done()
    })
  })
}

var itShouldHaveInfo = function (name, obj) {
  it(name + ' should have info method', function () {
    obj.should.have.property('info').and.be.an.Object
    obj.info.key.should.equal(name).and.be.a.String
    obj.info.title.should.be.a.String
  })
}

var itShouldHaveRequestTestOutputFixture = function (request, target, path) {
  var fixture = target + '/' + path + request + HTTPSnippet.extname(target)

  it('should have output test for ' + request, function () {
    Object.keys(output).indexOf(fixture).should.be.greaterThan(-1, 'Missing ' + fixture + ' fixture file for target: ' + target + '. Snippet tests will be skipped.')
  })
}

var itShouldGenerateOutput = function (request, path, target, client) {
  var fixture = path + request + HTTPSnippet.extname(target)

  it('should generate ' + request + ' snippet', function () {
    if (Object.keys(output).indexOf(fixture) === -1) {
      this.skip()
    }
    var instance = new HTTPSnippet(fixtures.requests[request])
    var result = instance.convert(target, client) + '\n'

    result.should.be.a.String
    result.should.equal(output[fixture].toString())
  })
}

describe('Available Targets', function () {
  var targets = HTTPSnippet.availableTargets()

  targets.forEach(function (target) {
    it('available-targets.json should include ' + target.title, function () {
      fixtures['available-targets'].should.containEql(target)
    })
  })
})

// test all the things!
Object.keys(targets).forEach(function (target) {
  describe(targets[target].info.title, function () {
    itShouldHaveInfo(target, targets[target])

    Object.keys(targets[target]).filter(clearInfo).forEach(function (client) {
      describe(client, function () {
        itShouldHaveInfo(client, targets[target][client])

        itShouldHaveTests(target, client)

        var test = require(path.join(__dirname, 'targets', target, client))

        test(HTTPSnippet, fixtures)

        describe('snippets', function () {
          Object.keys(fixtures.requests).filter(clearInfo).forEach(function (request) {
            itShouldHaveRequestTestOutputFixture(request, target, client + '/')

            itShouldGenerateOutput(request, target + '/' + client + '/', target, client)
          })
        })
      })
    })
  })
})
