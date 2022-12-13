/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable camelcase */
// inspiration: https://github.com/grpc/grpc/blob/master/examples/node/dynamic_codegen/route_guide/route_guide_server.js
import * as grpc from '@grpc/grpc-js';
import { HandleCall } from '@grpc/grpc-js/build/src/server-call';
import * as protoLoader from '@grpc/proto-loader';
import { addReflection } from '@ravanallc/grpc-server-reflection';
import fs from 'fs';
import path from 'path';

const PROTO_PATH = path.resolve('../../packages/insomnia/src/network/grpc/__fixtures__/library/route_guide.proto');
const packageDefinition = protoLoader.loadSync(
  PROTO_PATH,
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

const routeguide = grpc.loadPackageDefinition(packageDefinition).routeguide;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let featureList: any[] = [];

const COORD_FACTOR = 1e7;

/**
 * Get a feature object at the given point, or creates one if it does not exist.
 * @param {point} point The point to check
 * @return {feature} The feature object at the point. Note that an empty name
 *     indicates no feature
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkFeature(point: { latitude: any; longitude: any }) {
  let feature;
  // Check if there is already a feature object for the given point
  for (let i = 0; i < featureList.length; i++) {
    feature = featureList[i];
    if (feature.location.latitude === point.latitude &&
        feature.location.longitude === point.longitude) {
      return feature;
    }
  }
  const name = '';
  feature = {
    name: name,
    location: point,
  };
  return feature;
}

/**
 * getFeature request handler.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getFeature: HandleCall<any, any> = (call: any, callback: any) => {
  callback(null, checkFeature(call.request));
};

/**
 * listFeatures request handler.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const listFeatures: HandleCall<any, any> = (call: any) => {
  const lo = call.request.lo;
  const hi = call.request.hi;
  const left = Math.min(lo.longitude, hi.longitude);
  const right = Math.max(lo.longitude, hi.longitude);
  const top = Math.max(lo.latitude, hi.latitude);
  const bottom = Math.min(lo.latitude, hi.latitude);
  // For each feature, check if it is in the given bounding box
  featureList.forEach(function(feature) {
    if (feature.name === '') {
      return;
    }
    if (feature.location.longitude >= left &&
        feature.location.longitude <= right &&
        feature.location.latitude >= bottom &&
        feature.location.latitude <= top) {
      call.write(feature);
    }
  });
  call.end();
};

/**
 * Calculate the distance between two points using the "haversine" formula.
 * The formula is based on http://mathforum.org/library/drmath/view/51879.html.
 * @param start The starting point
 * @param end The end point
 * @return The distance between the points in meters
 */
function getDistance(start: { latitude: number; longitude: number }, end: { latitude: number; longitude: number }) {
  function toRadians(num: number) {
    return num * Math.PI / 180;
  }
  const R = 6371000;  // earth radius in metres
  const lat1 = toRadians(start.latitude / COORD_FACTOR);
  const lat2 = toRadians(end.latitude / COORD_FACTOR);
  const lon1 = toRadians(start.longitude / COORD_FACTOR);
  const lon2 = toRadians(end.longitude / COORD_FACTOR);

  const deltalat = lat2 - lat1;
  const deltalon = lon2 - lon1;
  const a = Math.sin(deltalat / 2) * Math.sin(deltalat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(deltalon / 2) * Math.sin(deltalon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * recordRoute handler.
 */
const recordRoute: HandleCall<any, any> = (call: any, callback: any) => {
  let pointCount = 0;
  let featureCount = 0;
  let distance = 0;
  let previous: { latitude: number; longitude: number } | null = null;
  // Start a timer
  const startTime = process.hrtime();
  call.on('data', function(point: any) {
    pointCount += 1;
    if (checkFeature(point).name !== '') {
      featureCount += 1;
    }
    /* For each point after the first, add the incremental distance from the
     * previous point to the total distance value */
    if (previous != null) {
      distance += getDistance(previous, point);
    }
    previous = point;
  });
  call.on('end', function() {
    callback(null, {
      point_count: pointCount,
      feature_count: featureCount,
      // Cast the distance to an integer
      distance: distance | 0,
      // End the timer
      elapsed_time: process.hrtime(startTime)[0],
    });
  });
};

const routeNotes = {};

/**
 * Turn the point into a dictionary key.
 * @param {point} point The point to use
 * @return {string} The key for an object
 */
function pointKey(point: { latitude: string; longitude: string }) {
  return point.latitude + ' ' + point.longitude;
}

/**
 * routeChat handler. Receives a stream of message/location pairs, and responds
 * with a stream of all previous messages at each of those locations.
 * @param {Duplex} call The stream for incoming and outgoing messages
 */
const routeChat: HandleCall<any, any> = (call: any) => {
  call.on('data', function(note: any) {
    const key = pointKey(note.location);
    /* For each note sent, respond with all previous notes that correspond to
     * the same point */
    if (routeNotes.hasOwnProperty(key)) {
      // @ts-expect-error typescript
      routeNotes[key].forEach(function(note: any) {
        call.write(note);
      });
    } else {
      // @ts-expect-error typescript
      routeNotes[key] = [];
    }
    // Then add the new note to the list
    // @ts-expect-error typescript
    routeNotes[key].push(JSON.parse(JSON.stringify(note)));
  });
  call.on('end', function() {
    call.end();
  });
};

/**
 * Starts an RPC server that uses Route Guide example for PreRelease tests
 */
export const startGRPCServer = (port: number) => {
  return new Promise<void>((resolve, reject) => {
    const server = new grpc.Server();

    // Enable reflection
    const descriptorSet = '../../packages/insomnia-smoke-test/fixtures/route_guide.bin';
    addReflection(server, descriptorSet);

    // @ts-expect-error generated from proto file
    server.addService(routeguide.RouteGuide.service, {
      getFeature: getFeature,
      listFeatures: listFeatures,
      recordRoute: recordRoute,
      routeChat: routeChat,
    });
    server.bindAsync(`localhost:${port}`, grpc.ServerCredentials.createInsecure(), error => {
      if (error) {
        return reject(error);
      }

      const dbPath = '../../packages/insomnia/src/network/grpc/__fixtures__/library/route_guide_db.json';
      fs.readFile(path.resolve(dbPath), function(err, data) {
        if (err) {
          throw err;
        }
        featureList = JSON.parse(data.toString());
        console.log(`Listening at grpc://localhost:${port} for route_guide.proto`);
        server.start();
        resolve();
      });
    });
  });
};
