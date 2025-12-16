/**
 * Alien Zones - Utility Functions
 * Zone-based gameplay support for the Alien RPG system
 */

/**
 * Check if a region is tagged as an Alien Zone
 * @param {Region} region - The region document to check
 * @returns {boolean} True if the region is an Alien Zone
 */
export function isAlienZone(region) {
  return region.flags?.["alien-zones"]?.isAlienZone === true;
}

/**
 * Get the display name for a token
 * @param {Token} token - The token document
 * @returns {string} The token's name
 */
export function getTokenName(token) {
  return token.name || "Unknown Token";
}

/**
 * Get the display name for a zone
 * @param {Region} region - The region document
 * @returns {string} The region's name
 */
export function getZoneName(region) {
  return region.name || "Unknown Zone";
}

/**
 * Post a chat message when a token enters a zone
 * @param {Token} token - The token that entered
 * @param {Region} region - The region that was entered
 */
export async function postZoneEntryMessage(token, region) {
  const tokenName = getTokenName(token);
  const zoneName = getZoneName(region);
  const zoneType = region.flags?.["alien-zones"]?.zoneType;

  // Select message key based on zone type
  let messageKey = "ALIENZONE.EnteredZone";
  if (zoneType === "unbreathable") {
    messageKey = "ALIENZONE.EnteredUnbreathableZone";
  }

  const content = game.i18n.format(messageKey, {
    token: tokenName,
    zone: zoneName
  });

  await ChatMessage.create({
    content: content,
    flavor: game.i18n.localize("ALIENZONE.ModuleName"),
    type: CONST.CHAT_MESSAGE_TYPES.OOC,
    speaker: { alias: game.i18n.localize("ALIENZONE.ModuleName") }
  });
}
