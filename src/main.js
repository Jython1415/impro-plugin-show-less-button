import { Plugin, VirtualEl, Notice } from "@impro.social/impro-plugin";

// Puts a one-click "Show less like this" button on posts in custom feeds, so
// you don't have to open the "..." menu to reach it.
//
// Impro has no per-post slot in feeds, so this is built from two hooks that do
// exist:
//
// 1. A feed filter. The host awaits every feed filter on "feedLoaded", BEFORE
//    the page is written to the store and rendered (dataLayer/requests.js), and
//    hands it (feedURI, feedItems). We never hide anything; we only record
//    which feed each post arrived through.
// 2. A rich-text transform on the "smallPost" surface (feed posts). It appends
//    a block button to the post's text when that post is known to have come
//    from a feed that accepts feedback.
//
// Consequences of that design, all deliberate:
// - Posts with no text get no button (the host renders no rich text for them).
// - The host caches transform output per (post uri, surface), not per feed.
//   A post first rendered outside a feed keeps its no-button result, and a post
//   already rendered in one feed keeps that feed's button everywhere, including
//   in a feed that doesn't accept feedback. The first feed a post is seen in
//   wins, so a click always goes to the feed the button was built for.
// - Like the host's own menu item, the button only appears on feeds whose
//   generator record sets acceptsInteractions (Discover, most custom feeds);
//   never on Following or lists.

const GENERATOR_URI = /^at:\/\/([^/]+)\/app\.bsky\.feed\.generator\/([^/]+)$/;

class ShowLessButtonPlugin extends Plugin {
  onload() {
    /** post uri -> feed uri it was served through */
    this.postFeed = new Map();
    /** feed uri -> Promise<boolean> (does the feed accept interactions?) */
    this.feedAccepts = new Map();
    /** post uris already sent a requestLess, so a re-render shows "sent" */
    this.sent = new Set();

    this.addFeedFilter(async (feedURI, feedItems) => {
      if (await this.acceptsFeedback(feedURI)) {
        for (const item of feedItems || []) {
          // A reply is shown with its parent (and sometimes the thread root)
          // above it. Impro's own menu offers "Show less" on those too.
          for (const post of [item?.post, item?.reply?.parent, item?.reply?.root]) {
            const uri = post?.uri;
            if (uri && !this.postFeed.has(uri)) this.postFeed.set(uri, feedURI);
          }
        }
      }
      return {}; // never hide anything
    });

    this.registerRichTextTransform((tokens, context) => {
      if (context?.surface !== "smallPost") return tokens;
      const feedUri = this.postFeed.get(context.uri);
      if (!feedUri) return tokens;
      return [
        ...tokens,
        { type: "block", node: this.buildButton(context.uri, feedUri) },
      ];
    });
  }

  acceptsFeedback(feedURI) {
    const match = GENERATOR_URI.exec(String(feedURI || ""));
    if (!match) return Promise.resolve(false); // Following, lists, etc.
    let pending = this.feedAccepts.get(feedURI);
    if (!pending) {
      pending = this.app.data
        .getRecord(match[1], "app.bsky.feed.generator", match[2])
        .then((record) => record?.value?.acceptsInteractions === true)
        .catch((error) => {
          // Don't cache a failed lookup; the next page load retries it.
          this.feedAccepts.delete(feedURI);
          console.error("[show-less-button] feed generator lookup failed", error);
          return false;
        });
      this.feedAccepts.set(feedURI, pending);
    }
    return pending;
  }

  buildButton(postUri, feedUri) {
    const wrap = new VirtualEl("div");
    wrap.addClass("show-less-button-row");
    const button = wrap.createEl("button", {
      cls: "show-less-button",
      text: this.sent.has(postUri) ? "Sent" : "Show less like this",
      attr: { type: "button", title: "Show less like this" },
    });
    if (this.sent.has(postUri)) {
      button.setAttr("disabled", "");
      return wrap;
    }
    // A <button> inside the post's container-link is treated as a nested
    // control, so clicking it does not open the post.
    button.onClick(async () => {
      if (this.sent.has(postUri)) return;
      this.sent.add(postUri);
      try {
        // Same as the menu item: sends requestLess to the feed and collapses
        // the post behind the host's feedback message.
        await this.app.showLessLikeThis(postUri, feedUri);
      } catch (error) {
        this.sent.delete(postUri);
        console.error("[show-less-button] showLessLikeThis failed", error);
        new Notice("Couldn't send “Show less like this”. Try again.");
      }
    });
    return wrap;
  }
}

ShowLessButtonPlugin.register();
