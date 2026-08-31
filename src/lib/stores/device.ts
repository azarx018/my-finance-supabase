const DEVICE_ID_KEY = 'myfinance_device_id';

/**
 * A random id generated once per browser/install and persisted in
 * localStorage — NOT tied to the signed-in user (that's `user_id`,
 * already on every row). This answers "which physical device/browser
 * made this edit", which `user_id` can't: the same person can be
 * signed in on their phone AND their laptop, and this is what lets a
 * future UI meaningfully say "this was last changed from your other
 * device" instead of just repeating their own name back at them.
 *
 * Deliberately NOT cleared by wipeLocalDatabase() on logout — the
 * device's identity doesn't change just because someone signed out of
 * it, and keeping it stable makes "which device" comparisons still work
 * correctly for the next person who signs in on this same browser.
 */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    // Storage unavailable (private mode, quota, SSR) — fall back to a
    // per-session value. Conflict metadata degrades gracefully to
    // "unknown device" rather than the app breaking.
    return 'unknown-device';
  }
}
