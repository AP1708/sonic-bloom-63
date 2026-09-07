# Publishing the IMUSIC Android APK

Follow these once. After that, every new version is a single button press.

## 1. Put the code on GitHub

In the Lovable editor, open the **+** menu next to the chat box → **GitHub** →
**Connect project**, then create the repository. The repo must be
`Ayush1708/imusic` (that is the repository the `/download` page reads).

## 2. Create your signing key (once, on your own computer)

```bash
bash scripts/generate-keystore.sh
```

It asks for a password and prints four values. **Keep the
`imusic-release.keystore` file forever** — it is what allows future versions to
install on top of the old one. If you lose it, users must uninstall before
updating.

## 3. Add the four secrets on GitHub

Repository → **Settings** → **Secrets and variables** → **Actions** → **New
repository secret**, one for each:

| Secret name | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | the long single line the script printed |
| `ANDROID_KEYSTORE_PASSWORD` | the password you chose |
| `ANDROID_KEY_ALIAS` | `imusic` |
| `ANDROID_KEY_PASSWORD` | the same password |

## 4. Run the release

Repository → **Actions** → **Android release APK** → **Run workflow** →
version `1.0.0` → **Run**.

It takes roughly ten minutes. When it finishes, a GitHub Release appears with
the signed APKs and their SHA-256 fingerprints.

## 5. Install it

Open `/download` on your Android phone. It picks the right build for your
device automatically, verifies the fingerprint after downloading, and then
shows the install steps.

## Later versions

Only step 4 again, with a higher version number.

## Desktop builds

The **Desktop release** workflow does the same for Windows, macOS and Linux and
needs no secrets. Run it from the Actions tab; the results show up on
`/desktop`.
