/**
 * Prompt Injection & Jailbreak Detection
 * Scans user input for common injection attacks before sending to AI.
 */

// Tier 1: Hard-block — definitely malicious
const BLOCK_PATTERNS = [
  // Classic injection openers
  /ignore\s+(all\s+)?previous\s+instructions?/i,
  /disregard\s+(all\s+)?previous\s+instructions?/i,
  /forget\s+(all\s+)?previous\s+instructions?/i,
  /override\s+(all\s+)?previous\s+instructions?/i,

  // Role hijacking
  /you\s+are\s+now\s+(a|an|the)\s+/i,
  /act\s+as\s+(a|an|the)?\s*(unrestricted|uncensored|evil|jailbreak|DAN)/i,
  /pretend\s+(you\s+are|to\s+be)\s+(a|an|the)?\s*(unrestricted|uncensored|evil)/i,
  /switch\s+to\s+(developer|jailbreak|DAN)\s+mode/i,

  // DAN / known jailbreaks
  /\bDAN\b.*jailbreak/i,
  /do\s+anything\s+now/i,
  /jailbreak(ed|ing)?\s+(mode|prompt|gpt|llm)/i,

  // System prompt extraction
  /reveal\s+your\s+(system\s+)?(prompt|instructions?|context)/i,
  /print\s+your\s+(system\s+)?(prompt|instructions?)/i,
  /what\s+(is|are)\s+your\s+(system\s+)?(prompt|instructions?|context)/i,
  /output\s+(the\s+)?(above|your|full|entire)\s+(text|instructions?|prompt|context)/i,

  // Delimiter injection
  /\]\]\]\s*\[\[\[/,          // closing/opening of context brackets
  /<\|im_end\|>/i,            // OpenAI chat template tokens
  /<\|im_start\|>\s*system/i,
  /\[INST\].*\[\/INST\]/i,   // Llama instruction tokens

  // Indirect injection via crafted content
  /new\s+conversation\s+starts?\s+here/i,
  /---\s*(new|fresh)\s+(session|context|prompt)\s*---/i
]

// Tier 2: Warn — suspicious but may be legitimate
const WARN_PATTERNS = [
  /as\s+(a|an)\s+(AI|language model)/i,
  /bypass\s+(safety|filter|guard|restriction)/i,
  /without\s+(any\s+)?(restriction|limit|filter|guardrail)/i,
  /in\s+a\s+(fictional|hypothetical)\s+(scenario|world)\s+where/i,
  /for\s+(educational|research)\s+purposes?\s+only/i,
  /step[\s-]by[\s-]step\s+instructions?\s+(to\s+)?(hack|exploit|attack|crack)/i,
  /simulate\s+(being|an?\s+AI|a\s+chatbot)\s+(without|that\s+has\s+no)/i
]

/**
 * Check a message for prompt injection.
 * @param {string} text
 * @returns {{ blocked: boolean, warned: boolean, reason: string|null, severity: 'block'|'warn'|'safe' }}
 */
export function checkPromptInjection(text) {
  for (const pattern of BLOCK_PATTERNS) {
    if (pattern.test(text)) {
      return {
        blocked: true,
        warned: false,
        severity: 'block',
        reason: `Blocked: message matches known prompt injection pattern.`
      }
    }
  }

  for (const pattern of WARN_PATTERNS) {
    if (pattern.test(text)) {
      return {
        blocked: false,
        warned: true,
        severity: 'warn',
        reason: `Warning: message contains language associated with prompt manipulation attempts.`
      }
    }
  }

  return { blocked: false, warned: false, severity: 'safe', reason: null }
}

/**
 * Sanitize a message by stripping known injection tokens/delimiters.
 * Safe to run on all messages as a preprocessing step.
 * @param {string} text
 * @returns {string}
 */
export function sanitizeMessage(text) {
  return text
    .replace(/<\|im_start\|>.*?<\|im_end\|>/gis, '')   // OpenAI template tokens
    .replace(/\[INST\]|\[\/INST\]/gi, '')                // Llama tokens
    .replace(/<<SYS>>.*?<<\/SYS>>/gis, '')              // Llama system tags
    .replace(/\u0000/g, '')                              // Null bytes
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')       // Unicode directional overrides (invisible text attacks)
    .trim()
}
