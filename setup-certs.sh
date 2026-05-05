#!/bin/bash
# generate a local cert for https://localhost so caddy has something to serve.
# run this once per machine. needs mkcert installed first.

set -e

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert is not installed. install it first (brew install mkcert) then re-run."
  exit 1
fi

mkcert -install

mkdir -p certs
cd certs
mkcert localhost

echo
echo "done. cert files are in ./certs/. now run: docker compose up --build"
