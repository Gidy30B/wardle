import { FRACTIONAL_EPSILON } from './caseScene.constants'

export function formatAuditNumber(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'n/a'
  }

  return Number.isInteger(value) ? `${value}` : value.toFixed(2)
}

export function isFractionalValue(value: number | null | undefined) {
  return typeof value === 'number' && Math.abs(value - Math.round(value)) > FRACTIONAL_EPSILON
}
