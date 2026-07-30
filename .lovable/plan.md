# Push IMUSIC project code to `Ayush1708/imusic`

## Current state
- Verified via `git remote -v` and `git status`: the project currently has two remotes, `origin` (Lovable internal storage) and `secondary` (S3 backup), and no GitHub remote.
- The working tree is clean.
- The current branch is `edit/edt-f7d36485-cd37-4aca-8667-2f16483483ef`.

## Important constraint
The Lovable editor cannot run state-changing git commands such as `git push` or `git remote set-url`. Those commands must be executed in the user's local terminal where GitHub credentials are available, or by using Lovable's built-in GitHub sync UI.

## Proposed approach

### Step 1 — Confirm the GitHub repo exists
Verify that `https://github.com/Ayush1708/imusic` is already created and set to **Public**. If it is missing, the plan is blocked until it is created.

### Step 2 — Prepare the local branch
Rename the current branch to `main` so the pushed branch matches GitHub conventions:

```bash
git branch -M main
```

### Step 3 — Add the GitHub remote
Add a remote named `github` pointing to the target repo. Using a distinct name (`github`) avoids overwriting the existing `origin` remote that Lovable uses internally.

```bash
git remote add github https://github.com/Ayush1708/imusic.git
```

If a remote named `github` already exists, update it instead:

```bash
git remote set-url github https://github.com/Ayush1708/imusic.git
```

### Step 4 — Push the code
Push the current `main` branch to GitHub and set it as the upstream tracking branch.

```bash
git push -u github main
```

If GitHub prompts for credentials, authenticate with the GitHub CLI or a personal access token.

### Step 5 — Verify the push
Confirm the remote and branch state:

```bash
git remote -v
git branch -vv
```

Then open `https://github.com/Ayush1708/imusic` and confirm the project files are visible.

## Alternative: Lovable GitHub sync
If you prefer two-way sync instead of a one-time manual push, the in-editor option is: **Plus (+) menu → GitHub → Connect project**. This will create the repo automatically and keep Lovable and GitHub in sync. Choose this option if you want ongoing bidirectional sync.

## What will not change in the codebase
No project files need to be edited for this task. The push only adds a remote and uploads the existing commit history to GitHub.