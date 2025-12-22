#!/bin/bash
set -e

# Build script for WASM module
# This script ensures Rust and wasm-pack are available before building

echo "Checking Rust installation..."
if ! command -v rustc &> /dev/null; then
    echo "Rust not found. Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

echo "Checking wasm-pack installation..."
if ! command -v wasm-pack &> /dev/null; then
    echo "wasm-pack not found. Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

echo "Building WASM module..."
cd wasm
wasm-pack build --target web --out-dir pkg --release
cd ..

echo "WASM build complete!"
