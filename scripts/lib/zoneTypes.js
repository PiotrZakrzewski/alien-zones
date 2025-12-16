/**
 * Alien Zones - Zone Type Registry
 * Defines zone types and their configurations
 */

/**
 * Zone type identifiers
 * @constant {Object}
 */
export const ZONE_TYPES = {
  BASIC: null,
  UNBREATHABLE: "unbreathable"
};

/**
 * Configuration for each zone type
 * @constant {Object}
 */
export const ZONE_TYPE_CONFIGS = {
  [ZONE_TYPES.BASIC]: {
    label: "ALIENZONE.ZoneTypes.Basic",
    description: "ALIENZONE.ZoneTypes.BasicDesc",
    hasChatMessage: true,
    hasSupplyRoll: false
  },
  [ZONE_TYPES.UNBREATHABLE]: {
    label: "ALIENZONE.ZoneTypes.Unbreathable",
    description: "ALIENZONE.ZoneTypes.UnbreathableDesc",
    hasChatMessage: true,
    hasSupplyRoll: true,
    supplyType: "Air"
  }
};

/**
 * Get configuration for a zone type
 * @param {string|null} zoneType - The zone type identifier
 * @returns {Object} The zone type configuration
 */
export function getZoneTypeConfig(zoneType) {
  return ZONE_TYPE_CONFIGS[zoneType] || ZONE_TYPE_CONFIGS[ZONE_TYPES.BASIC];
}
