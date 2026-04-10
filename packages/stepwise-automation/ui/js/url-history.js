/* global UrlHistory */
/* eslint-disable no-unused-vars */

/**
 * Pure helper functions for managing the Target URL history array.
 * All functions are pure — no side effects, no DOM access, no mutation.
 * Each function returns a new value rather than modifying its arguments.
 * Exposed as a global — no imports, no modules.
 */
const UrlHistory = {
  /**
   * Add a URL to the front of the history (MRU order).
   * If the URL is empty or whitespace-only, returns a shallow copy unchanged.
   * If the URL already exists, moves it to the front without duplicating.
   *
   * @param {string[]} history - Current history array (not mutated).
   * @param {string} url - URL to add.
   * @returns {string[]} New history array.
   */
  add(history, url) {
    if (typeof url !== 'string' || url.trim() === '') {
      return [...history];
    }
    return [url, ...history.filter((entry) => entry !== url)];
  },

  /**
   * Remove a URL from the history.
   *
   * @param {string[]} history - Current history array (not mutated).
   * @param {string} url - URL to remove.
   * @returns {string[]} New history array with the URL filtered out.
   */
  remove(history, url) {
    return history.filter((entry) => entry !== url);
  },

  /**
   * Migrate settings by seeding targetUrlHistory from targetUrl when
   * history is absent or empty. Returns a new settings object rather
   * than mutating the original.
   *
   * @param {Object} settings - Settings object (not mutated).
   * @returns {{ settings: Object, migrated: boolean }} New settings and whether migration occurred.
   */
  migrateSettings(settings) {
    const hasHistory = Array.isArray(settings.targetUrlHistory) &&
                       settings.targetUrlHistory.length > 0;
    const hasTargetUrl = typeof settings.targetUrl === 'string' &&
                         settings.targetUrl.trim() !== '';

    if (hasHistory || !hasTargetUrl) {
      return { settings, migrated: false };
    }

    return {
      settings: { ...settings, targetUrlHistory: [settings.targetUrl] },
      migrated: true,
    };
  },
};
