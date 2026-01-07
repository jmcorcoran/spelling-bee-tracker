export const calculateWordPoints = (word: string, isPangram: boolean): number => {
  const length = word.length;
  
  // 4-letter words get 1 point
  if (length === 4) {
    return isPangram ? 8 : 1;
  }
  
  // 5+ letter words get points equal to length
  const basePoints = length;
  return isPangram ? basePoints + 7 : basePoints;
};

export const calculateTotalPoints = (
  words: string[],
  pangrams: Set<string>
): number => {
  return words.reduce((total, word) => {
    const isPangram = pangrams.has(word);
    return total + calculateWordPoints(word, isPangram);
  }, 0);
};
