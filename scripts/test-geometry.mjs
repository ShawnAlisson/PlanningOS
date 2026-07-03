import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import DxfParser from 'dxf-parser';

const METRES_PER_DEGREE_LAT = 111320;

function rotatePoint(point, degrees) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: point.x * Math.cos(radians) - point.y * Math.sin(radians),
    y: point.x * Math.sin(radians) + point.y * Math.cos(radians),
  };
}

function buildRing({ lat, lng, widthM, depthM, rotationDeg }) {
  const metresPerDegreeLng = METRES_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
  return [
    { x: -widthM / 2, y: -depthM / 2 },
    { x: widthM / 2, y: -depthM / 2 },
    { x: widthM / 2, y: depthM / 2 },
    { x: -widthM / 2, y: depthM / 2 },
  ].map((point) => {
    const rotated = rotatePoint(point, rotationDeg);
    return [lng + rotated.x / metresPerDegreeLng, lat + rotated.y / METRES_PER_DEGREE_LAT];
  });
}

function parseDxf(path) {
  return new DxfParser().parseSync(readFileSync(path, 'utf8'));
}

test('fixture DXF exposes layer and entity structure', () => {
  const dxf = parseDxf('samples/fixtures/open-house-plan.dxf');
  const layers = new Set(dxf.entities.map((entity) => entity.layer));
  assert.equal(dxf.header.$INSUNITS, 6);
  assert.ok(layers.has('EXISTING_WALLS'));
  assert.ok(layers.has('PROPOSED_EXTENSION'));
  assert.ok(dxf.entities.some((entity) => entity.type === 'LWPOLYLINE'));
});

test('bundled demo DXF has the expected rich CAD layers', () => {
  const dxf = parseDxf('samples/demo.dxf');
  const layers = new Set(dxf.entities.map((entity) => entity.layer));
  assert.ok(dxf.entities.length >= 100);
  assert.ok(layers.has('Walls'));
  assert.ok(layers.has('Pillars'));
  assert.ok(layers.has('Furnitures'));
});

test('public full-service house plan includes CAD discipline layers and annotations', () => {
  const dxf = parseDxf('public/demos/full-service-house-plan.dxf');
  const layers = new Set(dxf.entities.map((entity) => entity.layer));
  [
    'EXISTING_WALLS',
    'PROPOSED_EXTENSION',
    'OPENINGS',
    'FURNITURE',
    'ANNOTATION',
    'ELECTRICAL_POWER',
    'LIGHTING',
    'PLUMBING_WASTE',
    'HVAC_VENT',
  ].forEach((layer) => assert.ok(layers.has(layer), `missing layer ${layer}`));

  assert.ok(dxf.entities.length >= 90);
  assert.ok(dxf.entities.filter((entity) => entity.layer === 'FURNITURE').length >= 15);
  assert.ok(dxf.entities.filter((entity) => entity.layer === 'OPENINGS').length >= 10);
  assert.ok(dxf.entities.some((entity) => entity.type === 'TEXT' && /family room extension/i.test(entity.text || '')));
  assert.ok(dxf.entities.some((entity) => entity.type === 'CIRCLE' && entity.layer === 'LIGHTING'));
  assert.ok(dxf.entities.some((entity) => entity.type === 'LINE' && entity.layer === 'PLUMBING_WASTE'));
});

test('rotated footprint geometry changes map coordinates without changing dimensions', () => {
  const flat = buildRing({ lat: 51.45, lng: -0.07, widthM: 8, depthM: 4, rotationDeg: 0 });
  const rotated = buildRing({ lat: 51.45, lng: -0.07, widthM: 8, depthM: 4, rotationDeg: 45 });
  assert.notDeepEqual(rotated, flat);
  assert.equal(rotated.length, 4);
  assert.ok(Math.abs(rotated[0][0] - flat[0][0]) > 0.000001);
});
