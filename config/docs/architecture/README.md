# Architecture Docs

Use this folder to understand the config-manager topology before changing
runtime flow, cross-panel behavior, or downstream site coupling.

## Read First

- [system-map.md](system-map.md) for the end-to-end topology: Tk shell, React
  shell, shared runtime, file contracts, and EG-TSX consumers.
- [panel-interconnection-matrix.md](panel-interconnection-matrix.md) for
  preview propagation, shared store channels, watch behavior, and panel
  coupling risks.

## Use With

- [../runtime/README.md](../runtime/README.md) for launch/runtime ownership
- [../frontend/README.md](../frontend/README.md) for React shell behavior
- [../panels/README.md](../panels/README.md) for per-panel write contracts
