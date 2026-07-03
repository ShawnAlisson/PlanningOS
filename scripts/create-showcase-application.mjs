import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const appUrl = process.env.PLANNINGOS_URL || 'http://localhost:3000';
const fixturePath = resolve(process.argv[2] || 'samples/fixtures/open-house-plan.dxf');
const fileName = basename(fixturePath);
const dxf = readFileSync(fixturePath);

const metadata = {
  title: 'Showcase: two-storey rear extension with DXF plan',
  address: '12 Grove Vale, Southwark, SE22 8QZ',
  description:
    'Real-postcode showcase using a DXF plan. Proposed two storey rear extension, 5m high, with overlooking risk to neighbours and construction close to the highway. The DXF contains existing and proposed plan layers for before/after comparison.',
  sourceMode: 'manual',
  sourceNote: `Showcase scenario: real UK postcode + uploaded DXF fixture (${fileName}).`,
  extractedData: {
    neighbourImpactLevel: 'high',
  },
};

const form = new FormData();
form.append('metadata', JSON.stringify(metadata));
form.append('files', new File([dxf], fileName, { type: 'application/dxf' }));

const res = await fetch(`${appUrl}/api/applications/upload`, { method: 'POST', body: form });
const body = await res.json();

if (!res.ok) {
  console.error(body);
  process.exit(1);
}

console.log(`Created application ${body.id}`);
console.log(`Open: ${appUrl}/processing/${body.id}`);
