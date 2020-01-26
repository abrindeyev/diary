#!/usr/bin/env bash

function trap_ctrlc() {
  echo "Ignoring Ctrl+C during cleanup..."
  return 0
}

trap "trap_ctrlc" 2

temp_dir="${1?Specify temp deployment dir}"
[[ -d "$temp_dir" ]] && rm -fr -- "$temp_dir"
if [[ -f ./local/.trace ]]; then
  git checkout -- $(cat ./local/.trace | fgrep -v "$temp_dir")
  rm -f ./local/.trace
fi
find . -name \*.bak -delete
