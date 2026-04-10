"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.toTitleCase = toTitleCase;
exports.discoverJourneys = discoverJourneys;
exports.getJourneyById = getJourneyById;
const path = __importStar(require("path"));
const glob_1 = require("glob");
/**
 * Converts a kebab-case string to Title Case.
 *
 * @param kebab - Hyphen-separated string (e.g. `"user-login"`)
 * @returns Title-cased string (e.g. `"User Login"`)
 */
function toTitleCase(kebab) {
    return kebab
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
/**
 * Discovers journey files matching the configured glob pattern.
 * Returns Journey objects sorted alphabetically by id.
 * Only includes `.ts` files. Returns an empty array on no matches.
 *
 * @param config - Resolved config containing the journeys glob pattern
 * @returns Sorted array of discovered Journey objects
 */
async function discoverJourneys(config) {
    let files;
    try {
        files = await (0, glob_1.glob)(config.journeys, { absolute: true });
    }
    catch {
        return [];
    }
    const journeys = files
        .filter(f => f.endsWith('.ts'))
        .map(filePath => {
        const filename = path.basename(filePath);
        const id = filename.replace(/\.journey\.ts$/, '');
        return {
            id,
            name: toTitleCase(id),
            path: filePath,
        };
    })
        .sort((a, b) => a.id.localeCompare(b.id));
    return journeys;
}
/**
 * Finds a specific journey by id.
 *
 * @param id - The journey identifier (filename without `.journey.ts`)
 * @param config - Resolved config containing the journeys glob pattern
 * @returns The matching Journey, or `null` if not found
 */
async function getJourneyById(id, config) {
    const journeys = await discoverJourneys(config);
    return journeys.find(j => j.id === id) ?? null;
}
//# sourceMappingURL=journey-discovery.js.map