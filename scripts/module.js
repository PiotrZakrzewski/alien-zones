/**
 * This module is compatible with Foundry VTT v12-13
 *
 * Key v13 Development Notes:
 * - Use ApplicationV2 for new UI components (old Application class deprecated in v16)
 * - Avoid jQuery - use vanilla JavaScript DOM manipulation
 * - CSS styles automatically use CSS Cascade Layers
 * - All core modules are now ESM (foundry.mjs entrypoint)
 *
 * Resources:
 * - ApplicationV2: https://foundryvtt.wiki/en/development/api/applicationv2
 * - API Migration: https://foundryvtt.com/article/migration/
 */

Hooks.once('init', async function() {
  // Module initialization - runs before Foundry is fully ready
  console.log('Alien Zones | Initializing module');
});

Hooks.once('ready', async function() {
  // Module ready - runs when Foundry is fully loaded
  console.log('Alien Zones | Module ready');
});
