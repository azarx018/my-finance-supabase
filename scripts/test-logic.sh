#!/usr/bin/env bash
# Menjalankan tes logika keuangan murni (tanpa browser/Svelte). Butuh Node >= 22.6.
# Modul di src/lib/data disalin ke folder sementara dengan ekstensi import ".ts" supaya bisa dijalankan Node langsung.
set -euo pipefail
cd "$(dirname "$0")/.."
T=$(mktemp -d); mkdir -p "$T/data"
for f in src/lib/data/*.ts; do sed -E "s#from '\./([a-zA-Z]+)'#from './\1.ts'#g" "$f" > "$T/data/$(basename "$f")"; done
cp tests/logic/*.test.ts "$T/"
for t in "$T"/*.test.ts; do (cd "$T" && node --experimental-strip-types --no-warnings "$(basename "$t")"); done
rm -rf "$T"
