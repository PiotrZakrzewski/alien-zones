/**
 * Alien Zones Module
 * Zone-based gameplay support for the Alien RPG system in Foundry VTT v13
 *
 * This module uses Foundry's Region API to detect when player-controlled tokens
 * enter designated Alien Zones and posts chat notifications.
 *
 * Key v13 Development Notes:
 * - Uses Region Events API for zone entry detection
 * - ES6 modules with no jQuery dependencies
 * - Follows v13 best practices (ApplicationV2, CSS Layers, etc.)
 *
 * Resources:
 * - Scene Regions: https://foundryvtt.com/article/scene-regions/
 * - Region API: https://foundryvtt.com/api/classes/foundry.canvas.placeables.Region.html
 * - API Migration: https://foundryvtt.com/article/migration/
 */

import { postZoneEntryMessage } from './lib/lib.js';

Hooks.once('init', async function() {
  // Module initialization - runs before Foundry is fully ready
  console.log('Alien Zones | Initializing module');
});

Hooks.once('ready', async function() {
  // Module ready - runs when Foundry is fully loaded
  console.log('Alien Zones | Module ready');
});

/**
 * Detect when tokens enter zones
 *
 * Uses the _regions property which Foundry maintains automatically.
 * We use preUpdateToken to capture the OLD regions before the update.
 */

// Store token regions before updates
const tokenRegionsBeforeUpdate = new Map();

Hooks.on("preUpdateToken", (tokenDocument, change, options, userId) => {
  // Store the current regions before the update
  if (change.x !== undefined || change.y !== undefined) {
    tokenRegionsBeforeUpdate.set(tokenDocument.id, new Set(tokenDocument._regions || []));
  }
});

Hooks.on("updateToken", async (tokenDocument, change, options, userId) => {
  // Only process if position changed
  if (change.x === undefined && change.y === undefined) return;

  // Only process player-controlled tokens
  if (!tokenDocument.hasPlayerOwner) return;

  // Get old regions (before the update)
  const oldRegionIds = tokenRegionsBeforeUpdate.get(tokenDocument.id) || new Set();

  // Get new regions (after the update) - the document should now be updated
  const newRegionIds = new Set(tokenDocument._regions || []);

  console.log("Alien Zones | Region check:", {
    token: tokenDocument.name,
    oldRegions: Array.from(oldRegionIds),
    newRegions: Array.from(newRegionIds)
  });

  // Find regions that are NEW (entered)
  for (const regionId of newRegionIds) {
    if (!oldRegionIds.has(regionId)) {
      const region = canvas.scene.regions.get(regionId);
      if (region) {
        console.log(`Alien Zones | ${tokenDocument.name} entered ${region.name}`);
        await postZoneEntryMessage(tokenDocument, region);
      }
    }
  }

  // Clean up the stored regions
  tokenRegionsBeforeUpdate.delete(tokenDocument.id);
});
