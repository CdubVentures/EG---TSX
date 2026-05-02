# EG Config Manager

Desktop configuration app for the EG site. The runtime lives under `config/`
and owns the JSON-backed configuration surfaces that feed `EG - TSX`.

## Start Here

- [docs/README.md](docs/README.md) - canonical doc index for the config app
- [app/README.md](app/README.md) - FastAPI shell and runtime contract
- [lib/README.md](lib/README.md) - shared reactive store and watcher contract
- [panels/README.md](panels/README.md) - Tk panel boundary and ownership
- [ui/README.md](ui/README.md) - React desktop shell and editor modules
- [data/README.md](data/README.md) - canonical mutable JSON contract
- [tests/README.md](tests/README.md) - config-manager test boundary
- [scripts/README.md](scripts/README.md) - local helper launcher scripts

## Runtime Surfaces

- `eg-config.pyw` - native Tk shell
- `app/main.py` - FastAPI shell for the React desktop app
- `data/*.json` - canonical mutable config files
- `tests/` - Python and JS coverage for the config workflows
