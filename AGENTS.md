# JJ-Lens Agent Guidelines

This repository relies on automated GitHub Actions to build and draft releases. Agents must not manually generate `.vsix` binaries or place them into the repository. 

Follow these instructions when preparing a new release of `jj-lens`:

## Release Workflow (Using jj)

1. **Verify Changes**: Ensure all code changes are tested, working, and committed to the main branch stream.
2. **Bump Version**: Update the `"version"` field inside `package.json` to the new version number (e.g., `"0.0.6"`).
3. **Commit Version Bump**: Commit the `package.json` change.
   ```bash
   jj commit -m "chore: bump version to 0.0.6"
   ```
4. **Tag the Release**: Create a new tag pointing to the commit you just made. The tag **must** start with `v` (e.g., `v0.0.6`) for the GitHub Action to recognize it.
   ```bash
   jj workspace root # Ensure you are at the project root
   jj tag create "v0.0.6" -r @- 
   ```
   *(Note: `@-` points to the commit you just created. If you didn't commit and are just tagging the working copy parent, use `@-`.)*
5. **Push Tag to GitHub**: Push the newly created tag to the remote repository. 
   ```bash
   jj git push --tags
   ```
   *(Alternatively, if the user has a custom alias like `jj tug`, use that to sync with the remote).*

Once the tag is pushed to GitHub, the `.github/workflows/release.yml` action will automatically spin up, build the `jj-lens-X.X.X.vsix` file from the source code at that tag, and draft a new GitHub release with the binary attached.
