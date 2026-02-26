#!/usr/bin/env python3
"""Convert sodaCat YAML models to JSON for the web browser.

Usage:
    python3 build.py --sodacat-dir ../sodaCat --output-dir data

Auto-discovers vendors by scanning svd/ subdirectories for config YAMLs
with a 'families' section. Each YAML file is loaded exactly once per vendor.
"""

import argparse
import json
import os
import sys
from pathlib import Path

from ruamel.yaml import YAML

SUMMARY_THRESHOLD = 50_000  # bytes — blocks larger than this also get a .summary.json


def load_yaml(path):
    yaml = YAML()
    yaml.width = 4096
    with open(path) as f:
        return yaml.load(f)


def yaml_to_json_obj(obj):
    """Recursively convert ruamel.yaml CommentedMap/Seq to plain dicts/lists."""
    if hasattr(obj, 'items'):
        return {str(k): yaml_to_json_obj(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [yaml_to_json_obj(v) for v in obj]
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, int):
        return obj
    if isinstance(obj, float):
        return obj
    if obj is None:
        return None
    return str(obj)


def build_family_tree(config, vendor_name, display_prefix):
    """Build the family hierarchy from a vendor config."""
    families = []
    for code, fam in config['families'].items():
        subfamilies = []
        for sub_name, sub_data in fam.get('subfamilies', {}).items():
            chips = sub_data.get('chips', []) if isinstance(sub_data, dict) else sub_data
            ref_manual = sub_data.get('ref_manual') if isinstance(sub_data, dict) else None
            entry = {'name': sub_name, 'chips': list(chips)}
            if ref_manual:
                entry['refManual'] = yaml_to_json_obj(ref_manual)
            subfamilies.append(entry)
        block_names = sorted(fam.get('blocks', {}).keys())
        families.append({
            'code': code,
            'display': f'{display_prefix}{code}' if display_prefix else code,
            'vendor': vendor_name,
            'subfamilies': subfamilies,
            'blockCount': len(block_names),
            'chipCount': sum(len(s['chips']) for s in subfamilies),
        })
    return families


def resolve_model_path(model_name, family_code, subfamily_name, block_index):
    """Resolve a model name to its block path."""
    for candidate in [
        f'{family_code}/{subfamily_name}/{model_name}',
        f'{family_code}/{model_name}',
        model_name,
    ]:
        if candidate in block_index:
            return candidate
    return None


def summarize_register(reg):
    """Strip fields from a register, replacing with fieldCount."""
    sr = {k: v for k, v in reg.items() if k not in ('fields', 'registers')}
    if 'registers' in reg:
        # Cluster: recurse into sub-registers
        sr['registers'] = [summarize_register(sub) for sub in reg['registers']]
    else:
        fields = reg.get('fields') or []
        sr['fieldCount'] = len(fields)
    return sr


def make_block_summary(block_obj):
    """Create a lightweight summary: registers without fields (just fieldCount)."""
    summary = {k: v for k, v in block_obj.items() if k != 'registers'}
    summary['registers'] = [summarize_register(reg) for reg in block_obj.get('registers', [])]
    return summary


def discover_vendors(sodacat_dir):
    """Auto-discover vendors by scanning svd/ subdirectories for family configs."""
    svd_dir = sodacat_dir / 'svd'
    if not svd_dir.is_dir():
        print(f'Error: svd directory not found: {svd_dir}', file=sys.stderr)
        sys.exit(1)

    vendors = []
    for vendor_dir in sorted(svd_dir.iterdir()):
        if not vendor_dir.is_dir():
            continue
        for yaml_file in sorted(vendor_dir.glob('*.yaml')):
            config = load_yaml(yaml_file)
            if config and 'families' in config:
                vendor_name = vendor_dir.name
                display_prefix = str(config.get('displayPrefix', ''))
                models_dir = sodacat_dir / 'models' / vendor_name
                if not models_dir.is_dir():
                    print(f'Warning: models directory not found for {vendor_name}: {models_dir}, skipping', file=sys.stderr)
                    continue
                vendors.append((vendor_name, models_dir, yaml_file, config, display_prefix))
                print(f'Discovered vendor: {vendor_name} (prefix={display_prefix!r}, config={yaml_file.name})', flush=True)

    if not vendors:
        print('Error: no vendors discovered (no svd/*/config.yaml with families section)', file=sys.stderr)
        sys.exit(1)

    return vendors


def main():
    parser = argparse.ArgumentParser(description='Build sodaCat web data from YAML models')
    parser.add_argument('--sodacat-dir', required=True, help='Path to the sodaCat repository root')
    parser.add_argument('--output-dir', required=True, help='Output directory for JSON data')
    args = parser.parse_args()

    sodacat_dir = Path(args.sodacat_dir).resolve()
    output_dir = Path(args.output_dir).resolve()

    # Auto-discover vendors from svd/ subdirectories
    vendors = discover_vendors(sodacat_dir)

    # Collect chip names from all configs
    all_chip_names = set()
    for _vendor_name, _models_dir, _config_path, config, _display_prefix in vendors:
        for _code, fam in config['families'].items():
            for _sub_name, sub_data in fam.get('subfamilies', {}).items():
                chips = sub_data.get('chips', []) if isinstance(sub_data, dict) else sub_data
                for chip in chips:
                    all_chip_names.add(str(chip))

    output_dir.mkdir(parents=True, exist_ok=True)

    # Build family trees from all vendors
    families = []
    for vendor_name, _models_dir, _config_path, config, display_prefix in vendors:
        families.extend(build_family_tree(config, vendor_name, display_prefix))

    # Check for duplicate family codes
    codes = [f['code'] for f in families]
    if len(codes) != len(set(codes)):
        dupes = [c for c in codes if codes.count(c) > 1]
        print(f'Error: duplicate family codes across vendors: {set(dupes)}', file=sys.stderr)
        sys.exit(1)

    # ── Process YAML files for all vendors ──────────────────────────────

    block_index = {}   # path -> metadata dict for index
    chip_index = {}    # path -> metadata dict for index
    search_tier2 = []  # register entries
    search_tier3 = []  # field entries
    block_json_count = 0
    summary_count = 0
    chip_json_count = 0
    file_count = 0

    blocks_out = output_dir / 'blocks'
    chips_out = output_dir / 'chips'

    for vendor_name, models_dir, _config_path, _config, _display_prefix in vendors:
        print(f'Scanning {vendor_name} YAML files from {models_dir}...', flush=True)

        for root, _dirs, files in os.walk(models_dir):
            for fname in sorted(files):
                if not fname.endswith('.yaml'):
                    continue

                fpath = Path(root) / fname
                rel = fpath.relative_to(models_dir)
                key = str(rel.with_suffix(''))

                file_count += 1
                if file_count % 100 == 0:
                    print(f'  {file_count} files processed...', flush=True)

                data = load_yaml(fpath)
                if data is None:
                    continue

                json_obj = yaml_to_json_obj(data)
                is_chip = fname[:-5] in all_chip_names

                if is_chip:
                    # ── Chip model ──────────────────────────────────
                    instances = data.get('instances', {})
                    interrupts = data.get('interrupts', {})
                    chip_index[key] = {
                        'name': str(data.get('name', fname[:-5])),
                        'source': str(data.get('source', '')),
                        'cpu': yaml_to_json_obj(data.get('cpu', {})),
                        'path': key,
                        'instanceCount': len(instances),
                        'interruptCount': len(interrupts),
                    }

                    # We'll resolve model paths after block_index is complete
                    # For now, store json_obj for chip conversion later
                    chip_index[key]['_json'] = json_obj
                    chip_index[key]['_rel'] = rel

                else:
                    # ── Block model ─────────────────────────────────
                    is_alias = '@derivedFrom' in data
                    if is_alias:
                        block_index[key] = {
                            'name': str(data.get('name', fname[:-5])),
                            'derivedFrom': str(data['@derivedFrom']),
                            'source': str(data.get('source', '')),
                            'path': key,
                            'registerCount': 0,
                            'isAlias': True,
                        }
                    else:
                        regs = data.get('registers', [])
                        params = data.get('params', [])
                        reg_count = sum(
                            len(r.get('registers', [])) if 'registers' in r else 1
                            for r in regs
                        )
                        block_index[key] = {
                            'name': str(data.get('name', fname[:-5])),
                            'description': str(data.get('description', '')),
                            'source': str(data.get('source', '')),
                            'path': key,
                            'registerCount': reg_count,
                            'paramCount': len(params),
                            'isAlias': False,
                        }

                        # Build search tier 2 + 3 from this block
                        block_name = str(data.get('name', fname[:-5]))
                        for reg in regs:
                            reg_name = str(reg.get('name', ''))
                            if reg.get('registers'):
                                # Cluster: index sub-registers
                                for sub in reg['registers']:
                                    sub_name = str(sub.get('name', ''))
                                    if sub_name:
                                        search_tier2.append({
                                            'type': 'register',
                                            'name': sub_name,
                                            'block': block_name,
                                            'blockPath': key,
                                            'cluster': reg_name,
                                        })
                                    for field in (sub.get('fields') or []):
                                        field_name = str(field.get('name', ''))
                                        if field_name:
                                            search_tier3.append({
                                                'type': 'field',
                                                'name': field_name,
                                                'register': sub_name,
                                                'block': block_name,
                                                'blockPath': key,
                                                'cluster': reg_name,
                                            })
                            else:
                                if reg_name:
                                    search_tier2.append({
                                        'type': 'register',
                                        'name': reg_name,
                                        'block': block_name,
                                        'blockPath': key,
                                    })
                                for field in (reg.get('fields') or []):
                                    field_name = str(field.get('name', ''))
                                    if field_name:
                                        search_tier3.append({
                                            'type': 'field',
                                            'name': field_name,
                                            'register': reg_name,
                                            'block': block_name,
                                            'blockPath': key,
                                        })

                    # Write block JSON
                    out_path = blocks_out / rel.with_suffix('.json')
                    out_path.parent.mkdir(parents=True, exist_ok=True)
                    json_str = json.dumps(json_obj, separators=(',', ':'))
                    out_path.write_text(json_str)
                    block_json_count += 1

                    # Summary for large blocks
                    if len(json_str) > SUMMARY_THRESHOLD and not is_alias:
                        summary = make_block_summary(json_obj)
                        summary_path = out_path.with_suffix('.summary.json')
                        summary_path.write_text(json.dumps(summary, separators=(',', ':')))
                        summary_count += 1

    print(f'  {file_count} total files, {block_json_count} blocks, {len(chip_index)} chips', flush=True)
    print(f'  {summary_count} summary files for large blocks', flush=True)

    # ── Write chip JSON (needs complete block_index for path resolution) ─
    print('Writing chip JSON files...', flush=True)
    for key, meta in chip_index.items():
        json_obj = meta.pop('_json')
        rel = meta.pop('_rel')
        parts = rel.parts
        family_code = parts[0] if len(parts) >= 2 else ''
        subfamily_name = parts[1] if len(parts) >= 3 else ''

        instances = json_obj.get('instances', {})
        for inst_name, inst in instances.items():
            model_name = inst.get('model', '')
            resolved = resolve_model_path(model_name, family_code, subfamily_name, block_index)
            if resolved:
                inst['modelPath'] = resolved
            addr = inst.get('baseAddress')
            if isinstance(addr, int):
                inst['baseAddressHex'] = f'0x{addr:08X}'

        out_path = chips_out / rel.with_suffix('.json')
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(json_obj, separators=(',', ':')))
        chip_json_count += 1

    print(f'  {chip_json_count} chip files written', flush=True)

    # ── Build index.json ────────────────────────────────────────────────
    print('Building index.json...', flush=True)

    shared_blocks = []
    family_blocks = {}
    subfamily_blocks = {}

    for path, meta in sorted(block_index.items()):
        parts = path.split('/')
        if len(parts) == 1:
            shared_blocks.append(meta)
        elif len(parts) == 2:
            family_blocks.setdefault(parts[0], []).append(meta)
        elif len(parts) == 3:
            subfamily_blocks.setdefault(f'{parts[0]}/{parts[1]}', []).append(meta)

    for fam in families:
        code = fam['code']
        fam['familyBlocks'] = family_blocks.get(code, [])
        for sub in fam['subfamilies']:
            sub['blocks'] = subfamily_blocks.get(f'{code}/{sub["name"]}', [])

    vendors_meta = []
    for vendor_name, _models_dir, _config_path, _config, display_prefix in vendors:
        vendor_families = [f for f in families if f['vendor'] == vendor_name]
        vendors_meta.append({
            'name': vendor_name,
            'displayPrefix': display_prefix,
            'familyCount': len(vendor_families),
            'chipCount': sum(f['chipCount'] for f in vendor_families),
        })

    index = {
        'vendors': vendors_meta,
        'families': families,
        'sharedBlocks': shared_blocks,
        'chipIndex': {p: {k: v for k, v in m.items()}
                      for p, m in sorted(chip_index.items())},
    }

    index_path = output_dir / 'index.json'
    index_path.write_text(json.dumps(index, indent=2))

    # ── Build search indices ────────────────────────────────────────────
    print('Building search indices...', flush=True)

    tier1 = []
    for path, meta in sorted(chip_index.items()):
        tier1.append({'type': 'chip', 'name': meta['name'], 'path': path})
    for path, meta in sorted(block_index.items()):
        tier1.append({
            'type': 'block', 'name': meta['name'],
            'path': path, 'description': meta.get('description', ''),
        })

    (output_dir / 'search-tier1.json').write_text(json.dumps(tier1, separators=(',', ':')))
    (output_dir / 'search-tier2.json').write_text(json.dumps(search_tier2, separators=(',', ':')))
    (output_dir / 'search-tier3.json').write_text(json.dumps(search_tier3, separators=(',', ':')))

    print(f'  Tier 1: {len(tier1)} entries (chips + blocks)', flush=True)
    print(f'  Tier 2: {len(search_tier2)} entries (registers)', flush=True)
    print(f'  Tier 3: {len(search_tier3)} entries (fields)', flush=True)

    # File sizes
    for name in ['index.json', 'search-tier1.json', 'search-tier2.json', 'search-tier3.json']:
        p = output_dir / name
        if p.exists():
            sz = p.stat().st_size
            if sz > 1_000_000:
                print(f'  {name}: {sz / 1_000_000:.1f} MB', flush=True)
            else:
                print(f'  {name}: {sz / 1_000:.0f} KB', flush=True)

    print('Done.', flush=True)


if __name__ == '__main__':
    main()
