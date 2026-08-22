const COMMON_FIVE_LETTER_WORDS = [
  "ABOUT", "ABOVE", "ACTOR", "ALLEY", "APPLE", "BEACH", "BRAIN", "BRAND", "BREAD", "BRICK", "CHAIR",
  "CHARM", "CHESS", "CHIEF", "CLOUD", "COAST", "CRANE", "DANCE", "DREAM", "DRIVE", "EARTH",
  "FAITH", "FIELD", "FLAME", "FOCUS", "FRAME", "FRESH", "FRUIT", "GIANT", "GLASS", "GRAPE",
  "GREEN", "GROUP", "HEART", "HORSE", "HOUSE", "HUMAN", "JUICE", "KNIFE", "LEMON", "LIGHT",
  "MAGIC", "METAL", "MONEY", "MOUSE", "MUSIC", "NIGHT", "OCEAN", "PAINT", "PAPER", "PARTY",
  "PEACH", "PHONE", "PIANO", "PILOT", "PLANE", "PLANT", "PLATE", "POINT", "POWER", "QUEEN",
  "RADIO", "RIVER", "ROBOT", "ROUND", "SCALE", "SHARK", "SHEEP", "SHELF", "SHINE", "SHIRT",
  "SKILL", "SMILE", "SPACE", "SPOON", "SPORT", "STAGE", "STONE", "STORM", "STORY", "SUGAR",
  "SWEET", "TABLE", "TEACH", "TIGER", "TOAST", "TRAIN", "TRUCK", "VOICE", "WATER", "WHALE",
  "WHEAT", "WHEEL", "WHITE", "WORLD", "WRITE", "YOUTH", "ZEBRA",
] as const;

const WORDS = new Set<string>(COMMON_FIVE_LETTER_WORDS);

export function normalizeChallengeWord(value: string): string | undefined {
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{5}$/.test(normalized) && WORDS.has(normalized) ? normalized : undefined;
}

export function isChallengeWord(value: string): boolean {
  return normalizeChallengeWord(value) !== undefined;
}

export const challengeDictionarySize = WORDS.size;
