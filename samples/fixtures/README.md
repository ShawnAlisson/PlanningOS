# DXF fixtures

## `open-house-plan.dxf`

Small ASCII DXF fixture modelled after the public DXF interchange structure documented by Autodesk and compatible with LibreCAD/QCAD-style layer workflows.

- Source basis: public DXF format examples and the open DXF layer/entity convention used by LibreCAD.
- License for this fixture file: CC0-1.0 / public-domain equivalent for project testing.
- Purpose: repeatable parser and BIM-like layer-view tests without relying on a third-party download at runtime.
- Layers: `EXISTING_WALLS`, `PROPOSED_EXTENSION`, `OPENINGS`, `FURNITURE`, `ANNOTATION`.

References:
- https://en.wikipedia.org/wiki/AutoCAD_DXF
- https://en.wikipedia.org/wiki/LibreCAD

## Downloaded LibreCAD fixtures

The following files were downloaded from the LibreCAD GitHub repository, commit `2898ba416c49c48365b2975569275b94fcef0492`, and copied into this repo for repeatable parser comparison:

- `librecad-architect-complete-e.dxf`
- `librecad-architect-complete-v.dxf`
- `librecad-door-d1.dxf`
- `librecad-dim-sample.dxf`

Source repository: https://github.com/LibreCAD/LibreCAD

LibreCAD is GPL-2.0-only; these fixtures should be treated as open-source CAD test fixtures with LibreCAD project provenance.
