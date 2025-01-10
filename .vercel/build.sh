!#/usr/bin/bash
source $HOME/.cargo/env
cd flying-dragon
cargo build --target wasm32-unknown-unknown --release
wasm-bindgen target/wasm32-unknown-unknown/release/flying-dragon.wasm --out-dir ../src/lib/wasm/dragon --no-typescript --target web
cd -
cd rubik
cargo build --target wasm32-unknown-unknown --release
wasm-bindgen target/wasm32-unknown-unknown/release/rubik.wasm --out-dir ../src/lib/wasm/rubik --no-typescript --target web
cd -
bun run build
