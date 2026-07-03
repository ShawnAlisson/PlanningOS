# End-to-End DXF Scenario

This path tests the real postcode lookup, uploaded DXF parsing, map massing controls, and BIM-like before/after card.

## Scenario

- Address: `12 Grove Vale, Southwark, SE22 8QZ`
- Postcode data: live `postcodes.io` + `planning.data.gov.uk`
- DXF: `samples/fixtures/open-house-plan.dxf`
- Proposal text: two-storey rear extension, 5m high, neighbour overlooking risk, highway construction risk

Important limitation: this is a current real UK postcode with an open DXF test plan. I could not verify a public UK planning record that publishes a real editable DXF for the same house; public planning portals normally publish PDFs/images rather than CAD source files.

## Fast Path

### In-App Sample Demo

1. Start the app:

```bash
npm run dev
```

2. Open `http://localhost:3000`.

3. In the left sidebar, click `1. Full DXF BIM Demo`.

4. Wait for the processing page to finish, then open the generated review page.

5. Verify:

- The application file list includes `full-service-house-plan.dxf`.
- The site map uses the active postcode `SE22 8QZ`.
- The floor-by-floor DXF card has `Before`, `After`, and `Compare` modes.
- The floor controls include `Ground floor` and `First floor`.
- CAD layers include `EXISTING_WALLS`, `PROPOSED_EXTENSION`, `ELECTRICAL_POWER`, `LIGHTING`, `PLUMBING_WASTE`, and `HVAC_VENT`.
- The old `Missing CAD service layers` warning is not shown.

### CLI Showcase

1. Start the app:

```bash
npm run dev
```

2. In another terminal, create the showcase application:

```bash
npm run showcase:dxf
```

3. Open the printed `/processing/{id}` URL and wait for completion.

4. On `/review/{id}`, verify:

- The Site Map card labels the uploaded DXF as the footprint source.
- Height, width, depth, rotation, east-west, and north-south controls update the map without errors.
- The BIM-like card shows layer controls for `EXISTING_WALLS`, `PROPOSED_EXTENSION`, `OPENINGS`, `FURNITURE`, and `ANNOTATION`.
- The Before/After button toggles the proposed layer visibility.
- X-ray and Explode controls visibly change the model.
- Agent cards show evidence quality, and the highways/neighbour agents react to the description risk wording.

## Manual Fixture Comparison

Upload any of these in the normal wizard to compare parser behavior:

- `samples/demo.dxf` - richer architectural plan already bundled with the project.
- `samples/fixtures/open-house-plan.dxf` - explicit existing/proposed house-plan fixture.
- `samples/fixtures/librecad-architect-complete-e.dxf` - downloaded LibreCAD architectural symbol fixture.
- `samples/fixtures/librecad-architect-complete-v.dxf` - downloaded LibreCAD architectural symbol fixture.
- `samples/fixtures/librecad-door-d1.dxf` - downloaded LibreCAD door symbol fixture.
- `samples/fixtures/librecad-dim-sample.dxf` - downloaded LibreCAD dimension sample.
