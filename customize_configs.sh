#!/usr/bin/env bash

[[ -d "./local" ]] || mkdir "./local" || { echo "Failed miserably to mkdir ./local"; exit 1; }
trace_log="./local/.trace"
if [[ -z $GITHUB_REF ]]; then
  branch="$(git rev-parse --abbrev-ref HEAD)"
else
  branch="${GITHUB_REF#refs/heads/}"
fi
prefix="${branch^^}" # uppercase

echo "Configs will be customized for the $branch branch"

function kv() {
  local query=".$1"
  local source="${prefix}_ENV"
  local file_source="./local/${source}.json"

  if [[ $source ]]; then
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
    echo "$source_file" >> "$trace_log"
    mv "$source_file" "${source_file}.bak" && mv "$tmp_file" "$source_file"
  else
    exit 1
  fi
}

function change_text_file() {
  local regex="$1"
  local file="$2"

  echo "$file" >> "$trace_log"
  if [[ "$OSTYPE" == "linux-gnu" ]]; then
    sed -i "$regex" "$file"
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    perl -pi -e "$regex" "$file"
  else
    echo "Don't know how to deal with $OSTYPE OS, giving up!" >&2
    exit 1
  fi
}

dbName="$(kv mongoDatabase)"
appId="$(kv appId)"

change_text_file "s/GITHUB_STITCH_APP_ID/$appId/" src/js/app.js

for file in src/js/app.js $(find stitch/functions -type f -name source.js); do
  change_text_file "s/GITHUB_MONGO_DATABASE_NAME/$dbName/" "$file"
done

# MongoDB database / collection / rules fix
for file in $(find stitch/services/mongodb-atlas/rules -type f -name \*.json); do
  change_json_file '.database="'$dbName'"' "$file"
done

change_json_file '.app_id="'$appId'" | .name="'$(kv appName)'" | .security.allowed_request_origins='$(kv allowedRequestOrigins)' | .hosting.custom_domain="'$(kv customDomain)'" | .hosting.app_default_domain="'$(kv appDefaultDomain)'"' ./stitch/stitch.json

# Google OAuth secret name adjustment
change_json_file '.secret_config.clientSecret="'$(kv googleOauthStitchSecretName)'" | .config.clientId="'$(kv googleOauthStitchUsername)'" | .redirect_uris='$(kv OAuthRedirectURIs) stitch/auth_providers/oauth2-google.json

echo "Config customization completed"
