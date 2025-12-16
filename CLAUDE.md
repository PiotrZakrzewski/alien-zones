# Alien Zones - Development Learnings

## Foundry VTT v13 Region Entry Detection

This document captures the hard-won knowledge about detecting token entry into regions in Foundry VTT v13.

### The Challenge

We needed to detect when a player-controlled token enters a region (zone) and post a chat message. This seems simple but required multiple iterations to get right.

### What DOESN'T Work

#### ❌ Approach 1: `regionEvent` Hook
```javascript
Hooks.on("regionEvent", (event) => {
  // This hook doesn't exist or isn't documented
});
```
**Problem:** Despite documentation suggesting region events exist, the `regionEvent` hook never fires in practice.

#### ❌ Approach 2: `change._regions` Property
```javascript
Hooks.on("updateToken", (tokenDocument, change) => {
  const newRegions = change._regions; // undefined on first entry!
});
```
**Problem:** The `change._regions` property is unreliable - it's often `undefined` on the first move into a region, then only populated on subsequent moves.

#### ❌ Approach 3: `region.testPoint()` Method
```javascript
for (const region of canvas.scene.regions) {
  if (region.testPoint({x, y}, 0)) {
    // Never returns true
  }
}
```
**Problem:** Either `testPoint()` doesn't exist, has different parameters, or requires accessing region shapes differently. Always returned false in our tests.

### ✅ What DOES Work: Dual Hook Approach

The working solution uses **two hooks together**:

```javascript
// Store regions BEFORE the update
const tokenRegionsBeforeUpdate = new Map();

Hooks.on("preUpdateToken", (tokenDocument, change) => {
  if (change.x !== undefined || change.y !== undefined) {
    // Capture OLD regions before document updates
    tokenRegionsBeforeUpdate.set(
      tokenDocument.id,
      new Set(tokenDocument._regions || [])
    );
  }
});

Hooks.on("updateToken", (tokenDocument, change) => {
  if (change.x === undefined && change.y === undefined) return;
  if (!tokenDocument.hasPlayerOwner) return;

  // Get old regions (captured in preUpdateToken)
  const oldRegionIds = tokenRegionsBeforeUpdate.get(tokenDocument.id) || new Set();

  // Get new regions (now updated in the document)
  const newRegionIds = new Set(tokenDocument._regions || []);

  // Find newly entered regions
  for (const regionId of newRegionIds) {
    if (!oldRegionIds.has(regionId)) {
      // Token entered this region!
    }
  }

  // Cleanup
  tokenRegionsBeforeUpdate.delete(tokenDocument.id);
});
```

### Why This Works

**Key Insight:** Foundry VTT automatically maintains `tokenDocument._regions` as an array of region IDs the token is currently in. However:

1. In `preUpdateToken`: `tokenDocument._regions` still has the OLD value (before movement)
2. In `updateToken`: `tokenDocument._regions` has been UPDATED to the new value (after movement)
3. The `change` object is unreliable for `_regions`

By capturing the old value in `preUpdateToken` and comparing it to the new value in `updateToken`, we can reliably detect region entry.

### Important Implementation Details

#### Filter for Player Tokens Only
```javascript
if (!tokenDocument.hasPlayerOwner) return;
```
Use `hasPlayerOwner` not `isOwner` - the former checks if ANY player owns the token, the latter checks if the CURRENT user owns it.

#### Detect Position Changes
```javascript
if (change.x === undefined && change.y === undefined) return;
```
Always check if x/y changed - tokens can be updated for other reasons (rotation, visibility, etc.).

#### Use Sets for Comparison
```javascript
const oldRegionIds = new Set(tokenDocument._regions || []);
```
Sets make it easy to check if a region is new: `!oldRegionIds.has(regionId)`

#### Clean Up Memory
```javascript
tokenRegionsBeforeUpdate.delete(tokenDocument.id);
```
Always clean up the Map after processing to avoid memory leaks.

### Chat Message API

Creating chat messages in Foundry v13:

```javascript
await ChatMessage.create({
  content: game.i18n.format("ALIENZONE.EnteredZone", {
    token: tokenName,
    zone: zoneName
  }),
  flavor: game.i18n.localize("ALIENZONE.ModuleName"),
  type: CONST.CHAT_MESSAGE_TYPES.OOC,
  speaker: { alias: game.i18n.localize("ALIENZONE.ModuleName") }
});
```

**Key points:**
- Use `CONST.CHAT_MESSAGE_TYPES.OOC` for system notifications
- Use `game.i18n.format()` for string interpolation
- Use `game.i18n.localize()` for simple strings
- Set `speaker.alias` for module-generated messages

### Module Structure Best Practices

#### ES6 Modules Only
```json
"esmodules": ["scripts/module.js"],
"scripts": []  // Don't put ES6 modules here!
```
Files with `export` statements must be in `esmodules`, not `scripts`. The `scripts` array is for old-style JavaScript only.

#### Import Paths
```javascript
import { postZoneEntryMessage } from './lib/lib.js';
```
Always include the `.js` extension in ES6 imports.

### Testing Challenges

Testing Foundry-specific code is difficult because:
1. Global objects like `game`, `canvas`, `ChatMessage` don't exist in Jest
2. Hook registration happens at module load time
3. Region logic depends on Foundry's internal data structures

**Solution:** Focus unit tests on pure utility functions, use integration tests to verify hook logic structure.

### Debugging Tips

When developing Foundry modules:

1. **Add extensive console.log statements** - The browser console is your friend
2. **Check hook registration** - Add a log immediately inside the hook to verify it fires
3. **Inspect data structures** - Log entire objects to see what properties are available
4. **Hard refresh** - Browsers aggressively cache JavaScript: Ctrl+Shift+R / Cmd+Shift+R
5. **Check module.json** - Incorrect paths or arrays cause silent failures

### Common Pitfalls

1. **Caching:** Browser caches old module code - always hard refresh when testing
2. **Module.json errors:** Syntax errors cause the module to not load at all
3. **Hook timing:** `init` fires before canvas is ready, `ready` fires after everything is loaded
4. **Async/await:** Don't forget `await` on `ChatMessage.create()` or it may not execute
5. **Region IDs vs Documents:** `tokenDocument._regions` contains IDs, not Region objects

### Useful References

- [Foundry VTT v13 API](https://foundryvtt.com/api/)
- [Scene Regions Article](https://foundryvtt.com/article/scene-regions/)
- [Hook Events Documentation](https://foundryvtt.com/api/modules/hookEvents.html)
- [ChatMessage API](https://foundryvtt.com/api/classes/foundry.documents.ChatMessage.html)

### Version History

- **Initial attempt:** `regionEvent` hook - didn't work
- **Second attempt:** `change._regions` in `updateToken` - unreliable
- **Third attempt:** `region.testPoint()` manual checking - method issues
- **Final solution:** Dual hook with `preUpdateToken` + `updateToken` - WORKS!

This knowledge was hard-won through trial and error. Document your findings!
