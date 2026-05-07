/**
 * ========================================
 * 🛠️ FORMATTERS UTILITY
 * ========================================
 *
 * Utility functions for formatting data in the customer-facing UI.
 * Provides consistent formatting for prices, dates, and other data.
 */

import { Logger } from '@/services/logger'

/**
 * Format price to Brazilian Real (BRL) currency
 *
 * @param price - Price as string or number
 * @returns Formatted price string (e.g., "R$ 99,90")
 */
export const formatBRL = (price: string | number): string => {
  const numericPrice = typeof price === 'string' ? parseFloat(price) : price

  if (isNaN(numericPrice)) {
    Logger.warn('Invalid price value received by formatBRL', { price })
    return 'R$ 0,00'
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericPrice)
}

/**
 * Format WhatsApp digits for compact Brazilian catalog display.
 */
export const formatWhatsAppPhone = (phoneDigits: string): string => {
  const digits = phoneDigits.replace(/\D/g, '')

  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }

  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  return phoneDigits
}

/**
 * Format date to Brazilian format
 *
 * @param dateString - ISO date string
 * @returns Formatted date string (e.g., "15/04/2024")
 */
export const formatDateBR = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) {
      throw new Error('Invalid date')
    }
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date)
  } catch (_error) {
    Logger.warn('Invalid date string received by formatDateBR', { dateString })
    return 'Data inválida'
  }
}

/**
 * Format relative time (e.g., "há 2 dias")
 *
 * @param dateString - ISO date string
 * @returns Relative time string
 */
export const formatRelativeTime = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) {
      throw new Error('Invalid date')
    }
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInDays === 0) return 'hoje'
    if (diffInDays === 1) return 'há 1 dia'
    if (diffInDays < 7) return `há ${diffInDays} dias`
    if (diffInDays < 30) return `há ${Math.floor(diffInDays / 7)} semanas`

    return formatDateBR(dateString)
  } catch (_error) {
    Logger.warn('Invalid date string received by formatRelativeTime', { dateString })
    return 'data inválida'
  }
}

/**
 * Truncate text with ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength).trim() + '...'
}

/**
 * Generate product URL slug
 *
 * @param productName - Product name
 * @param productId - Product ID
 * @returns URL-friendly slug
 */
export const generateProductSlug = (productName: string, productId: number): string => {
  const slug = productName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()

  return `${slug}-${productId}`
}
