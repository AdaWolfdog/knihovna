// Supported languages
export type Language = 'cs' | 'en' | 'de' | 'es' | 'emoji';

export interface LanguageOption {
  code: Language;
  label: string;
  flag?: string;
}

export const EMOJI_LANGUAGE_NAME = '🧝🧚✨🦄🌸';

export const LANGUAGES: LanguageOption[] = [
  { code: 'cs', label: 'Čeština', flag: '🇨🇿' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'emoji', label: EMOJI_LANGUAGE_NAME },
];

// Special emojis requested by user:
// elf (🧝), elfka (🧝‍♀️), víla (🧚), hvězdičky (✨), hvězdičky s obloučkem (💫),
// jednorožec (🦄), kytička (🌸), tulipán (🌷), hyacint (🪻), slunečnice (🌻)
export const SPECIAL_EMOJIS = [
  '🧝',
  '🧝‍♀️',
  '🧚',
  '✨',
  '💫',
  '🦄',
  '🌸',
  '🌷',
  '🪻',
  '🌻',
];

/**
 * Deterministic hash for string to get consistent pseudorandom sequence.
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

/**
 * Mulberry32 PRNG for deterministic random values based on seed.
 */
function createPrng(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Converts text into deterministic emoji sequence matching approximate length
 * (~1 emoji per 3 characters) while preserving space/punctuation structure.
 */
export function textToEmoji(text: string): string {
  if (!text) return '';

  const seed = hashString(text);
  const random = createPrng(seed);

  // Split text into words to preserve basic sentence/spacing structure
  const words = text.split(/(\s+)/);

  return words
    .map((part) => {
      // Preserve whitespace as is
      if (/^\s+$/.test(part)) {
        return part;
      }
      // For each word, determine number of emojis: approximately 1 emoji per 3 characters (at least 1)
      const count = Math.max(1, Math.round(part.length / 3));
      let emojiWord = '';
      for (let i = 0; i < count; i++) {
        const index = Math.floor(random() * SPECIAL_EMOJIS.length);
        emojiWord += SPECIAL_EMOJIS[index];
      }
      return emojiWord;
    })
    .join('');
}
