/**
 * Alien Zones - Zone Entry Handlers
 * Dispatch and handle zone entry events based on zone type
 */

import { getZoneTypeConfig, ZONE_TYPES } from './zoneTypes.js';
import { postZoneEntryMessage } from './lib.js';

/**
 * Main entry point for zone entry handling
 * @param {TokenDocument} tokenDocument - The token that entered
 * @param {Region} region - The region that was entered
 */
export async function handleZoneEntry(tokenDocument, region) {
  const zoneType = region.flags?.["alien-zones"]?.zoneType;
  const config = getZoneTypeConfig(zoneType);

  console.log(`Alien Zones | Handling ${zoneType || 'basic'} zone entry for ${tokenDocument.name}`);

  // Post chat message if configured
  if (config.hasChatMessage) {
    await postZoneEntryMessage(tokenDocument, region);
  }

  // Dispatch to specific handler
  switch (zoneType) {
    case ZONE_TYPES.UNBREATHABLE:
      await handleUnbreathableZone(tokenDocument, region);
      break;

    // Future zone types can be added here:
    // case ZONE_TYPES.DARKNESS:
    //   await handleDarknessZone(tokenDocument, region);
    //   break;

    default:
      // No additional handling for basic zones
      break;
  }
}

/**
 * Handle entry into unbreathable zones
 * Triggers Air supply roll for the Alien RPG system
 * @param {TokenDocument} tokenDocument - The token that entered
 * @param {Region} region - The region that was entered
 */
async function handleUnbreathableZone(tokenDocument, region) {
  // Check if Alien RPG system is active
  if (game.system.id !== "alienrpg") {
    console.warn("Alien Zones | Unbreathable zone requires Alien RPG system");
    ui.notifications.warn(game.i18n.localize("ALIENZONE.Errors.RequiresAlienRPG"));
    return;
  }

  try {
    // Get the actor from the token
    const actor = tokenDocument.actor;
    if (!actor) {
      console.warn("Alien Zones | No actor found for token");
      return;
    }

    // Trigger Air supply roll
    await triggerAirSupplyRoll(actor, region);

  } catch (error) {
    console.error("Alien Zones | Error handling unbreathable zone:", error);
    ui.notifications.error(game.i18n.localize("ALIENZONE.Errors.SupplyRollFailed"));
  }
}

/**
 * Consume air supply from actor's items
 * Reduces air supply from active items/armor based on consumption amount
 *
 * @param {Actor} actor - The actor whose air to consume
 * @param {number} amount - Amount of air supply to consume
 */
async function consumeAirSupply(actor, amount) {
  let remaining = amount;

  // Find all items and armor with air supply that are active
  const itemsWithAir = actor.items.filter(item => {
    const isActive = item.system.header?.active === "true";
    const hasAir = (item.system.attributes?.airsupply?.value || 0) > 0;
    return isActive && hasAir && (item.type === "item" || item.type === "armor");
  });

  // Sort by air value (consume from items with less air first)
  itemsWithAir.sort((a, b) => {
    const airA = a.system.attributes.airsupply.value;
    const airB = b.system.attributes.airsupply.value;
    return airA - airB;
  });

  // Consume air from items
  for (const item of itemsWithAir) {
    if (remaining <= 0) break;

    const currentAir = item.system.attributes.airsupply.value;
    const toConsume = Math.min(remaining, currentAir);
    const newAir = currentAir - toConsume;

    await item.update({
      "system.attributes.airsupply.value": newAir
    });

    console.log(`Alien Zones | Consumed ${toConsume} air from ${item.name} (${currentAir} -> ${newAir})`);
    remaining -= toConsume;
  }

  if (remaining > 0) {
    console.warn(`Alien Zones | Could not consume all air supply (${remaining} units remaining)`);
  }
}

/**
 * Trigger an Air supply roll in the Alien RPG system
 *
 * Uses the official Alien RPG system's YZE dice roller to perform
 * an automatic air supply check when entering an unbreathable zone.
 *
 * @param {Actor} actor - The actor to roll for
 * @param {Region} region - The region entered
 */
async function triggerAirSupplyRoll(actor, region) {
  // Validate actor has air consumable tracking
  if (!actor.system.consumables?.air) {
    console.warn("Alien Zones | Actor does not track air consumables");
    await ChatMessage.create({
      content: game.i18n.format("ALIENZONE.Messages.SupplyRollPrompt", {
        token: actor.name,
        zone: region.name,
        supply: "Air"
      }),
      speaker: ChatMessage.getSpeaker({ actor }),
      type: CONST.CHAT_MESSAGE_TYPES.OOC
    });
    return;
  }

  const airValue = actor.system.consumables.air.value;

  // Check if actor has air supply - post dramatic message if not
  if (airValue <= 0) {
    await ChatMessage.create({
      content: game.i18n.format("ALIENZONE.Messages.NoAirSupplyDramatic", {
        token: actor.name,
        zone: region.name
      }),
      flavor: game.i18n.localize("ALIENZONE.Messages.CriticalDanger"),
      type: CONST.CHAT_MESSAGE_TYPES.EMOTE,
      speaker: ChatMessage.getSpeaker({ actor })
    });

    ui.notifications.error(
      game.i18n.format("ALIENZONE.Messages.NoAirSupply", {
        token: actor.name
      })
    );
    return;
  }

  // Prepare roll parameters
  const label = `${game.i18n.localize("ALIENRPG.Air")} ${game.i18n.localize("ALIENRPG.Supply")}`;
  const blind = actor.token?.disposition === -1;

  try {
    // Dynamically import the Alien RPG dice roller
    const { yze } = await import('/systems/alienrpg/module/helpers/YZEDiceRoller.mjs');

    // Execute the supply roll
    await yze.yzeRoll(
      "supply",      // actortype - triggers supply roll behavior
      blind,         // blind roll if hostile token
      true,          // reRoll enabled
      label,         // chat message label
      0,             // base dice (always 0 for supply rolls)
      game.i18n.localize("ALIENRPG.Black"),
      airValue,      // stress/supply dice count
      game.i18n.localize("ALIENRPG.Yellow"),
      actor.id       // actor ID for attribution
    );

    // Check if any 1s were rolled (supply consumed)
    const onesRolled = game.alienrpg.rollArr.r2One || 0;
    if (onesRolled > 0) {
      console.log(`Alien Zones | ${actor.name} rolled ${onesRolled} ones - consuming air supply`);

      // Reduce air supply by consuming from items
      await consumeAirSupply(actor, onesRolled);
    }

  } catch (error) {
    console.error("Alien Zones | Error triggering air supply roll:", error);
    // Fallback to chat prompt
    await ChatMessage.create({
      content: game.i18n.format("ALIENZONE.Messages.SupplyRollPrompt", {
        token: actor.name,
        zone: region.name,
        supply: "Air"
      }),
      speaker: ChatMessage.getSpeaker({ actor }),
      type: CONST.CHAT_MESSAGE_TYPES.OOC
    });
  }
}
