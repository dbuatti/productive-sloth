interface ParsedTaskFlags {
  isCritical: boolean;
  isBackburner: boolean;
  sendToSink: boolean;
  isFixed: boolean;
  remainingText: string;
}

/**
 * Parses the quick input string for critical (!), backburner (-), sink, and fixed flags.
 * Critical (!) and Backburner (-) must be prefixes.
 */
export function parseQuickInputFlags(input: string): ParsedTaskFlags {
  let remainingText = input.trim();
  let isCritical = false;
  let isBackburner = false;
  let sendToSink = false;
  let isFixed = false;

  // 1. Check for Critical Flag (Prefix: !)
  if (remainingText.startsWith('!')) {
    isCritical = true;
    remainingText = remainingText.substring(1).trim();
  }

  // 2. Check for Backburner Flag (Prefix: -)
  if (remainingText.startsWith('-')) {
    isBackburner = true;
    remainingText = remainingText.substring(1).trim();
  }

  // 3. Check for Sink Flag (Suffix: sink)
  // Check for ' sink' (with space) to avoid matching tasks ending in 'think' or 'link'
  if (remainingText.toLowerCase().endsWith(' sink')) {
    sendToSink = true;
    remainingText = remainingText.substring(0, remainingText.length - 5).trim();
  }

  // 4. Check for Fixed Flag (Suffix: fixed)
  // Check for ' fixed' (with space)
  if (remainingText.toLowerCase().endsWith(' fixed')) {
    isFixed = true;
    remainingText = remainingText.substring(0, remainingText.length - 6).trim();
  }

  return {
    isCritical,
    isBackburner,
    sendToSink,
    isFixed,
    remainingText,
  };
}