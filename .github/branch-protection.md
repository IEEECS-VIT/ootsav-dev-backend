# Branch Protection Setup

To prevent merging into `dev` or `main` with build errors, you need to set up branch protection rules in GitHub.

## Steps to Configure Branch Protection:

1. Go to your GitHub repository
2. Navigate to **Settings** → **Branches**
3. Click **Add rule** or **Add branch protection rule**
4. Configure the following settings:

### For both `dev` and `main` branches:

**Branch name pattern:**
- For dev: `dev`
- For main: `main`

**Protection rules to enable:**

✅ **Require a pull request before merging**
- Check "Require a pull request before merging"
- Check "Require approvals" (recommend 1-2 approvals)
- Check "Dismiss stale PR approvals when new commits are pushed"

✅ **Require status checks to pass before merging**
- Check "Require status checks to pass before merging"
- Search for and select: `build-check` (this is the job name from our workflow)

✅ **Additional settings (recommended):**
- Check "Require branches to be up to date before merging"
- Check "Require conversation resolution before merging"
- Check "Require signed commits" (optional, for extra security)

### What this accomplishes:

1. **Prevents direct pushes** to `dev` and `main` branches
2. **Requires pull requests** for all changes
3. **Blocks merging** if the `build-check` job fails
4. **Ensures code review** before merging
5. **Keeps branches up to date** with the latest changes

### The workflow will check:

- ✅ TypeScript compilation (`npx tsc --noEmit`)
- ✅ Project build (`npm run build`)
- ✅ Prisma schema validation (`npx prisma validate`)
- ✅ Prisma client generation (`npx prisma generate`)

If any of these checks fail, the pull request cannot be merged until the issues are fixed. 