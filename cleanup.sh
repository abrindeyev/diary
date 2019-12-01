#!/usr/bin/env bash

if [[ -f ./local/.trace ]]; then
  git checkout -- $(cat ./local/.trace)
  rm -f ./local/.trace
fi
find . -name \*.bak -delete
