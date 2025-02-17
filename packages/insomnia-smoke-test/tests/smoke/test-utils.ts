import crypto from 'crypto';

/**
 * This function will return a random email.
 * @returns Random email
 */
export function getUserEmail() {
  return `insomnia.test.user+${getRandomId()}@gmail.com`;
}

/**
 * This function will return a random ID.
 * @returns Random ID
 */
export function getRandomId() {
  return crypto.randomUUID();
}

/**
 * This function will return a random team name.
 * @returns Random team name
 */
export function getTeamName() {
  return `Insomnia ${crypto.randomInt(0, 100000)}`;
}
