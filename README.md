# AniShelf Web

A local anime collection and watch history manager for Windows 11. Built with HTML, CSS, and vanilla JavaScript for Microsoft Edge / Google Chrome, it supports separate season management, custom lists, a viewing calendar, and an adjustable frosted-glass interface.

This project takes inspiration from the product concept of [samuelhe52/AniShelf](https://github.com/samuelhe52/AniShelf). It is an independent web implementation and is not affiliated with the original project's official application.

## Features

- Collection management, search, sorting, and status filters; poster and list views, plus a horizontal gallery available only in My Library.
- Separate progress, ratings, notes, favorite status, and viewing links for each season; support for splitting seasons, merging series, and tracking rewatch counts.
- Schedule anime on multiple days each week; the viewing calendar counts only actual recorded viewing and does not count scheduled entries as watched.
- Custom lists, drag-and-drop ordering, and random selection, with a configurable exclusion list for random selection.
- Search TMDb to import titles, posters, synopses, people, and episode information.
- Optional Discover: MAL's overall rankings, new releases, and personalized recommendations for authorized accounts, supplemented with information from TMDb.
- Browser storage or a connected local library folder; JSON import and export, and folder backups.
- Chinese and English interfaces; light, dark, and system themes; customizable avatar, username, background, and UI accent color.
- Five independent groups of frosted-glass settings for the main page, sidebar, controls, dialogs, and detail view, with an option to restore defaults.

This is a viewing management tool. It does not provide video content or a built-in player. The watch button opens an external website supplied by the user.

## Quick Start

### Windows Users

1. Install a supported LTS version of [Node.js](https://nodejs.org/) (version 22 or later is recommended). The checks for this package were performed with Node.js 26; not all LTS versions have been individually verified.
2. Download the Windows ZIP provided by the maintainer in GitHub Releases and extract all of its contents.
3. Double-click `start-AniShelf.cmd`.
4. The launcher checks for or starts the local service, then opens `http://127.0.0.1:43871/` once the service is ready.

Keep all files from the extracted package. There is no need to run `npm install`; the launcher and service use only built-in Node.js modules.

To run from source:

```powershell
node outputs/serve.cjs
```

Then open **http://127.0.0.1:43871/** in your browser. A service started from a terminal can be stopped with `Ctrl+C`. The one-click launcher runs the service in the background; closing the web page does not stop it automatically. Use `restart-AniShelf.cmd` to explicitly restart the service for the current directory.

The fixed address keeps browser storage, folder permissions, and OAuth callbacks consistent. Do not switch casually between ports, `localhost`, and `127.0.0.1`, or use a `file:///` URL opened by double-clicking the HTML file as your regular entry point. If another program is using the port, the launcher displays a message; it does not terminate unknown processes or automatically switch ports.

### Edge App Window

You can visit the same address in Edge and use the browser's “Install this site as an app” feature. Keep the same browser profile and address. The installed app window still depends on the local Node service and does not replace the launcher.

The public package does not include the developer's own `edge-app.json` or Windows shortcuts, so it opens a regular browser window by default. To have the launcher open your installed Edge app directly, configure it on your own computer; do not use someone else's app ID.

## API Settings

### TMDb

Enter your own API Key or API Read Access Token under **Settings → Service Connections → TMDb**. You can test the connection before adding titles online.

By default, credentials are used only for the current page session. If you choose to remember them, they are saved in the current browser. TMDb credentials are not included in regular library backups. Online queries and remote image loading require an internet connection; saved information and watch history can be used offline. Whether images are available offline depends on whether they have been cached in the local library.

### MAL / Discover (Optional)

Enter your own MAL Client ID under **Settings → Service Connections → Discover**, then enable Discover.

- Overall rankings and new releases use the Client ID; personalized recommendations require you to authorize your account on the MAL website.
- Register a public/native client that supports PKCE and does not require a Client Secret.
- The callback URL must be:

```text
http://127.0.0.1:43871/.anishelf/mal/callback
```

MAL requests are forwarded through restricted routes in the local service; static hosting such as GitHub Pages cannot run this functionality on its own. Discover does not upload your AniShelf collection, ratings, notes, or watch history to MAL. Account tokens are held only in the local service's memory, so you need to reconnect after restarting the service.

Discover browsing results are kept only in the current page's memory. An entry is added to your library and its backups only after you explicitly click Add to My Library.

## Data Storage and Privacy

- Without a connected folder, data depends on the current browser and origin URL. Clearing site data, switching browsers, or changing the address may make the original copy inaccessible.
- Connect a dedicated local folder under **Settings → Data and Backups**; you must grant read and write permissions through your browser. Whether permissions persist depends on browser policies.
- Folder-based data is organized into indexes, anime data, details, images, preferences, and other content. When saving, unchanged documents are reused and the index is published last; the five most recent backup indexes are retained automatically.
- Credentials, MAL connection identifiers, personal collections, downloaded posters, and local libraries should not be committed to GitHub.
- Requests for remote information access TMDb, MAL, and related image servers; this is not a fully offline application.

Export a complete JSON backup before major updates. After updating, confirm that your library is connected and saving has finished. Keeping program files and your personal library in separate directories is recommended.

## Source Structure

```text
README.md
.gitignore
tools/
  package-github.cjs          # Allowlist-based packaging: source directory + Windows runtime package
work/anishelf/
  dist/                      # Maintainable source code (not build output)
    index.html
    *.js
    *.css
  package.cjs                # Bundle into a complete single-file HTML page
  check*.cjs                 # Regression checks and simulated tests
outputs/
  AniShelf.html              # Complete web page
  start-AniShelf.cmd
  launch-AniShelf.cjs
  serve.cjs
  mal-service.cjs
  restart-AniShelf.cmd
  restart-AniShelf.cjs
```

The existing directory names are retained to preserve compatibility with packaging and test paths. The stack is **HTML + CSS + vanilla JavaScript + a local Node.js service**, with no React, Vite, Python, or WebGL runtime dependencies.

### Build the HTML

Run from the repository root:

```powershell
Push-Location work/anishelf
node package.cjs
Pop-Location
```

After modifying `work/anishelf/dist/`, rebuild and refresh the page. Do not edit only the generated `outputs/AniShelf.html`, as the next build will overwrite those changes.

### Regression Checks

Run the following commands from `work/anishelf`:

```powershell
node check-data-safety.cjs
node check-personalization.cjs
node check-user-profile.cjs
node check-dom-ids.cjs
node check-external-import.cjs
node check-folder-flows.cjs
node check-discover.cjs
node check-mal-service.cjs
node check-launcher.cjs
```

Some early `check*.cjs` files are comparison scripts for historical versions and local backups. These backups are not included in the public package, so running all historical checks as a single test suite is not recommended. Simulated API/DOM tests do not replace verification of actual account authorization, browser compatibility, or real folder usage.

## Packaging and Publishing on GitHub

Run from the repository root:

```powershell
node tools/package-github.cjs
```

The script creates a clean, timestamped directory and two ZIP files under `artifacts/`:

- `AniShelf-GitHub-*.zip`: source code, tests, README, and runtime files, for preparing the repository.
- `AniShelf-Windows-*.zip`: files needed to run the application and the README, suitable for attaching to a GitHub Release for users to download.

The script first rebuilds the HTML from source in a temporary output directory, without modifying the HTML, service, or library currently in use. It does not initialize Git, upload files, create a repository, or automatically publish a release.

For your first upload, use the `repository/` directory from the clean package as the Git repository root. Check the file list, then commit it to your own new repository; do not upload the entire `outputs/` directory from your everyday development environment.

Create an empty repository on the GitHub website (do not automatically add a README yet), then open a terminal in the `repository/` directory and run the commands below. Replace the remote URL with your own repository URL:

```powershell
git init
git add README.md .gitignore tools work outputs
# If you have added LICENSE / NOTICE, include them with git add as well.
git commit -m "Initial AniShelf Web release"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

You can use the commands above after installing Git, or use GitHub Desktop. To publish, create a version tag through GitHub Releases and attach the Windows ZIP. Consider `v0.1.0` for the first public release; the maintainer determines the version number.

Include release notes, the Windows ZIP, and its SHA-256 checksum in the GitHub Release. The runtime package does not include Node.js itself, personal Edge app configuration, icons, shortcuts, the image library, historical backups, or credentials. Before updating to a new directory, back up your data and stop the service in the old directory; running two directories at the same time triggers port/directory checks.

The packaging script automatically includes any existing root-level `LICENSE`, `LICENSE.md`, `LICENSE.txt`, `NOTICE`, `NOTICE.md`, and `THIRD_PARTY_NOTICES.md` files. Repackage after adding the required licensing files.

## Known Limitations and Verification Scope

- The primary target is Edge / Chrome on Windows 11; other platforms and browsers have not been fully verified.
- The background service does not yet have a system tray interface for quitting; closing the app window does not stop the service.
- Users need to test actual TMDb credentials, MAL account OAuth, and the Edge installation process on different computers themselves. The relevant logic has simulated tests, but this does not mean all online workflows have been verified.
- Frosted-glass effects depend on the browser's background blur capabilities. They fall back to solid colors when high contrast or reduced transparency is enabled, and the corresponding animations are disabled when reduced motion is enabled.
- Local storage does not mean encrypted storage; protect your computer and library directory yourself.

## Sources, Licensing, and Attribution

Product inspiration: [samuelhe52/AniShelf](https://github.com/samuelhe52/AniShelf), whose upstream repository lists Apache-2.0. This does not automatically grant the same license to this web implementation. The publisher of this repository still needs to confirm the license for this implementation and whether any upstream code notices must be retained. Before publishing, add the applicable LICENSE; if you reuse upstream code or assets, retain the corresponding licenses and attribution.

Rights to anime images, titles, synopses, and other content belong to their respective rights holders. Custom icons and screenshots are not distributed with the public package; before adding them, confirm that they may be publicly distributed.

This product uses the TMDB API but is not endorsed or certified by TMDB.

MyAnimeList is a third-party service. This project is not an official MAL application.

**Please note that this project is done by codex ,and is maintained by me.For personal reason ,I may NOT update it often. If you encountered bugs ,feel free to issue me .And welcome any edit for non-commercial use.I am now working to integrate myanimelist .**



