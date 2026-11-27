# GitHub upload package for Broken Brain

This bundle contains the site, current question packs/media, local music files confirmed by the project owner for public hosting, and the realtime relay source/config.

## Upload to GitHub Pages

1. Download and extract the ZIP on your computer.
2. Upload the **contents** of the extracted folder to the **root** of your existing GitHub repository (do not upload the ZIP as a single file). Keep `.nojekyll` at the repository root.
3. Commit and push to the branch configured in **Settings → Pages** (normally `main`, folder `/ (root)`).
4. Wait for the Pages deployment to finish, then hard-refresh the site.

If using Git from the repository folder, copy/overwrite the extracted files, then run:

```bash
git add .
git commit -m "Update Broken Brain game and packs"
git push
```

## Multiplayer

GitHub Pages serves only the static site; it does not run the WebSocket relay. This package includes `server/` and `render.yaml` for the existing Render backend deployment. Ensure the Render service is connected to this repository and healthy at `/health`. The front end currently targets the URL configured in `js/config.js`.

## Audio

The local track files are under `packs/media/audio/tracks/user-local/` and are referenced by `packs/friends-party.json`. They are included so the GitHub-hosted version can load them. Before making the repository public, the owner is responsible for ensuring that the rights/permissions cover public hosting and playback of both the underlying compositions and the recordings.
