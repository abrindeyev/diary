#!/usr/bin/env bash

myDir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
certFile="$myDir/local/localhost.pem"
stitchAppLastChangeFile="$myDir/local/stitchAppChange.timestamp"
[[ -f "$certFile" ]] || { echo "Local development configuration is missing: $certFile isn't a file"; exit 1; }
source "$myDir/local/env.sh"

[[ -f "$stitchAppLastChangeFile" ]] || touch "$stitchAppLastChangeFile" || { echo "Can't touch $stitchAppLastChangeFile file"; exit 1; }

if [[ -z $GITHUB_REF ]]; then
  branch="$(git rev-parse --abbrev-ref HEAD)"
else
  branch="${GITHUB_REF#refs/heads/}"
fi
prefix="${branch^^}" # uppercase

function kv() {
  local query=".$1"
  local source="${prefix}_ENV"
  local file_source="./local/${source}.json"

  if [[ "${!source}" != "" ]]; then
    echo "${!source}" | jq -rc "$query"
  elif [[ -r "$file_source" ]]; then
    jq -rc "$query" "$file_source"
  else
    echo "Failed to find the configuration for the $prefix branch" >&2
    exit 1
  fi
}

function change_json_file() {
  local expr="$1"
  local source_file="$2"
  local tmp_file="${source_file}.tmp"
  if jq "$expr" "$source_file" > "$tmp_file"; then
    mv "$source_file" "${source_file}.bak" && mv "$tmp_file" "$source_file"
  else
    exit 1
  fi
}

function change_text_file() {
  local regex="$1"
  local file="$2"

  if [[ "$OSTYPE" == "linux-gnu" ]]; then
    sed -i "$regex" "$file"
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    perl -pi -e "$regex" "$file"
  else
    echo "Don't know how to deal with $OSTYPE OS, giving up!" >&2
    exit 1
  fi
}

appId="$(kv appId)"
appName="$(kv appName)"
dbName="$(kv mongoDatabase)"
cli="$myDir/node_modules/.bin/stitch-cli"
[[ -e "$cli" ]] || { echo "Can't fine stitch-cli. Have you run npm install already?"; exit 1; }

stitch_temp_dir="$( mktemp -d stitch-app.XXXXXXXX )"

echo "Starting DEV environment"

echo "Customizing configs for local environment in the $stitch_temp_dir directory:"
./customize_configs.sh "$stitch_temp_dir"

stitchAppNumberOfUpdatedFiles="$(find "$myDir/stitch" -type f -newer "$stitchAppLastChangeFile" | wc -l)"
if [[ "$stitchAppNumberOfUpdatedFiles" -gt 0 ]]; then

  "$cli" logout
  echo "Logging in to MongoDB Stitch"
  "$cli" login --api-key "$STITCH_API_KEY" --username "$STITCH_USER"

  # Step 1: replace the existing app
  echo "Replacing the existing app in MongoDB Stitch:"
  pushd "$stitch_temp_dir" && "$cli" import --strategy=replace --app-id="$appId" --yes || { echo "Replace failed"; exit 1; }

  # Step 2: export the app to get newly generated IDs for the services
  popd
  pushd ./local
  [[ -d "${appName?}" ]] && rm -fr "${appName?}"
  "$cli" export --app-id=$appId || { echo "Export from MongoDB Stitch failed"; exit 1; }

  # Step 3: enable custom user data
  pushd "$appName" || { echo "Can't change directory to $appName, it seems that export failed"; exit 1; }
  atlasClusterId="$(jq -r '.id' services/mongodb-atlas/config.json)"
  change_json_file '.custom_user_data_config.enabled=true | .custom_user_data_config.mongo_service_id="'$atlasClusterId'" | .custom_user_data_config.database_name="'$dbName'" | .custom_user_data_config.collection_name="bv_users_metadata" | .custom_user_data_config.user_id_field="owner_id"' ./stitch.json

  # Step 4: merge the deployment to the existing app
  echo "Merging the changes to the existing app"
  "$cli" import --strategy=merge --app-id="$appId" --yes || { echo "Merge failed"; exit 1; }

  popd
  popd
else
  echo "Not deploying the Stitch app - no new changes detected"
fi

function trap_ctrlc() {
  echo "DEV environment stopped, rolling back the configuration changes"
  ./cleanup.sh "$stitch_temp_dir"
}

trap "trap_ctrlc" 2
npm start
