#!/bin/bash
# Push an EAS Update with a version tag baked into the bundle.
# Usage: ./scripts/push-update.sh "your message here"

set -e

MESSAGE="${1:?Usage: push-update.sh \"message\"}"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M")
VERSION_TAG="$TIMESTAMP — $MESSAGE"

# Write version into the app bundle
cat > mobile/lib/build-version.ts << EOF
export const BUILD_VERSION = '$VERSION_TAG';
EOF

echo "Version: $VERSION_TAG"

cd mobile
npx eas update --branch preview --message "$MESSAGE"
