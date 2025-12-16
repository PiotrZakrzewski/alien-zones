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

---

## Region Attributes & Custom Configuration UI

This section documents how to extend Foundry VTT v13's region system with custom attributes and UI.

### The Challenge

We needed to:
1. Store custom attributes on regions (zone types, configuration)
2. Extend the region configuration UI with custom fields
3. Make it work with Foundry VTT v13's ApplicationV2 system
4. Integrate with the Alien RPG system for automatic supply rolls

### Flag-Based Storage

**Solution:** Use Foundry's built-in flags system to store custom data on regions.

```javascript
// Store flags on a region
await region.setFlag('alien-zones', 'isAlienZone', true);
await region.setFlag('alien-zones', 'zoneType', 'unbreathable');

// Read flags from a region
const isAlienZone = region.flags?.["alien-zones"]?.isAlienZone;
const zoneType = region.flags?.["alien-zones"]?.zoneType;
```

**Key Points:**
- Flags persist automatically with the region document
- Use your module ID as the flag namespace
- Flags can be set via Foundry's native form submission using `name="flags.module-id.flagName"`
- No need for custom form handling - Foundry does it automatically

### Extending Region Configuration UI

#### ❌ What DOESN'T Work in v13

**Old jQuery approach:**
```javascript
Hooks.on("renderRegionConfig", (app, html, data) => {
  const region = app.object;  // undefined in v13!
  html.find('.form-group').last().after(html);  // html.find is not a function!
});
```

**Problems:**
- `app.object` doesn't exist in ApplicationV2 (v13)
- `html` is a native DOM element, not jQuery
- jQuery methods don't work

#### ✅ What DOES Work: ApplicationV2 Approach

**Correct v13 implementation:**
```javascript
Hooks.on("renderRegionConfig", (app, html, data) => {
  // Use app.document, not app.object
  const region = app.document;

  // Use native DOM methods, not jQuery
  const formGroups = html.querySelectorAll('.form-group');
  const insertionPoint = formGroups[formGroups.length - 1];

  // Insert HTML
  insertionPoint.insertAdjacentHTML('afterend', customHTML);

  // Attach event listeners
  const checkbox = html.querySelector('[name="flags.alien-zones.isAlienZone"]');
  checkbox.addEventListener('change', (e) => {
    // Handle change
  });
});
```

**Key Differences in ApplicationV2:**

| Old (FormApplication) | New (ApplicationV2) |
|----------------------|---------------------|
| `app.object` | `app.document` |
| `html.find()` | `html.querySelector()` |
| `html.find().last()` | `html.querySelectorAll()[length-1]` |
| `.after(html)` | `.insertAdjacentHTML('afterend', html)` |
| `.on('change', fn)` | `.addEventListener('change', fn)` |
| `.toggle(bool)` | `.style.display = bool ? 'block' : 'none'` |

### Native Flag Submission

**The easiest way to save flags is to let Foundry handle it:**

```html
<input type="checkbox"
       name="flags.alien-zones.isAlienZone"
       checked>

<select name="flags.alien-zones.zoneType">
  <option value="">Basic Zone</option>
  <option value="unbreathable">Unbreathable Zone</option>
</select>
```

When the region config form is submitted, Foundry automatically saves these to `region.flags["alien-zones"]`. No custom submit handler needed!

### Extensible Architecture Pattern

**Zone Type Registry:**

```javascript
// scripts/lib/zoneTypes.js
export const ZONE_TYPES = {
  BASIC: null,
  UNBREATHABLE: "unbreathable",
  // Add more types here
};

export const ZONE_TYPE_CONFIGS = {
  [ZONE_TYPES.UNBREATHABLE]: {
    label: "ALIENZONE.ZoneTypes.Unbreathable",
    hasChatMessage: true,
    hasSupplyRoll: true,
    supplyType: "Air"
  }
};

export function getZoneTypeConfig(zoneType) {
  return ZONE_TYPE_CONFIGS[zoneType] || ZONE_TYPE_CONFIGS[ZONE_TYPES.BASIC];
}
```

**Handler Dispatcher:**

