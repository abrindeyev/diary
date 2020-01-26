#!/usr/bin/env bash

if [[ -z $GITHUB_REF ]]; then
  branch="$(git rev-parse --abbrev-ref HEAD)"
else
  branch="${GITHUB_REF#refs/heads/}"
fi
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
appDir="${1?Specify app directory}"

echo "Getting MongoDB Stitch CLI"
if [[ -f "$cli" ]]; then
  echo "The stitch-cli: $cli"
else
  echo "Failed to get path to stitch-cli, aborting!"
  exit 1
fi

echo "Logging in to MongoDB Stitch"
if [[ "$prefix" == "MASTER" ]]; then
  STITCH_API_KEY="${STITCH_API_KEY_PROD?Can not find prod Stitch token}"
  STITCH_USER="${STITCH_USER_PROD?Can not find prod Stitch user}"
else
  STITCH_API_KEY="${STITCH_API_KEY_NONPROD?Can not find non-prod Stitch token}"
  STITCH_USER="${STITCH_USER_NONPROD?Can not find non-prod Stitch user}"
fi
"$cli" login --api-key "$STITCH_API_KEY" --username "$STITCH_USER"

echo "Updating Stitch secrets"
googleSecretName="$(kv googleOauthStitchSecretName)"
googleSecretID="$("$cli" secrets list --app-id="$appId" | grep -E -v '^(ID|No secrets found for this app)' | grep "$googleSecretName"'$' | cut -f1 -d' ')"
if [[ "$googleSecretID" != "" ]]; then
  echo "Updating the $googleSecretName secret using the ID=$googleSecretID"
  "$cli" secrets update --app-id="$appId" --id="$googleSecretID" --value="$(kv googleOauthStitchSecretValue)"
else
  echo "Creating a new $googleSecretName secret"
  "$cli" secrets add --app-id="$appId" --name="$googleSecretName" --value="$(kv googleOauthStitchSecretValue)"
fi

# Step 1: replace the existing app
cd "$appDir" && {
  echo -n "STEP 1: App build to deploy: ";
  tail -c38 hosting/files/index.html;
  "$cli" import --strategy=replace-by-name --include-hosting --reset-cdn-cache --app-id="$STITCH_APP_ID" --yes || { echo "Import failed"; exit 1; }
}

# Step 2: export the app to get newly generated IDs for the services
cd .. && "$cli" export --app-id=$appId --include-hosting || { echo "Export from MongoDB Stitch failed"; exit 1; }

# Step 3: enable custom user data
cd "$appName" || { echo "Can't change directory to $appName, it seems that export failed"; exit 1; }
echo -n "STEP 3: App build after export: "
tail -c38 hosting/files/index.html
atlasClusterId="$(jq -r '.id' services/mongodb-atlas/config.json)"
change_json_file '.custom_user_data_config.enabled=true | .custom_user_data_config.mongo_service_id="'$atlasClusterId'" | .custom_user_data_config.database_name="'$dbName'" | .custom_user_data_config.collection_name="bv_users_metadata" | .custom_user_data_config.user_id_field="owner_id"' ./stitch.json

# Step 4: merge the deployment to the existing app
echo "Merging the changes to the existing app"
echo -n "STEP 4: App build before merging: "
tail -c38 hosting/files/index.html
"$cli" import --strategy=merge --include-hosting --app-id="$STITCH_APP_ID" --yes --reset-cdn-cache || { echo "Merge failed"; exit 1; }

# Step 5: dependencies generation and upload
pushd "functions" && cp ../../stitch/functions/package.json . && npm install || { echo "NPM install failed"; exit 1; }
[[ -d node_modules ]] || { echo "NPM failed to create a node_modules directory"; exit 1; }
tar -czf ./node_modules.tar.gz node_modules/ || { echo "tar failed to compress the node_modules directory"; exit 1; }
rm -fr ./node_modules ./package.json ./package-lock.json
popd
echo -n "STEP 5: App build before merging: "
tail -c38 hosting/files/index.html
"$cli" import --strategy=merge --include-hosting --app-id="$STITCH_APP_ID" --yes --reset-cdn-cache --include-dependencies # || { echo "Dependency upload failed"; exit 1; }

echo "Deployment completed"
