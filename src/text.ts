/** Word counting and length checks for QQ outbound text. */
const words = new Intl.Segmenter('zh', { granularity: 'word' })

/** Mirrors dsh-superagent's IM word budget so replies keep to a short, high-level update. */
export const IM_WORDS = 100

export function wordCount(text: string): number {
  let count = 0
  for (const segment of words.segment(text)) if (segment.isWordLike) count++
  return count
}

/** Validates an outgoing IM message against the word budget. */
export function checkedImText(text: string): string {
  const count = wordCount(text)
  if (count > IM_WORDS) throw new Error(`IM message has ${count} words; maximum is ${IM_WORDS}. Rewrite as a short high-level update.`)
  return text
}
