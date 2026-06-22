import { describe, it, expect } from 'vitest'
import { buildCsv } from '../csv'

describe('buildCsv', () => {
  it('joins headers and rows with CRLF', () => {
    const csv = buildCsv(['Data', 'Receita'], [['2026-06-01', '50.00']])

    expect(csv).toBe('Data,Receita\r\n2026-06-01,50.00')
  })

  it('wraps and escapes cells containing commas, quotes or newlines', () => {
    const csv = buildCsv(['Regiao'], [['Centro, "Sul"'], ['Linha\nQuebrada']])

    expect(csv).toBe('Regiao\r\n"Centro, ""Sul"""\r\n"Linha\nQuebrada"')
  })

  it('leaves plain numeric and text cells unquoted', () => {
    const csv = buildCsv(['Pedidos'], [[3]])

    expect(csv).toBe('Pedidos\r\n3')
  })
})
