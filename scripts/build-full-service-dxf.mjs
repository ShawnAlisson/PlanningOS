import { writeFileSync } from 'node:fs';

const out = process.argv[2] || 'public/demos/full-service-house-plan.dxf';
const rows = [];

function pair(code, value) {
  rows.push(String(code), String(value));
}

function line(layer, x1, y1, x2, y2) {
  pair(0, 'LINE');
  pair(8, layer);
  pair(10, x1);
  pair(20, y1);
  pair(11, x2);
  pair(21, y2);
}

function poly(layer, points, closed = true) {
  pair(0, 'LWPOLYLINE');
  pair(8, layer);
  pair(90, points.length);
  pair(70, closed ? 1 : 0);
  points.forEach(([x, y]) => {
    pair(10, x);
    pair(20, y);
  });
}

function circle(layer, x, y, radius) {
  pair(0, 'CIRCLE');
  pair(8, layer);
  pair(10, x);
  pair(20, y);
  pair(40, radius);
}

function text(layer, x, y, value, height = 0.22) {
  pair(0, 'TEXT');
  pair(8, layer);
  pair(10, x);
  pair(20, y);
  pair(40, height);
  pair(1, value);
}

function rect(layer, x, y, width, height) {
  poly(layer, [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ]);
}

pair(0, 'SECTION');
pair(2, 'HEADER');
pair(9, '$INSUNITS');
pair(70, 6);
pair(0, 'ENDSEC');
pair(0, 'SECTION');
pair(2, 'TABLES');
pair(0, 'TABLE');
pair(2, 'LAYER');
pair(70, 9);
[
  ['EXISTING_WALLS', 7],
  ['PROPOSED_EXTENSION', 5],
  ['OPENINGS', 4],
  ['FURNITURE', 3],
  ['ANNOTATION', 2],
  ['ELECTRICAL_POWER', 2],
  ['LIGHTING', 2],
  ['PLUMBING_WASTE', 5],
  ['HVAC_VENT', 4],
].forEach(([name, color]) => {
  pair(0, 'LAYER');
  pair(2, name);
  pair(70, 0);
  pair(62, color);
  pair(6, 'CONTINUOUS');
});
pair(0, 'ENDTAB');
pair(0, 'ENDSEC');
pair(0, 'SECTION');
pair(2, 'ENTITIES');

// Existing house shell, rooms, chimney breast, bay, and internal partitions.
rect('EXISTING_WALLS', 0, 0, 8, 9.6);
rect('EXISTING_WALLS', 0.25, 0.25, 7.5, 9.1);
poly('EXISTING_WALLS', [[2.2, 0], [5.8, 0], [5.45, -1], [2.55, -1]]);
line('EXISTING_WALLS', 0.25, 3.2, 7.75, 3.2);
line('EXISTING_WALLS', 0.25, 6.2, 7.75, 6.2);
line('EXISTING_WALLS', 3.85, 0.25, 3.85, 9.35);
line('EXISTING_WALLS', 5.65, 3.2, 5.65, 6.2);
line('EXISTING_WALLS', 2.1, 6.2, 2.1, 9.35);
rect('EXISTING_WALLS', 3.25, 3.55, 0.7, 1.35);
rect('EXISTING_WALLS', 7.35, 1.2, 0.4, 1.8);
rect('EXISTING_WALLS', 0.25, 6.2, 1.85, 3.15);

// Proposed rear extension with structural returns and rooflight outline.
rect('PROPOSED_EXTENSION', 0, 9.6, 8, 4.6);
rect('PROPOSED_EXTENSION', 0.25, 9.85, 7.5, 4.1);
line('PROPOSED_EXTENSION', 2.85, 9.85, 2.85, 13.95);
line('PROPOSED_EXTENSION', 5.55, 9.85, 5.55, 13.95);
rect('PROPOSED_EXTENSION', 3.25, 11.05, 1.8, 1.05);
rect('PROPOSED_EXTENSION', 6.05, 10.2, 1.05, 2.8);
line('PROPOSED_EXTENSION', 0, 14.2, 8, 14.2);

// Doors, windows, and openings.
line('OPENINGS', 2.75, -1, 5.25, -1);
line('OPENINGS', 0, 1.1, 0, 2.3);
line('OPENINGS', 8, 1.25, 8, 2.65);
line('OPENINGS', 0, 4.05, 0, 5.3);
line('OPENINGS', 8, 4.1, 8, 5.25);
line('OPENINGS', 1.0, 9.6, 3.05, 9.6);
line('OPENINGS', 4.9, 9.6, 7.0, 9.6);
line('OPENINGS', 1.1, 14.2, 3.4, 14.2);
line('OPENINGS', 4.4, 14.2, 7.25, 14.2);
line('OPENINGS', 3.85, 1.45, 4.75, 1.45);
line('OPENINGS', 3.85, 7.0, 4.75, 7.0);
line('OPENINGS', 5.65, 4.1, 6.55, 4.1);
line('OPENINGS', 2.1, 7.2, 2.9, 7.2);

