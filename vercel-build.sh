#!/bin/bash
set -e

# Vercel build script that ensures Rust/wasm-pack are available
# This script is called by Vercel's buildCommand

echo "=== Vercel WASM Build Script ==="

# Ensure Rust is in PATH
export PATH="$HOME/.cargo/bin:$PATH"

# Install Rust if not available
if ! command -v rustc &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
    export PATH="$HOME/.cargo/bin:$PATH"
    source "$HOME/.cargo/env" 2>/dev/null || true
fi

# Install wasm-pack if not available
if ! command -v wasm-pack &> /dev/null; then
    echo "Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
    export PATH="$HOME/.cargo/bin:$PATH"
fi

# Verify installations
echo "Rust version: $(rustc --version)"
echo "wasm-pack version: $(wasm-pack --version)"

# Build WASM module (release mode for production)
echo "Building WASM module..."
cd wasm
wasm-pack build --target web --out-dir pkg --release
cd ..

# Verify WASM artifacts
if [ ! -f "wasm/pkg/knucklebones_ai_bg.wasm" ]; then
    echo "ERROR: WASM build failed - knucklebones_ai_bg.wasm not found"
    exit 1
fi

# Build Next.js app
echo "Building Next.js app..."
next build
