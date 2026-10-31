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

## How it works, and its limits

Impro's plugin API has no per-post slot in feeds, so the plugin combines two
hooks that do exist:

1. A **feed filter**. Impro runs feed filters on every feed page before it
   renders, passing the feed URI and its posts. The plugin hides nothing; it
   records which feed each post came from, and looks up (once per feed) whether
   the feed generator sets `acceptsInteractions`.
2. A **rich-text transform** on feed posts (`smallPost`). For a post known to
   come from such a feed, it adds the button to the post text. Plugin
   stylesheets apply to the whole page, so `styles.css` then lifts it out of the
   text and pins it into the action bar.

Because of that:

- Posts with **no text** (image- or link-only) get no button; Impro renders no
  rich text for them.
- The placement uses two numbers measured from Impro's layout (the bar's 4px
  inset and the 98px Bookmark/Share/More group). If Impro changes that layout,
  the button will sit in the wrong spot until `styles.css` is updated.
- A feed's button only exists on posts first drawn after that feed loaded.
  The plugin renders one hidden button per feed that accepts feedback, and a
  per-feed CSS rule shows the one matching the feed the post is displayed in
  (Impro tags each feed item with its feed). So the button on screen always
  sends to the feed on screen. But Impro caches each post's text per post, so
  a post first drawn before, say, Popular With Friends had loaded has no
  Popular With Friends button until the page is reloaded.
- It only covers feeds whose generator says it accepts feedback, so feeds that
  never set `acceptsInteractions` get no button, exactly as Impro's menu.

A host-side slot in the post action bar would remove the first three.

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
