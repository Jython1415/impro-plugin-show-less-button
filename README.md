# Show Less Button — an Impro plugin

Adds a one-click **"Show less like this"** button to the action bar of posts in
custom feeds in the [Impro](https://impro.social) Bluesky client, so you don't
have to open the **…** menu to reach it. It sits just left of Bookmark, as the
same sad-face icon Impro's menu item uses, and it is styled with Impro's own
action-button classes. Clicking it does exactly what the menu item does: it
sends the feed a `requestLess` signal and Impro collapses the post behind its
feedback message.

The button only appears where Impro's own menu item would: on posts in feeds
whose generator accepts interactions (Discover and most custom feeds). It never
appears on Following, lists, profiles or threads.

## Install

In Impro: **Settings → Advanced → Install plugin from URL**, and paste:

```
https://github.com/Jython1415/impro-plugin-show-less-button
```

It asks for one permission, **feed feedback** (`feedFeedback`), which is what
lets it send "show less" on your behalf.

## How it works

The button renders into Impro's `post-action-bar:secondary-start` plugin slot
(added in [improsocial/impro#79](https://github.com/improsocial/impro/pull/79)).
The slot tells the plugin which post it is on and which feed the post is shown
in, so the button:

- appears on every post in a feed that accepts feedback, including image-only
  posts with no text;
- sends the signal to exactly the feed on screen;
- uses Impro's own action-button markup and sad-face icon.

Like Impro's own menu item, it only appears on feeds whose generator accepts
interactions (Discover and most custom feeds); never on Following, lists,
profiles or threads. It needs an Impro version that has the slot.

## Build

```
npm install      # pulls the SDK from the atpkgs registry (.npmrc)
npm run build    # esbuild src/main.js -> main.js
```

## Publishing a new version

Impro reads `manifest.json` from `main`, then loads `main.js` from the git tag
matching `manifest.version`. Bump `version` in `manifest.json` and
`package.json`, run `npm run build`, commit, then tag that commit with the bare
version (`0.1.1`) and push the tag.
