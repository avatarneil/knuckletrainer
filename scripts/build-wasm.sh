#!/bin/bash
set -euo pipefail

# Build script for WASM module.
# Ensures Rustup, the wasm32 target, and wasm-pack are available before building.

RELEASE=false

for arg in "$@"; do
  case "$arg" in
    --release)
      RELEASE=true
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--release]" >&2
      exit 2
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CARGO_BIN_DIR="${CARGO_HOME:-$HOME/.cargo}/bin"
export PATH="$CARGO_BIN_DIR:$PATH"

install_rustup() {
  echo "Rustup not found. Installing Rust toolchain..."
  export RUSTUP_INIT_SKIP_PATH_CHECK=yes
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --default-toolchain stable --profile minimal --no-modify-path
  export PATH="$CARGO_BIN_DIR:$PATH"
  source "${CARGO_HOME:-$HOME/.cargo}/env" 2>/dev/null || true
}

echo "Checking Rust installation..."
if ! command -v rustup >/dev/null 2>&1; then
  install_rustup
fi

if ! rustup show active-toolchain >/dev/null 2>&1; then
  echo "No active Rust toolchain found. Installing stable..."
  rustup toolchain install stable --profile minimal
  rustup default stable
fi

if ! command -v rustc >/dev/null 2>&1; then
  echo "ERROR: rustc is not available after installing Rustup." >&2
  exit 1
fi

echo "Installing wasm32 target..."
rustup target add wasm32-unknown-unknown

echo "Checking wasm-pack installation..."
if ! command -v wasm-pack >/dev/null 2>&1; then
  echo "wasm-pack not found. Installing wasm-pack..."
  curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
  export PATH="$CARGO_BIN_DIR:$PATH"
fi

echo "Rust version: $(rustc --version)"
echo "wasm-pack version: $(wasm-pack --version)"

BUILD_ARGS=(--target web --out-dir pkg)
if [ "$RELEASE" = true ]; then
  BUILD_ARGS+=(--release)
fi

echo "Building WASM module..."
cd "$ROOT_DIR/wasm"
wasm-pack build "${BUILD_ARGS[@]}"

echo "WASM build complete!"
