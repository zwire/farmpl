#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
SRC_DIR="$ROOT_DIR/api"
OUT_DIR="$ROOT_DIR/api_dist"

echo "[build-lambda] output: $OUT_DIR"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

# Install runtime deps
if command -v uv >/dev/null 2>&1; then
  echo "[build-lambda] using uv to install deps"
  uv pip install -r "$SRC_DIR/requirements-lambda.txt" --target "$OUT_DIR"
else
  echo "[build-lambda] using pip to install deps"
  python -m pip install -r "$SRC_DIR/requirements-lambda.txt" -t "$OUT_DIR"
fi

# Copy application code
if command -v rsync >/dev/null 2>&1; then
  rsync -a --exclude '.pytest_cache' \
    --exclude '.ruff_cache' \
    --exclude '.venv' \
    --exclude 'tests' \
    --exclude 'docs' \
    --exclude 'demo' \
    --exclude 'demo_*.py' \
    --exclude '*__pycache__*' \
    --exclude '*.pyc' \
    "$SRC_DIR/" "$OUT_DIR/"
else
  cp -a "$SRC_DIR/." "$OUT_DIR/"
  rm -rf "$OUT_DIR/.pytest_cache" "$OUT_DIR/.ruff_cache" "$OUT_DIR/.venv" \
         "$OUT_DIR/tests" "$OUT_DIR/docs" "$OUT_DIR/demo"
  find "$OUT_DIR" -name "__pycache__" -type d -prune -exec rm -rf {} + || true
  find "$OUT_DIR" -name "*.pyc" -type f -delete || true
  find "$OUT_DIR" -maxdepth 1 -name 'demo_*.py' -type f -delete || true
fi

echo "[build-lambda] done"
