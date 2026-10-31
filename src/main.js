import { Plugin, VirtualEl, Notice, StyleSnippet } from "@impro.social/impro-plugin";

// Puts a one-click "Show less like this" button in the action bar of posts in
// feeds that accept feedback, so you don't have to open the "..." menu.
//
// Impro has no per-post slot in feeds, so this combines hooks that do exist:
//
// 1. A feed filter. The host awaits every feed filter on "feedLoaded", BEFORE
//    the page is rendered, passing (feedURI, feedItems). We hide nothing; we
//    only learn which feeds accept feedback (generator acceptsInteractions).
// 2. A rich-text transform on feed posts ("smallPost"). It adds one hidden
//    button per feed that accepts feedback, each tagged data-feed=<feed uri>.
// 3. Stylesheets. Impro tags every feed item with
//    data-feed-generator-uri=<the feed it is shown in>, and plugin CSS applies
//    to the whole page. One rule per feed shows only the button whose
//    data-feed matches the feed the post is displayed in, and styles.css lifts
//    it into the action bar.
//
// Why one button per feed: Impro caches a post's transformed text per post,
// not per feed, and doesn't tell the transform which feed it is rendering for.
// Rendering every feed's button and letting CSS pick means the button on
// screen always sends to the feed on screen, whichever feed the post was
// first drawn in.
//
// A post only carries buttons for feeds known when it was first drawn, so the
// list of feeds that accept feedback is saved with the plugin's synced data
// and loaded in onload(). Impro waits for plugins to finish loading before it
// renders any feed, so after the first session every known feed's button is
// present from the first post on.
//
// Posts with no text get no button: Impro renders no rich text for them, and
// the transform is the only per-post hook a plugin has.

const GENERATOR_URI = /^at:\/\/([^/"\\]+)\/app\.bsky\.feed\.generator\/([^/"\\]+)$/;

class ShowLessButtonPlugin extends Plugin {
  async onload() {
    /** feed uri -> Promise<boolean> (does the feed accept interactions?) */
    this.feedAccepts = new Map();
    /** feed uris known to accept feedback, in discovery order */
    this.acceptingFeeds = [];
    /** feed uri -> StyleSnippet that shows that feed's button */
    this.feedStyles = new Map();
    /** "<feed>|<post>" pairs already sent a requestLess */
    this.sent = new Set();

    try {
      const saved = (await this.loadData()) || {};
      for (const feedUri of Array.isArray(saved.acceptingFeeds) ? saved.acceptingFeeds : []) {
        this.addAcceptingFeed(feedUri, { persist: false });
      }
    } catch (error) {
      console.error("[show-less-button] could not load saved feeds", error);
    }

    this.addFeedFilter(async (feedURI) => {
      const accepts = await this.acceptsFeedback(feedURI);
      if (accepts) this.addAcceptingFeed(feedURI);
      else if (accepts === false && this.feedAccepts.has(feedURI)) this.removeAcceptingFeed(feedURI);
      return {}; // never hide anything
    });

    this.registerRichTextTransform((tokens, context) => {
      if (context?.surface !== "smallPost" || !context.uri) return tokens;
      if (this.acceptingFeeds.length === 0) return tokens;
      return [...tokens, { type: "block", node: this.buildButtons(context.uri) }];
    });
  }

  addAcceptingFeed(feedUri, { persist = true } = {}) {
    if (!GENERATOR_URI.test(String(feedUri || ""))) return;
    if (this.acceptingFeeds.includes(feedUri)) return;
    this.acceptingFeeds.push(feedUri);
    // Show this feed's button only inside this feed's items. The URI was
    // validated by GENERATOR_URI, so it holds no quote or backslash.
    const item = `.feed-item[data-feed-generator-uri="${feedUri}"]`;
    const button = `.show-less-button[data-feed="${feedUri}"]`;
    this.feedStyles.set(
      feedUri,
      new StyleSnippet(
        `${item} .small-post ${button} { display: flex; }\n` +
          `${item} .small-post:has(${button}) .post-actions-secondary { padding-left: 34px; }\n`,
      ),
    );
    if (persist) this.persistFeeds();
  }

  // A saved feed that has since stopped accepting feedback: hide its buttons.
  removeAcceptingFeed(feedUri) {
    if (!this.acceptingFeeds.includes(feedUri)) return;
    this.acceptingFeeds = this.acceptingFeeds.filter((f) => f !== feedUri);
    this.feedStyles.get(feedUri)?.remove();
    this.feedStyles.delete(feedUri);
    this.persistFeeds();
  }

  persistFeeds() {
    this.saveData({ acceptingFeeds: this.acceptingFeeds }).catch((error) =>
      console.error("[show-less-button] could not save feeds", error),
    );
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

  buildButtons(postUri) {
    const wrap = new VirtualEl("div");
    wrap.addClass("show-less-button-row");
    for (const feedUri of this.acceptingFeeds) this.buildButton(wrap, postUri, feedUri);
    return wrap;
  }

  // Reuses Impro's own action-button classes and the exact icon Impro's
  // "Show less like this" menu item uses, so it matches the bar's buttons.
  buildButton(wrap, postUri, feedUri) {
    const key = `${feedUri}|${postUri}`;
    const sent = this.sent.has(key);
    const button = wrap.createEl("button", {
      cls: "post-action-button show-less-button",
      attr: {
        type: "button",
        title: sent ? "Sent" : "Show less like this",
        "aria-label": "Show less like this",
        "data-feed": feedUri,
      },
    });
    const icon = button.createEl("div", { cls: "post-action-icon" });
    const svg = icon.createEl("svg", {
      attr: { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none" },
    });
    const stroke = {
      stroke: "currentColor",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "stroke-width": "2",
    };
    svg.createEl("circle", { attr: { cx: "12", cy: "12", r: "9", ...stroke } });
    svg.createEl("circle", { attr: { cx: "9", cy: "10", r: "1.25", fill: "currentColor" } });
    svg.createEl("circle", { attr: { cx: "15", cy: "10", r: "1.25", fill: "currentColor" } });
    svg.createEl("path", { attr: { d: "M9 16q3-3 6 0", ...stroke } });
    if (sent) {
      button.setAttr("disabled", "");
      return;
    }
    // A <button> inside the post's container-link is treated as a nested
    // control, so clicking it does not open the post.
    button.onClick(async () => {
      if (this.sent.has(key)) return;
      this.sent.add(key);
      try {
        // Same as the menu item: sends requestLess to the feed and collapses
        // the post behind the host's feedback message.
        await this.app.showLessLikeThis(postUri, feedUri);
      } catch (error) {
        this.sent.delete(key);
        console.error("[show-less-button] showLessLikeThis failed", error);
        new Notice("Couldn't send \u201cShow less like this\u201d. Try again.");
      }
    });
  }
}

ShowLessButtonPlugin.register();
