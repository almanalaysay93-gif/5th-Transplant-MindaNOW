# 5th Transplant MindaNOW registration site

This repository holds the event registration page for the 5th Transplant MindaNOW.
The event date is November 5, 2026.
The venue is the Mahogany Room, JICA Building (JICA OPD Building), Southern Philippines Medical Center, Davao City.

## Folders

- `site/`: The Google Apps Script web app (`Index.html`, `Code.gs`, `appsscript.json`) and the web video files in `site/media/`.
- `videos/`: The HyperFrames source for each video (`hero-loop`, `program-loop`, `register-loop`, `title-sting`).
- `preview/`: A local copy of the page that loads the video files from `site/media/`.

## Video files

Google Apps Script cannot host video files.
The page loads them from this repository through jsDelivr.
The `MEDIA_BASE` constant in `site/Index.html` holds that address.
The page shows gradient scenes and a CSS title animation when a video does not load.

## Update the live page

1. Copy `site/Index.html` and `site/Code.gs` into the Apps Script project.
2. Select **Deploy > Manage deployments**.
3. Edit the existing deployment and select **New version**.
4. Click **Deploy**.
5. Open the `/exec` address and check the page.
