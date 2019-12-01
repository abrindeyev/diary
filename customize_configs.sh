#!/usr/bin/env bash

branch="${GITHUB_REF#refs/heads/}"
prefix="${branch^^}" # uppercase

echo "Configs will be customized for the $branch branch"

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

dbName="$(kv mongoDatabase)"
appId="$(kv appId)"
customDomainEnabled="$(kv customDomainEnabled)"

sed -i "s/GITHUB_STITCH_APP_ID/$appId/" src/js/app.js

for file in src/js/app.js $(find stitch/functions -type f -name source.js); do
  sed -i "s/GITHUB_MONGO_DATABASE_NAME/$dbName/" "$file"
done

# MongoDB database / collection / rules fix
for file in $(find stitch/services/mongodb-atlas/rules -type f -name \*.json); do
  change_json_file '.database="'$dbName'"' "$file"
done

change_json_file '.app_id="'$appId'" | .name="'$(kv appName)'" | .security.allowed_request_origins='$(kv allowedRequestOrigins)' | .hosting.app_default_domain="'$(kv appDefaultDomain)'"' ./stitch/stitch.json

if [[ $customDomainEnabled == "true" ]]; then
  change_json_file '.hosting.custom_domain="'$(kv customDomain)'"' ./stitch/stitch.json
fi

# Google OAuth secret name adjustment
change_json_file '.secret_config.clientSecret="'$(kv googleOauthStitchSecretName)'" | .config.clientId="'$(kv googleOauthStitchUsername)'" | .redirect_uris='$(kv OAuthRedirectURIs) stitch/auth_providers/oauth2-google.json

echo "Config customization completed"
