#!/bin/sh
# (Re-)generate all deploy keys on https://github.com/cockpit-project/cockpit-podman/settings/environments

set -eux

ORG=cockpit-project
THIS=cockpit-podman

[ -e bots ] || make bots

# for weblate-sync-pot.yml: push to https://github.com/cockpit-project/cockpit-podman-weblate/settings/keys
bots/github-upload-secrets --receiver "${ORG}/${THIS}" --env "${THIS}-weblate" --ssh-keygen DEPLOY_KEY --deploy-to "${ORG}/${THIS}-weblate"
