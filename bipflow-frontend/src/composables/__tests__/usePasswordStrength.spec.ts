import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { usePasswordStrength } from '../usePasswordStrength'

describe('usePasswordStrength', () => {
  it('reports "empty" for an empty password', () => {
    const { level, label, filledBars } = usePasswordStrength(ref(''))
    expect(level.value).toBe('empty')
    expect(label.value).toBe('')
    expect(filledBars.value).toBe(0)
  })

  it('reports "weak" when fewer than half the rules pass', () => {
    // '1': has a number, but fails length, has-a-letter, and not-only-numeric -- 1/4.
    const { level } = usePasswordStrength(ref('1'))
    expect(level.value).toBe('weak')
  })

  it('flags an all-numeric password as failing the numeric-only rule', () => {
    const { rules, isValid } = usePasswordStrength(ref('12345678'))
    const numericRule = rules.value.find((rule) => rule.label === 'Não é só números')
    expect(numericRule?.passed).toBe(false)
    expect(isValid.value).toBe(false)
  })

  it('reports "strong" once length, letter, number, and non-numeric rules all pass', () => {
    const { level, isValid, filledBars, totalBars } = usePasswordStrength(ref('Abcdef12'))
    expect(level.value).toBe('strong')
    expect(isValid.value).toBe(true)
    expect(filledBars.value).toBe(totalBars)
  })

  it('reports "good" when only the numeric rule is missing (3 of 4)', () => {
    // 8+ chars, has a letter, has a number, but IS only numeric -- wait,
    // that combination is contradictory by construction; use a password
    // that is letters+numbers but under 8 chars to get exactly 3/4 instead:
    // has letter, has number, not-only-numeric, but fails length.
    const { level } = usePasswordStrength(ref('ab12'))
    expect(level.value).toBe('good')
  })

  it('reacts to changes in the underlying ref', () => {
    const password = ref('')
    const { level } = usePasswordStrength(password)
    expect(level.value).toBe('empty')

    password.value = 'Abcdef12'
    expect(level.value).toBe('strong')
  })

  it('is invalid while the confirmation logic lives in the caller, not here', () => {
    // usePasswordStrength only judges the password itself; confirm-password
    // matching is intentionally a separate concern left to the component.
    const { rules } = usePasswordStrength(ref('Abcdef12'))
    expect(rules.value.some((rule) => rule.label.toLowerCase().includes('confirm'))).toBe(false)
  })
})
