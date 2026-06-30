/**
 * PII Detection & Redaction
 * Scans text for common PII patterns and redacts them before sending to AI.
 */

const PII_PATTERNS = [
  // Email addresses
  {
    name: 'EMAIL',
    regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    replace: '[EMAIL REDACTED]'
  },
  // Phone numbers (international + US formats)
  {
    name: 'PHONE',
    regex: /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/g,
    replace: '[PHONE REDACTED]'
  },
  // Credit card numbers (Visa, MC, Amex, Discover)
  {
    name: 'CREDIT_CARD',
    regex: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{3,4}\b/g,
    replace: '[CREDIT CARD REDACTED]'
  },
  // US Social Security Numbers
  {
    name: 'SSN',
    regex: /\b\d{3}[\s\-]?\d{2}[\s\-]?\d{4}\b/g,
    replace: '[SSN REDACTED]'
  },
  // IP addresses
  {
    name: 'IP_ADDRESS',
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    replace: '[IP REDACTED]'
  },
  // Passport numbers (generic: 1-2 letters + 6-9 digits)
  {
    name: 'PASSPORT',
    regex: /\b[A-Z]{1,2}\d{6,9}\b/g,
    replace: '[PASSPORT REDACTED]'
  },
  // IBAN (bank account)
  {
    name: 'IBAN',
    regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7,}(?:[A-Z0-9]?\d{0,3}){0,3}\b/g,
    replace: '[IBAN REDACTED]'
  },
  // UAE National ID (15 digits starting with 784)
  {
    name: 'UAE_ID',
    regex: /\b784[\s\-]?\d{4}[\s\-]?\d{7}[\s\-]?\d{1}\b/g,
    replace: '[NATIONAL ID REDACTED]'
  }
]

/**
 * Scan text and return detected PII types (without redacting).
 * @param {string} text
 * @returns {{ detected: string[], hasPii: boolean }}
 */
export function scanPii(text) {
  const detected = []
  for (const pattern of PII_PATTERNS) {
    const clone = new RegExp(pattern.regex.source, pattern.regex.flags)
    if (clone.test(text)) {
      detected.push(pattern.name)
    }
  }
  return { detected, hasPii: detected.length > 0 }
}

/**
 * Redact all detected PII from text.
 * @param {string} text
 * @returns {{ redacted: string, types: string[], count: number }}
 */
export function redactPii(text) {
  let redacted = text
  const types = []
  let count = 0

  for (const pattern of PII_PATTERNS) {
    const clone = new RegExp(pattern.regex.source, pattern.regex.flags)
    const matches = redacted.match(clone)
    if (matches) {
      types.push(pattern.name)
      count += matches.length
      redacted = redacted.replace(clone, pattern.replace)
    }
  }

  return { redacted, types, count }
}
