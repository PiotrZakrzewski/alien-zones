/**
 * Alien Zones - Region Configuration UI Extension
 * Extends the Region Configuration form with Alien Zones settings
 */

import { ZONE_TYPES, getZoneTypeConfig } from './zoneTypes.js';

/**
 * Initialize region config hooks
 */
export function initRegionConfigHooks() {
  Hooks.on("renderRegionConfig", onRenderRegionConfig);
}

/**
 * Inject custom fields into RegionConfig form
 * @param {RegionConfig} app - The region config application
 * @param {jQuery} html - The HTML content
 * @param {Object} data - The render data
 */
async function onRenderRegionConfig(app, html, data) {
  // Only show to GMs
  if (!game.user.isGM) return;

  const region = app.document;

  // Get current flag values
  const isAlienZone = region.flags?.["alien-zones"]?.isAlienZone ?? false;
  const zoneType = region.flags?.["alien-zones"]?.zoneType ?? null;

  // Build HTML for our custom section
  const alienZonesSection = buildAlienZonesSection(isAlienZone, zoneType);

  // Find insertion point - after the last form group
  const formGroups = html.querySelectorAll('.form-group');
  const insertionPoint = formGroups[formGroups.length - 1];

  if (insertionPoint) {
    insertionPoint.insertAdjacentHTML('afterend', alienZonesSection);

    // Attach event handlers
    const checkbox = html.querySelector('[name="flags.alien-zones.isAlienZone"]');
    const optionsDiv = html.querySelector('.alien-zones-options');

    if (checkbox && optionsDiv) {
      checkbox.addEventListener('change', (e) => {
        optionsDiv.style.display = e.target.checked ? 'block' : 'none';
      });

      // Initialize visibility
      optionsDiv.style.display = isAlienZone ? 'block' : 'none';
    }
  }
}

/**
 * Build HTML for Alien Zones configuration section
 * @param {boolean} isAlienZone - Whether the zone is enabled
 * @param {string|null} zoneType - The current zone type
 * @returns {string} HTML string
 */
function buildAlienZonesSection(isAlienZone, zoneType) {
  const zoneTypeOptions = Object.entries(ZONE_TYPES)
    .map(([key, value]) => {
      const config = getZoneTypeConfig(value);
      const selected = value === zoneType ? 'selected' : '';
      const label = game.i18n.localize(config.label);
      return `<option value="${value || ''}" ${selected}>${label}</option>`;
    })
    .join('');

  return `
    <fieldset class="alien-zones-config">
      <legend>${game.i18n.localize("ALIENZONE.Config.Title")}</legend>

      <div class="form-group">
        <label>${game.i18n.localize("ALIENZONE.Config.EnableZone")}</label>
        <input type="checkbox"
               name="flags.alien-zones.isAlienZone"
               ${isAlienZone ? 'checked' : ''}>
        <p class="hint">${game.i18n.localize("ALIENZONE.Config.EnableZoneHint")}</p>
      </div>

      <div class="alien-zones-options" style="display: ${isAlienZone ? 'block' : 'none'}">
        <div class="form-group">
          <label>${game.i18n.localize("ALIENZONE.Config.ZoneType")}</label>
          <select name="flags.alien-zones.zoneType">
            ${zoneTypeOptions}
          </select>
          <p class="hint">${game.i18n.localize("ALIENZONE.Config.ZoneTypeHint")}</p>
        </div>
      </div>
    </fieldset>
  `;
}
