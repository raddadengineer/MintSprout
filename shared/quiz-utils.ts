/** Quiz answers are stored 0-indexed (0 = first option). */
export function isQuizAnswerCorrect(selectedIndex: number, correctAnswer: number): boolean {
  return selectedIndex === correctAnswer;
}