// Furniture and fixtures by room.
rect('FURNITURE', 0.75, 0.65, 2.15, 0.85);
rect('FURNITURE', 0.75, 1.75, 0.72, 0.72);
rect('FURNITURE', 2.0, 1.75, 0.72, 0.72);
rect('FURNITURE', 4.35, 0.75, 2.6, 1.2);
rect('FURNITURE', 4.55, 2.25, 1.8, 0.55);
rect('FURNITURE', 0.7, 3.75, 2.3, 0.7);
rect('FURNITURE', 0.7, 5.0, 2.3, 0.7);
rect('FURNITURE', 4.35, 3.65, 0.62, 1.8);
rect('FURNITURE', 5.1, 5.1, 2.1, 0.55);
rect('FURNITURE', 0.65, 6.75, 1.05, 1.6);
rect('FURNITURE', 2.45, 6.75, 1.05, 1.6);
rect('FURNITURE', 4.35, 6.65, 2.2, 1.35);
rect('FURNITURE', 6.75, 6.55, 0.75, 1.05);
rect('FURNITURE', 0.6, 10.3, 1.9, 2.35);
rect('FURNITURE', 3.15, 10.3, 2.0, 1.05);
rect('FURNITURE', 3.25, 12.45, 1.85, 1.1);
rect('FURNITURE', 6.15, 10.35, 0.82, 0.82);
rect('FURNITURE', 6.95, 10.35, 0.55, 1.35);
rect('FURNITURE', 6.2, 12.5, 1.2, 0.6);
circle('FURNITURE', 6.55, 11.55, 0.22);
circle('FURNITURE', 7.1, 11.55, 0.22);

// Annotation, room names, scale notes, and dimensions.
text('ANNOTATION', 0.2, -1.75, 'Front bay / existing entrance', 0.2);
text('ANNOTATION', 0.75, 2.85, 'Living room', 0.24);
text('ANNOTATION', 4.35, 2.85, 'Reception', 0.24);
text('ANNOTATION', 0.75, 5.85, 'Dining', 0.24);
text('ANNOTATION', 4.35, 5.85, 'Kitchen', 0.24);
text('ANNOTATION', 0.65, 9.1, 'Utility / WC', 0.2);
text('ANNOTATION', 4.35, 8.95, 'Bedroom / study', 0.22);
text('ANNOTATION', 0.55, 13.6, 'Proposed family room extension', 0.25);
text('ANNOTATION', 6.0, 13.55, 'Shower / plant', 0.2);
text('ANNOTATION', 0, 15.15, 'PlanningOS full-service CAD demo - all layers visible', 0.22);
text('ANNOTATION', 8.45, 0, 'EXISTING_WALLS', 0.18);
text('ANNOTATION', 8.45, 9.7, 'PROPOSED_EXTENSION', 0.18);
text('ANNOTATION', -1.2, 4.7, '8.00m', 0.18);
text('ANNOTATION', 3.25, 14.7, '12.60m total rear depth incl. extension', 0.18);

// Electrical power: ring main, outlets, cooker, data points.
poly('ELECTRICAL_POWER', [[0.65, 0.65], [7.35, 0.65], [7.35, 9.0], [0.65, 9.0], [0.65, 0.65]], false);
poly('ELECTRICAL_POWER', [[0.65, 10.15], [7.35, 10.15], [7.35, 13.65], [0.65, 13.65], [0.65, 10.15]], false);
[[0.85, 1.0], [3.35, 0.75], [7.1, 1.0], [0.85, 4.2], [3.35, 5.7], [7.1, 5.65], [0.85, 8.75], [3.35, 8.75], [7.1, 8.75], [0.85, 10.45], [2.65, 13.45], [5.65, 10.45], [7.1, 13.4]].forEach(([x, y]) => circle('ELECTRICAL_POWER', x, y, 0.12));
circle('ELECTRICAL_POWER', 5.45, 5.45, 0.16);
circle('ELECTRICAL_POWER', 6.85, 12.95, 0.16);

// Lighting: switched circuits and fittings.
line('LIGHTING', 1.1, 2.45, 7.0, 2.45);
line('LIGHTING', 1.1, 5.25, 7.0, 5.25);
line('LIGHTING', 1.1, 7.9, 7.0, 7.9);
line('LIGHTING', 1.1, 12.3, 7.0, 12.3);
[[2.0, 2.45], [6.0, 2.45], [2.0, 5.25], [6.0, 5.25], [1.25, 7.9], [4.95, 7.9], [1.75, 12.3], [4.25, 12.3], [6.75, 12.3]].forEach(([x, y]) => circle('LIGHTING', x, y, 0.22));
[[3.65, 1.1], [3.65, 3.55], [3.65, 6.65], [7.45, 9.85]].forEach(([x, y]) => rect('LIGHTING', x, y, 0.18, 0.3));

// Plumbing waste and supply routes.
line('PLUMBING_WASTE', 6.82, 14.0, 6.82, 4.1);
line('PLUMBING_WASTE', 6.82, 5.45, 5.3, 5.45);
line('PLUMBING_WASTE', 6.82, 12.8, 7.4, 12.8);
line('PLUMBING_WASTE', 6.82, 11.6, 6.45, 11.6);
line('PLUMBING_WASTE', 1.2, 8.8, 1.2, 6.7);
circle('PLUMBING_WASTE', 5.45, 5.45, 0.11);
circle('PLUMBING_WASTE', 6.55, 11.55, 0.11);
circle('PLUMBING_WASTE', 7.1, 11.55, 0.11);
circle('PLUMBING_WASTE', 1.2, 8.3, 0.11);

// HVAC supply/return ducts and vents.
line('HVAC_VENT', 0.65, 9.15, 7.35, 9.15);
line('HVAC_VENT', 0.65, 13.85, 7.35, 13.85);
line('HVAC_VENT', 4.0, 9.15, 4.0, 13.85);
[[1.15, 9.15], [3.7, 9.15], [6.6, 9.15], [1.15, 13.85], [4.0, 13.85], [6.6, 13.85]].forEach(([x, y]) => rect('HVAC_VENT', x, y, 0.38, 0.16));
circle('HVAC_VENT', 4.0, 11.5, 0.18);

pair(0, 'ENDSEC');
pair(0, 'EOF');

writeFileSync(out, `${rows.join('\n')}\n`);
console.log(`Wrote ${out}`);
