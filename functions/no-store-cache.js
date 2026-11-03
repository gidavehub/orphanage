// The /api function's 'use cache' store: it keeps nothing, so every API call reads Firestore fresh.
//
// The pages and their cache live on Vercel. An admin's change (Settings › Giving, a cause, the
// Stripe keys) expires its tag there, in a Server Action, and never reaches this function. If the
// function kept its own copies, /api/donations would go on routing gifts with yesterday's settings.
// API calls are few and small, so reading fresh is cheap. functions/index.js points Next's
// cacheHandlers.default at this file.

module.exports = {
  async get() {
    return undefined;
  },
  async set(_cacheKey, pendingEntry) {
    // Let the entry finish, then let its stream go: nothing is stored.
    try {
      const entry = await pendingEntry;
      await entry?.value?.cancel?.();
    } catch {
      // An entry that failed to build is simply not kept.
    }
  },
  async refreshTags() {},
  async getExpiration() {
    return 0;
  },
  async updateTags() {},
};
