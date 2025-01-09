!#/bin/bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | bash -s -- -y
source $HOME/.cargo/env
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli
