# 5th Transplant MindaNOW registration site

This repository holds the event registration page for the 5th Transplant MindaNOW.
The event date is November 4, 2026.
The venue is the Mahogany Room, JICA Building (JICA OPD Building), Southern Philippines Medical Center, Davao City.

## Folders

- `site/`: The Google Apps Script web app (`Index.html`, `Code.gs`, `appsscript.json`) and the web video files in `site/media/`.
- `videos/`: The HyperFrames source for each video (`hero-loop`, `program-loop`, `register-loop`, `title-sting`).
- `preview/`: A local copy of the page that loads the video files from `site/media/`.

## Where the page runs

The public address is `transplantmindanow.redirectme.net`, served by GitHub Pages from `index.html` in the repository root.
`index.html` is a copy of `site/Index.html`.
Edit `site/Index.html`, then copy it to `index.html`.
On the public address the form posts to the Apps Script web app, and `doPost` in `site/Code.gs` saves the registration.
The same file also runs inside the Apps Script web app at its `/exec` address.

## Video files

Google Apps Script cannot host video files.
On the public address the page loads them from `site/media/`.
Inside Apps Script the page loads them from this repository through jsDelivr.
The page shows gradient scenes and a CSS title animation when a video does not load.

## Update the live page

1. Edit `site/Index.html` and copy it to `index.html`.
2. Commit and push. GitHub Pages publishes the public address.
3. Copy `site/Index.html` and `site/Code.gs` into the Apps Script project.
4. Select **Deploy > Manage deployments**.
5. Edit the existing deployment and select **New version**.
6. Click **Deploy**.
7. Register once with a test email and check the sheet.
