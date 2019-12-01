#!/usr/bin/env bash

branch="${GITHUB_REF#refs/heads/}"
prefix="${branch^^}" # uppercase

function kv() {
  local source="${prefix}_ENV"
  if [[ $source ]]; then
    echo "${!source}" | jq -rc ".$1"
  else
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

appId="$(kv appId)"
appName="$(kv appName)"
dbName="$(kv mongoDatabase)"
cli="$(pwd)/node_modules/.bin/stitch-cli"

echo "Getting MongoDB Stitch CLI"
if [[ -f "$cli" ]]; then
  echo "The stitch-cli: $cli"
else
  echo "Failed to get path to stitch-cli, aborting!"
  exit 1
fi

echo "Logging in to MongoDB Stitch"
"$cli" login --api-key "$STITCH_API_KEY" --username "$STITCH_USER"

# Step 1: replace the existing app
cd stitch && "$cli" import --strategy=replace --include-hosting --reset-cdn-cache --app-id="$STITCH_APP_ID" --yes

# Step 2: export the app to get newly generated IDs for the services
cd .. && "$cli" export --app-id=$appId --include-hosting || { echo "Export from MongoDB Stitch failed"; exit 1; }

# Step 3: enable custom user data
cd "$appName" || { echo "Can't change directory to $appName, it seems that export failed"; exit 1; }
atlasClusterId="$(jq -r '.id' services/mongodb-atlas/config.json)"
change_json_file '.custom_user_data_config.enabled=true | .custom_user_data_config.mongo_service_id="'$atlasClusterId'" | .custom_user_data_config.database_name="'$dbName'" | .custom_user_data_config.collection_name="bv_users_metadata" | .custom_user_data_config.user_id_field="owner_id"' ./stitch.json

# Step 4: merge the deployment to the existing app
echo "Merging the changes to the existing app"
"$cli" import --strategy=merge --include-hosting --app-id="$STITCH_APP_ID" --yes

echo "Deployment completed"
