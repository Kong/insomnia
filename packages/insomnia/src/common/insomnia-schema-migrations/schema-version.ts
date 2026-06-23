/**
 * The current Insomnia schema version.
 *
 * IMPORTANT:
 * - This constant defines the version of the data schema used for Insomnia collections, environments, and other resources.
 * - You MUST update this value whenever you make a breaking change to the schema, such as:
 *    - Adding, removing, or renaming fields in the schema (e.g., removing `id` from headers/parameters)
 *    - Changing the structure or type of existing fields
 *    - Introducing new required fields or altering validation rules
 * - When you update this version:
 *    1. Add a corresponding migration step to the `migrations` array to handle data from previous versions.
 *    2. Update any code that generates or exports Insomnia files to use the new version in the `type` field.
 *    3. Communicate the schema change in release notes and documentation.
 * - Keeping this version accurate ensures that:
 *    - Data migrations are applied correctly for users importing older data.
 *    - The app can distinguish between different schema versions and handle them appropriately.
 *    - Developers and users are aware of the current schema expectations.
 */
export const INSOMNIA_SCHEMA_VERSION = '5.1';
