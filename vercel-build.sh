#!/bin/bash
set -e

# Vercel build script that ensures Rust/wasm-pack are available
# This script is called by Vercel's buildCommand

echo "=== Vercel WASM Build Script ==="

# Build WASM module (release mode for production)
./scripts/build-wasm.sh --release

# Verify WASM artifacts
if [ ! -f "wasm/pkg/knucklebones_ai_bg.wasm" ]; then
    echo "ERROR: WASM build failed - knucklebones_ai_bg.wasm not found"
    exit 1
fi

# Build Next.js app (explicitly use webpack for WASM support)
echo "Building Next.js app..."
next build --webpack
