#!/usr/bin/env bash

temp_dir="${1?Specify temp deployment dir}"
[[ -d "$temp_dir" ]] && rm -fr -- "$temp_dir"
if [[ -f ./local/.trace ]]; then
  git checkout -- $(cat ./local/.trace | fgrep -v "$temp_dir")
  rm -f ./local/.trace
fi
find . -name \*.bak -delete
