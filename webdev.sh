#!/usr/bin/env bash

myDir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
certFile="$myDir/local/localhost.pem"
[[ -f "$certFile" ]] || { echo "Local development configuration is missing: $certFile isn't a file"; exit 1; }

branch="$( git rev-parse --abbrev-ref HEAD )"
echo "Starting DEV environment"
npm start
echo "DEV environment stopped, rolling back the configuration changes"
git checkout -- $(cat ./local/.trace)
