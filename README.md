# sodaCat Explorer

Interactive browser for the [sodaCat](https://github.com/s13n/sodaCat) hardware database. Browse register maps, compare chips, search across all supported vendors and families.

Pure static HTML/JS — no frameworks, no server required.

## Features

- Hierarchical browsing: families → subfamilies → chips → blocks → registers
- 32-bit register map visualization with field-level detail
- Tiered search across chips, blocks, registers, and fields
- Chip and block comparison with diff highlighting
- Export registers as JSON or C structs
- Sepia color theme

## Local Development

**Prerequisites:** Python 3, `ruamel.yaml` (`pip install ruamel.yaml`)

Clone both repositories:

```bash
git clone https://github.com/s13n/sodaCat-explorer.git
git clone https://github.com/s13n/sodaCat.git
```

Build the JSON data:

```bash
cd sodaCat-explorer
python3 build.py --sodacat-dir ../sodaCat --output-dir data
```

Vendors are auto-discovered from `svd/` subdirectories in the sodaCat repo. Any subdirectory containing a YAML config with a `families` section is picked up automatically. The optional `displayPrefix` field in the config is prepended to family codes (e.g., `displayPrefix: STM32` + `H7` = `STM32H7`).

Serve locally:

```bash
python3 -m http.server 8000
```

Open http://localhost:8000.

## Deployment

GitHub Actions builds the data automatically:

- **Build Data** — runs weekly (Monday 06:00 UTC) or on manual trigger. Clones sodaCat, runs `build.py`, uploads the data as an artifact.
- **Deploy to GitHub Pages** — triggers after a successful build or on manual trigger. Assembles the site and deploys to Pages.

To enable Pages: go to the repo Settings → Pages → Source → "GitHub Actions".

## Data Pipeline

`build.py` converts sodaCat's YAML models to JSON, processing each vendor sequentially:

| Output | Contents | Size |
|--------|----------|------|
| `data/index.json` | Family tree, block/chip metadata | ~300 KB |
| `data/blocks/` | Per-block JSON (846 files) | ~40 MB total |
| `data/chips/` | Per-chip JSON (153 files) | ~1 MB total |
| `data/search-tier1.json` | Chip + block names | ~86 KB |
| `data/search-tier2.json` | Register names | ~2.4 MB |
| `data/search-tier3.json` | Field names | ~14 MB |

Large blocks (>50 KB) also get a `.summary.json` with register metadata but no field arrays, for faster initial loading.

## License

MIT