```javascript
// scripts/lib/zoneHandlers.js
export async function handleZoneEntry(tokenDocument, region) {
  const zoneType = region.flags?.["alien-zones"]?.zoneType;
  const config = getZoneTypeConfig(zoneType);

  // Post chat message if configured
  if (config.hasChatMessage) {
    await postZoneEntryMessage(tokenDocument, region);
  }

  // Dispatch to specific handler
  switch (zoneType) {
    case ZONE_TYPES.UNBREATHABLE:
      await handleUnbreathableZone(tokenDocument, region);
      break;
    // Add more handlers here
  }
}
```

This pattern makes it trivial to add new zone types - just add to the registry and implement a handler.

---

## Alien RPG System Integration

This section documents how to integrate with the Alien RPG system for automatic supply rolls.

### Air Supply Data Structure

**Actor-Level Tracking:**
```javascript
// Total air supply (auto-calculated from items)
const airValue = actor.system.consumables.air.value;
```

**Item-Level Storage:**
```javascript
// Air supply on items and armor
const airOnItem = item.system.attributes.airsupply.value;

// Only active items count
const isActive = item.system.header.active === "true";
```

**Key Insights:**
- Air is stored on individual items/armor, not directly on the actor
- Actor's total air is auto-calculated from all active items with air supply
- "Active" items are carried/equipped; "inactive" items are in locker/storage
- Both `type: "item"` and `type: "armor"` can have air supply

### Triggering Supply Rolls

**Using the YZE Dice Roller:**

```javascript
// Import the roller
const { yze } = await import('/systems/alienrpg/module/helpers/YZEDiceRoller.mjs');

const airValue = actor.system.consumables.air.value;
const label = `${game.i18n.localize("ALIENRPG.Air")} ${game.i18n.localize("ALIENRPG.Supply")}`;
const blind = actor.token?.disposition === -1;

// Execute the roll
await yze.yzeRoll(
  "supply",      // actortype - triggers supply roll behavior
  blind,         // blind roll for hostile tokens
  true,          // reRoll enabled
  label,         // chat message label
  0,             // base dice (ALWAYS 0 for supply rolls)
  game.i18n.localize("ALIENRPG.Black"),
  airValue,      // stress dice = supply value
  game.i18n.localize("ALIENRPG.Yellow"),
  actor.id       // actor ID for attribution
);
```

**Supply Roll Mechanics:**
- Supply rolls use ONLY stress dice (yellow d6s), never base dice
- Number of dice = consumable value
- Rolling a 1 on any die means that many units are consumed
- Results stored in `game.alienrpg.rollArr.r2One`

### Manual Supply Consumption

**Important:** The YZE roller doesn't automatically consume supplies when called directly. You must handle consumption manually:

```javascript
// After the roll, check for consumption
const onesRolled = game.alienrpg.rollArr.r2One || 0;
if (onesRolled > 0) {
  await consumeAirSupply(actor, onesRolled);
}
```

**Consumption Logic:**

```javascript
async function consumeAirSupply(actor, amount) {
  let remaining = amount;

  // Find all items with air supply that are active
  const itemsWithAir = actor.items.filter(item => {
    const isActive = item.system.header?.active === "true";
    const hasAir = (item.system.attributes?.airsupply?.value || 0) > 0;
    return isActive && hasAir && (item.type === "item" || item.type === "armor");
  });

  // Sort by air value (consume from smaller sources first)
  itemsWithAir.sort((a, b) =>
    a.system.attributes.airsupply.value - b.system.attributes.airsupply.value
  );

  // Consume air from items
  for (const item of itemsWithAir) {
    if (remaining <= 0) break;

    const currentAir = item.system.attributes.airsupply.value;
    const toConsume = Math.min(remaining, currentAir);
    const newAir = currentAir - toConsume;

    await item.update({
      "system.attributes.airsupply.value": newAir
    });

    remaining -= toConsume;
  }
}
```

**Why This Is Needed:**
- The character sheet's `_onRollSupply` method handles consumption automatically
- But when calling `yze.yzeRoll()` directly, we bypass that logic
- Must manually reduce air from items after checking for 1s
- Actor's total air will auto-update when items are updated

### Dramatic Chat Messages

**For atmospheric effect, use EMOTE type messages:**

