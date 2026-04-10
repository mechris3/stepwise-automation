import { ResolvedConfig } from '../config';
/**
 * Represents a discovered journey file.
 */
export interface Journey {
    /** Filename without the `.journey.ts` extension (e.g. `"login-and-edit-profile"`). */
    id: string;
    /** Human-readable Title Case name derived from the id (e.g. `"Login And Edit Profile"`). */
    name: string;
    /** Absolute filesystem path to the journey source file. */
    path: string;
}
/**
 * Converts a kebab-case string to Title Case.
 *
 * @param kebab - Hyphen-separated string (e.g. `"user-login"`)
 * @returns Title-cased string (e.g. `"User Login"`)
 */
export declare function toTitleCase(kebab: string): string;
/**
 * Discovers journey files matching the configured glob pattern.
 * Returns Journey objects sorted alphabetically by id.
 * Only includes `.ts` files. Returns an empty array on no matches.
 *
 * @param config - Resolved config containing the journeys glob pattern
 * @returns Sorted array of discovered Journey objects
 */
export declare function discoverJourneys(config: ResolvedConfig): Promise<Journey[]>;
/**
 * Finds a specific journey by id.
 *
 * @param id - The journey identifier (filename without `.journey.ts`)
 * @param config - Resolved config containing the journeys glob pattern
 * @returns The matching Journey, or `null` if not found
 */
export declare function getJourneyById(id: string, config: ResolvedConfig): Promise<Journey | null>;
//# sourceMappingURL=journey-discovery.d.ts.map