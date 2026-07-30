#!/usr/bin/env bash
# Create the IMUSIC Android release keystore ONCE, then print the four values
# to paste into GitHub -> repo Settings -> Secrets and variables -> Actions.
#
# Usage:  bash scripts/generate-keystore.sh
# Needs:  Java's `keytool` (comes with any JDK) and `base64`.
set -euo pipefail

KEYSTORE_FILE="${KEYSTORE_FILE:-imusic-release.keystore}"
KEY_ALIAS="${KEY_ALIAS:-imusic}"

if [ -f "$KEYSTORE_FILE" ]; then
  echo "!! $KEYSTORE_FILE already exists. Refusing to overwrite it."
  echo "   Reusing the same key is what lets updates install over old builds."
  exit 1
fi

read -r -s -p "Choose a keystore password (min 6 chars): " STORE_PASS; echo
read -r -s -p "Repeat it: " STORE_PASS2; echo
if [ "$STORE_PASS" != "$STORE_PASS2" ]; then echo "Passwords do not match."; exit 1; fi

keytool -genkeypair -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass "$STORE_PASS" -keypass "$STORE_PASS" \
  -dname "CN=IMUSIC, OU=IMUSIC, O=IMUSIC, L=, ST=, C=IN"

echo
echo "=================================================================="
echo " Add these as GitHub Actions repository secrets:"
echo "=================================================================="
echo
echo "ANDROID_KEY_ALIAS         = $KEY_ALIAS"
echo "ANDROID_KEYSTORE_PASSWORD = (the password you just typed)"
echo "ANDROID_KEY_PASSWORD      = (the same password)"
echo
echo "ANDROID_KEYSTORE_BASE64   = the single line below"
echo "------------------------------------------------------------------"
base64 < "$KEYSTORE_FILE" | tr -d '\n'
echo
echo "------------------------------------------------------------------"
echo
echo "SHA-256 certificate fingerprint (for your records):"
keytool -list -v -keystore "$KEYSTORE_FILE" -alias "$KEY_ALIAS" -storepass "$STORE_PASS" \
  | grep -i "SHA256:" || true
echo
echo "!! BACK UP $KEYSTORE_FILE AND THE PASSWORD SOMEWHERE SAFE."
echo "   If you lose them, future APKs cannot update installs of this one."
echo "   The file is gitignored on purpose — never commit it."