```javascript
await ChatMessage.create({
  content: "Dramatic description here...",
  flavor: "⚠️ CRITICAL DANGER",
  type: CONST.CHAT_MESSAGE_TYPES.EMOTE,
  speaker: ChatMessage.getSpeaker({ actor })
});
```

**Chat Message Types:**
- `OOC` - Out of character (system notifications)
- `IC` - In character (normal roleplay)
- `EMOTE` - Narrative/dramatic descriptions
- `WHISPER` - Private messages

### Common Pitfalls

1. **Forgetting active check:** Only items with `active === "true"` should be used
2. **Missing supply consumption:** The roller doesn't consume automatically
3. **Wrong dice type:** Supply rolls use stress dice only (r2), not base dice (r1)
4. **Actor vs Item air:** Actor's air is read-only, calculated from items
5. **Blind rolls:** Hostile tokens (disposition -1) should roll blind

### File Locations

**Key Alien RPG System Files:**
- Dice roller: `/systems/alienrpg/module/helpers/YZEDiceRoller.mjs`
- Character sheet roll handler: `/systems/alienrpg/module/sheets/character-sheet.mjs` (lines 1397-1564)
- Actor data model: `/systems/alienrpg/module/data/actor-character.mjs` (consumables at lines 248-277)
- Item data: `/systems/alienrpg/module/data/item-item.mjs`
- Armor data: `/systems/alienrpg/module/data/item-armor.mjs`

### Testing Tips

**Verify supply rolls are working:**
1. Check console for "Alien Zones | rolled X ones - consuming air supply"
2. Check console for "Consumed X air from [item name]"
3. Verify actor's air value decreases in character sheet
4. Check items to see which ones lost air supply
5. Roll in Foundry's chat to see the dice results

**Common issues:**
- Roll happens but air doesn't decrease → consumption logic not called
- Wrong amount consumed → check `game.alienrpg.rollArr.r2One` value
- No items have air → verify items are active and have `airsupply.value > 0`

---

## Module Development Best Practices

### Hard Refresh is Essential

**The #1 most common issue:** Browser caching old JavaScript.

**Always hard refresh when testing:**
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

Do this EVERY time you:
- Edit JavaScript files
- Add new files
- Change imports
- Update the module

### Debugging ApplicationV2 Hooks

**Check what you're actually receiving:**

```javascript
Hooks.on("renderRegionConfig", (app, html, data) => {
  console.log("App:", app);
  console.log("App.document:", app.document);
  console.log("App.object:", app.object);  // undefined in v13
  console.log("HTML type:", html.constructor.name);  // HTMLElement, not jQuery
  console.log("Data:", data);
});
```

This reveals:
- Property names on the application
- Whether html is jQuery or native DOM
- What data is available

### Module Structure for Extensibility

**Separate concerns into focused files:**

```
scripts/
├── module.js              # Main entry, hook registration
└── lib/
    ├── lib.js            # Core utilities
    ├── zoneTypes.js      # Zone type registry
    ├── zoneHandlers.js   # Zone-specific logic
    └── regionConfig.js   # UI extension
```

**Benefits:**
- Easy to add new zone types (just edit registry and add handler)
- Clear separation of responsibilities
- Easier to test individual components
- Simpler to understand and maintain

### Error Handling Strategy

**Graceful degradation:**

```javascript
try {
  // Try automatic approach
  await triggerAirSupplyRoll(actor, region);
} catch (error) {
  console.error("Alien Zones | Error:", error);
  // Fallback to manual prompt
  await ChatMessage.create({
    content: "Please roll Air supply manually",
    type: CONST.CHAT_MESSAGE_TYPES.OOC
  });
}
```

Always provide fallbacks so the module remains functional even when integration fails.

---

## Version History

- **Initial attempt:** `regionEvent` hook - didn't work
- **Second attempt:** `change._regions` in `updateToken` - unreliable
- **Third attempt:** `region.testPoint()` manual checking - method issues
- **Fourth attempt:** Dual hook with `preUpdateToken` + `updateToken` - WORKS!
- **v13 Update:** ApplicationV2 region config extension - native DOM, not jQuery
- **System Integration:** Alien RPG supply rolls with manual consumption

This knowledge was hard-won through trial and error. Document your findings!
