import { Plugin, VirtualEl, Notice } from "@impro.social/impro-plugin";

// Puts a one-click "Show less like this" button in the post action bar, just
// left of Bookmark, on posts in feeds that accept feedback, so you don't have
// to open the "..." menu.
//
// It renders into Impro's `post-action-bar:secondary-start` plugin slot
// (improsocial/impro#79), whose context carries the post (`uri`) and the feed
// it is shown in (`feedUri`, empty outside a feed). The button reuses Impro's
// own action-button markup and the icon its "Show less like this" menu item
// uses, so it looks and behaves like the bar's other buttons, and it works on
// every post in the bar, including posts with no text.

const SLOT = "post-action-bar:secondary-start";

class ShowLessButtonPlugin extends Plugin {
  onload() {
    /** feed uri -> Promise<boolean> (does the feed accept interactions?) */
    this.feedAccepts = new Map();
    /** "<feed>|<post>" pairs already sent a requestLess */
    this.sent = new Set();

    this.registerSlot(
      SLOT,
      async (context) => {
        const uri = context?.uri;
        const feedUri = context?.feedUri;
        if (!uri || !feedUri) return null; // not in a feed
        if (!(await this.acceptsFeedback(feedUri))) return null;
        return this.buildButton(uri, feedUri);
      },
      { cacheKey: ["uri", "feedUri"] },
    );
  }

  // Same rule as Impro's own menu item: only feeds whose generator accepts
  // interactions get "Show less like this".
  acceptsFeedback(feedUri) {
    let pending = this.feedAccepts.get(feedUri);
    if (!pending) {
      pending = this.app.data
        .getFeedGenerator(feedUri)
        .then((view) => view?.acceptsInteractions === true)
        .catch((error) => {
          // Don't cache a failed lookup; the next render retries it.
          this.feedAccepts.delete(feedUri);
          console.error("[show-less-button] feed generator lookup failed", error);
          return false;
        });
      this.feedAccepts.set(feedUri, pending);
    }
    return pending;
  }

  buildButton(postUri, feedUri) {
    const key = `${feedUri}|${postUri}`;
    const sent = this.sent.has(key);
    const action = new VirtualEl("div");
    action.addClass("post-action");
    action.addClass("show-less-action");
    const button = action.createEl("button", {
      cls: "post-action-button show-less-button",
      attr: {
        type: "button",
        title: sent ? "Sent" : "Show less like this",
        "aria-label": "Show less like this",
      },
    });
    button
      .createEl("div", { cls: "post-action-icon" })
      .createEl("plugin-icon", { attr: { icon: "emoji-sad-line" } });
    if (sent) {
      button.setAttr("disabled", "");
      return action;
    }
    // A <button> inside the post's container-link is treated as a nested
    // control, so clicking it does not open the post.
    button.onClick(async () => {
      if (this.sent.has(key)) return;
      this.sent.add(key);
      try {
        // Same as the menu item: sends requestLess to the feed and collapses
        // the post behind Impro's feedback message.
        await this.app.showLessLikeThis(postUri, feedUri);
      } catch (error) {
        this.sent.delete(key);
        console.error("[show-less-button] showLessLikeThis failed", error);
        new Notice("Couldn't send “Show less like this”. Try again.");
      }
      this.refreshSlot(SLOT, { keys: [{ uri: postUri, feedUri }] });
    });
    return action;
  }
}

ShowLessButtonPlugin.register();
