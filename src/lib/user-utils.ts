/**
 * Converts an email address into a capitalized display name.
 * E.g., "john.doe@example.com" -> "John Doe"
 */
export function getDisplayNameFromEmail(email: string): string {
  if (!email) return 'User';

  // 1. Get the part before the @
  const localPart = email.split('@')[0];

  // 2. Replace common separators (. or _) with a space
  const parts = localPart.replace(/[._]/g, ' ').split(' ');

  // 3. Capitalize each part and join them
  const displayName = parts
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return displayName.trim() || 'User';
}