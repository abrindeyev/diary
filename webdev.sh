#!/usr/bin/env bash

myDir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
certFile="$myDir/local/localhost.pem"
[[ -f "$certFile" ]] || { echo "Local development configuration is missing: $certFile isn't a file"; exit 1; }
source "$myDir/local/env.sh"

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
cli="$(pwd)/node_modules/.bin/stitch-cli"

echo "Starting DEV environment"
./customize_configs.sh
stitch-cli logout
echo "Logging in to MongoDB Stitch"
"$cli" login --api-key "$STITCH_API_KEY" --username "$STITCH_USER"

# Step 1: replace the existing app
cd stitch && "$cli" import --strategy=replace --app-id="$appId" --yes

# Step 2: export the app to get newly generated IDs for the services
cd ../local
[[ -d "${appName?}" ]] && rm -fr "${appName?}"
"$cli" export --app-id=$appId || { echo "Export from MongoDB Stitch failed"; exit 1; }

# Step 3: enable custom user data
cd "$appName" || { echo "Can't change directory to $appName, it seems that export failed"; exit 1; }
atlasClusterId="$(jq -r '.id' services/mongodb-atlas/config.json)"
change_json_file '.custom_user_data_config.enabled=true | .custom_user_data_config.mongo_service_id="'$atlasClusterId'" | .custom_user_data_config.database_name="'$dbName'" | .custom_user_data_config.collection_name="bv_users_metadata" | .custom_user_data_config.user_id_field="owner_id"' ./stitch.json

# Step 4: merge the deployment to the existing app
echo "Merging the changes to the existing app"
"$cli" import --strategy=merge --app-id="$appId" --yes
cd ../..
npm start
echo "DEV environment stopped, rolling back the configuration changes"
./cleanup.sh
