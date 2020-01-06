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
stitch_dir="${1?Specify temp directory for Stitch app files}"
[[ -e "$stitch_dir" ]] && rm -fr "$stitch_dir" && mkdir "$stitch_dir"
echo "MongoDB Stitch temp app directory: $stitch_dir"
cp -a ./stitch/ "$stitch_dir" || { echo "Can't copy stitch app files to the $stitch_dir directory"; exit 1; }

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
    if ! fgrep "$source_file" "$trace_log" >/dev/null; then
      echo "$source_file" >> "$trace_log"
    fi
    mv "$source_file" "${source_file}.bak" && mv "$tmp_file" "$source_file"
  else
    exit 1
  fi
}

function change_text_file() {
  local regex="$1"
  local file="$2"

  if ! fgrep "$file" "$trace_log" >/dev/null; then
    echo "$file" >> "$trace_log"
  fi
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
hostingEnabled="$(kv hostingEnabled)"
customDomainEnabled="$(kv customDomainEnabled)"

change_text_file "s/GITHUB_STITCH_APP_ID/$appId/" src/js/app.js

for file in src/js/app.js $(find "${stitch_dir}/functions" -type f -name source.js); do
  change_text_file "s/GITHUB_MONGO_DATABASE_NAME/$dbName/" "$file"
done

# MongoDB database / collection / rules fix
for file in $(find "$stitch_dir/services/mongodb-atlas/rules" -type f -name \*.json); do
  change_json_file '.database="'$dbName'"' "$file"
done

change_json_file '.value='$(kv token2roles) "$stitch_dir/values/token2roles.json"

if [[ "$hostingEnabled" == "true" ]]; then
  change_json_file '.app_id="'$appId'" | .name="'$(kv appName)'" | .security.allowed_request_origins='$(kv allowedRequestOrigins)' | .hosting.app_default_domain="'$(kv appDefaultDomain)'"' "${stitch_dir}/stitch.json"
  if [[ $customDomainEnabled == "true" ]]; then
    change_json_file '.hosting.custom_domain="'$(kv customDomain)'"' "${stitch_dir}/stitch.json"
  fi
else
  change_json_file '. |= del(.hosting)' "${stitch_dir}/stitch.json"
fi

# OAuth adjustments
change_json_file '.secret_config.clientSecret="'$(kv googleOauthStitchSecretName)'" | .config.clientId="'$(kv googleOauthStitchUsername)'" | .redirect_uris='$(kv OAuthRedirectURIs) "$stitch_dir/auth_providers/oauth2-google.json"
# change_json_file '.config.clientId="'$(kv appleClientId)'" | .redirect_uris='$(kv OAuthRedirectURIs) "$stitch_dir/auth_providers/oauth2-apple.json"

echo "Config customization completed, temp Stitch app directory: $stitch_dir"
exit 0
