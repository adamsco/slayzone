/**
 * Tests for WebLinkProvider (clickable URL detection in terminal)
 * Run with: npx tsx packages/domains/terminal/src/client/web-link-provider.test.ts
 */
import { URL_REGEX, FILE_REGEX, getWindowedLineStrings, mapStringIndex } from './web-link-provider'
import type { Terminal, IBufferLine } from '@xterm/xterm'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.log(`  ✗ ${name}`)
    console.log(`    ${e}`)
    failed++
  }
}

function assert(actual: unknown, expected: unknown, label?: string) {
  if (actual !== expected) {
    throw new Error(`${label ? label + ': ' : ''}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function assertDeep(actual: unknown, expected: unknown, label?: string) {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a !== b) {
    throw new Error(`${label ? label + ': ' : ''}expected ${b}, got ${a}`)
  }
}

function matchUrl(text: string): string | null {
  const m = text.match(URL_REGEX)
  return m ? m[0] : null
}

function matchAllUrls(text: string): string[] {
  const regex = new RegExp(URL_REGEX.source, 'g')
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) results.push(m[0])
  return results
}

// Mock terminal buffer for multi-line tests
function mockTerminal(lines: { text: string; isWrapped: boolean }[]): Terminal {
  const bufferLines = lines.map((l) => ({
    translateToString: () => l.text,
    isWrapped: l.isWrapped,
    length: l.text.length
  }))
  return {
    buffer: {
      active: {
        getLine: (i: number): IBufferLine | undefined =>
          i >= 0 && i < bufferLines.length ? (bufferLines[i] as unknown as IBufferLine) : undefined
      }
    }
  } as unknown as Terminal
}

// ─────────────────────────────────────
// URL_REGEX
// ─────────────────────────────────────
console.log('\nURL_REGEX matching')
console.log('─'.repeat(40))

test('matches https URL', () => {
  assert(matchUrl('visit https://example.com today'), 'https://example.com')
})

test('matches http URL', () => {
  assert(matchUrl('visit http://example.com today'), 'http://example.com')
})

test('matches URL with path', () => {
  assert(matchUrl('see https://github.com/xtermjs/xterm.js/issues/123'), 'https://github.com/xtermjs/xterm.js/issues/123')
})

test('matches URL with query string', () => {
  assert(matchUrl('go to https://example.com/search?q=test&page=1'), 'https://example.com/search?q=test&page=1')
})

test('matches URL with fragment', () => {
  assert(matchUrl('see https://example.com/docs#section'), 'https://example.com/docs#section')
})

test('matches URL with port', () => {
  assert(matchUrl('running at http://localhost:3000/api'), 'http://localhost:3000/api')
})

test('excludes trailing period', () => {
  assert(matchUrl('Visit https://example.com.'), 'https://example.com')
})

test('excludes trailing comma', () => {
  assert(matchUrl('See https://example.com, then'), 'https://example.com')
})

test('excludes trailing exclamation', () => {
  assert(matchUrl('Check https://example.com!'), 'https://example.com')
})

test('excludes trailing question mark', () => {
  assert(matchUrl('Is it https://example.com?'), 'https://example.com')
})

test('excludes trailing colon', () => {
  assert(matchUrl('Source: https://example.com:'), 'https://example.com')
})

test('excludes surrounding parens', () => {
  assert(matchUrl('(https://example.com)'), 'https://example.com')
})

test('excludes surrounding angle brackets', () => {
  assert(matchUrl('<https://example.com>'), 'https://example.com')
})

test('excludes surrounding square brackets', () => {
  assert(matchUrl('[https://example.com]'), 'https://example.com')
})

test('does not match ftp', () => {
  assert(matchUrl('ftp://example.com'), null)
})

test('does not match bare domain', () => {
  assert(matchUrl('example.com'), null)
})

test('does not match mailto', () => {
  assert(matchUrl('mailto:test@example.com'), null)
})

test('matches multiple URLs', () => {
  const urls = matchAllUrls('see https://a.com and http://b.com/path for details')
  assert(urls.length, 2)
  assert(urls[0], 'https://a.com')
  assert(urls[1], 'http://b.com/path')
})

test('matches URL in Claude Code output', () => {
  assert(matchUrl('  Created PR: https://github.com/org/repo/pull/42'), 'https://github.com/org/repo/pull/42')
})

test('matches URL in npm output', () => {
  assert(matchUrl('npm warn deprecated https://registry.npmjs.org/pkg'), 'https://registry.npmjs.org/pkg')
})

test('matches HTTPS (uppercase)', () => {
  assert(matchUrl('HTTPS://EXAMPLE.COM/PATH'), 'HTTPS://EXAMPLE.COM/PATH')
})

// ─────────────────────────────────────
// getWindowedLineStrings
// ─────────────────────────────────────
console.log('\ngetWindowedLineStrings')
console.log('─'.repeat(40))

test('single non-wrapped line', () => {
  const term = mockTerminal([{ text: 'hello world', isWrapped: false }])
  const [lines, topIdx] = getWindowedLineStrings(0, term)
  assertDeep(lines, ['hello world'])
  assert(topIdx, 0)
})

test('joins wrapped lines downward', () => {
  const term = mockTerminal([
    { text: 'https://example.com/very/lo', isWrapped: false },
    { text: 'ng/path/that/wraps', isWrapped: true }
  ])
  const [lines, topIdx] = getWindowedLineStrings(0, term)
  assertDeep(lines, ['https://example.com/very/lo', 'ng/path/that/wraps'])
  assert(topIdx, 0)
})

test('joins wrapped lines upward', () => {
  const term = mockTerminal([
    { text: 'https://example.com/very/lo', isWrapped: false },
    { text: 'ng/path/that/wraps', isWrapped: true }
  ])
  const [lines, topIdx] = getWindowedLineStrings(1, term)
  assertDeep(lines, ['https://example.com/very/lo', 'ng/path/that/wraps'])
  assert(topIdx, 0)
})

test('stops upward expansion at whitespace (includes stop line)', () => {
  const term = mockTerminal([
    { text: 'some text ', isWrapped: false },
    { text: 'https://example.com/lo', isWrapped: true },
    { text: 'ng/path', isWrapped: true }
  ])
  // Expands up through wrapped lines, stops at line with space but includes it (same as xterm)
  const [lines, topIdx] = getWindowedLineStrings(2, term)
  assertDeep(lines, ['some text ', 'https://example.com/lo', 'ng/path'])
  assert(topIdx, 0)
})

test('stops downward expansion at non-wrapped line', () => {
  const term = mockTerminal([
    { text: 'https://a.com/pa', isWrapped: false },
    { text: 'th', isWrapped: true },
    { text: 'next line', isWrapped: false }
  ])
  const [lines, topIdx] = getWindowedLineStrings(0, term)
  assertDeep(lines, ['https://a.com/pa', 'th'])
  assert(topIdx, 0)
})

test('three wrapped lines', () => {
  const term = mockTerminal([
    { text: 'https://example.', isWrapped: false },
    { text: 'com/a/b/c/d/e/f/', isWrapped: true },
    { text: 'g/h/i/j', isWrapped: true }
  ])
  const [lines, topIdx] = getWindowedLineStrings(1, term)
  assertDeep(lines, ['https://example.', 'com/a/b/c/d/e/f/', 'g/h/i/j'])
  assert(topIdx, 0)
})

// ─────────────────────────────────────
// mapStringIndex
// ─────────────────────────────────────
console.log('\nmapStringIndex')
console.log('─'.repeat(40))

test('maps index within first line', () => {
  const term = mockTerminal([
    { text: 'hello world', isWrapped: false }
  ])
  assertDeep(mapStringIndex(term, 0, 0, 5), [0, 5])
})

test('maps index that crosses to second line', () => {
  const term = mockTerminal([
    { text: '0123456789', isWrapped: false },
    { text: 'abcdef', isWrapped: true }
  ])
  // String index 12 = 10 chars into line 0, then 2 into line 1
  assertDeep(mapStringIndex(term, 0, 0, 12), [1, 2])
})

test('maps index at line boundary', () => {
  const term = mockTerminal([
    { text: '01234', isWrapped: false },
    { text: 'abcde', isWrapped: true }
  ])
  assertDeep(mapStringIndex(term, 0, 0, 5), [1, 0])
})

test('maps with startCol offset', () => {
  const term = mockTerminal([
    { text: '0123456789', isWrapped: false }
  ])
  assertDeep(mapStringIndex(term, 0, 3, 4), [0, 7])
})

test('returns [-1, -1] for out-of-bounds line', () => {
  const term = mockTerminal([
    { text: 'short', isWrapped: false }
  ])
  assertDeep(mapStringIndex(term, 0, 0, 100), [-1, -1])
})

test('maps across three lines', () => {
  const term = mockTerminal([
    { text: '12345', isWrapped: false },
    { text: '67890', isWrapped: true },
    { text: 'abcde', isWrapped: true }
  ])
  // Index 12 = 5 + 5 + 2 → line 2, col 2
  assertDeep(mapStringIndex(term, 0, 0, 12), [2, 2])
})

// ─────────────────────────────────────
// FILE_REGEX
// ─────────────────────────────────────
console.log('\nFILE_REGEX matching')
console.log('─'.repeat(40))

function matchFile(text: string): string | null {
  const m = text.match(FILE_REGEX)
  return m ? m[0] : null
}

function matchAllFiles(text: string): string[] {
  const regex = new RegExp(FILE_REGEX.source, 'g')
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) results.push(m[0])
  return results
}

// Relative paths
test('matches relative path with extension', () => {
  assert(matchFile('error in src/index.ts here'), 'src/index.ts')
})

test('matches dotslash relative path', () => {
  assert(matchFile('see ./src/main.tsx for details'), './src/main.tsx')
})

test('matches dot-dot relative path', () => {
  assert(matchFile('from ../utils/helper.js:'), '../utils/helper.js')
})

// With line:col
test('matches file:line', () => {
  assert(matchFile('src/index.ts:42'), 'src/index.ts:42')
})

test('matches file:line:col', () => {
  assert(matchFile('src/index.ts:42:10'), 'src/index.ts:42:10')
})

// Absolute paths
test('matches absolute path', () => {
  assert(matchFile('reading /Users/foo/project/main.rs'), '/Users/foo/project/main.rs')
})

test('matches absolute path with line:col', () => {
  assert(matchFile('/home/user/app.py:100:5'), '/home/user/app.py:100:5')
})

// Nested paths
test('matches deeply nested path', () => {
  assert(matchFile('packages/domains/terminal/src/client/Terminal.tsx'), 'packages/domains/terminal/src/client/Terminal.tsx')
})

// Real terminal output patterns
test('matches TypeScript error output', () => {
  assert(matchFile('src/App.tsx(89,7): error TS6133'), 'src/App.tsx')
})

test('matches Rust compiler output', () => {
  assert(matchFile('error[E0308]: src/lib.rs:15:5'), 'src/lib.rs:15:5')
})

test('matches go vet output', () => {
  assert(matchFile('pkg/server/handler.go:42:15: undefined'), 'pkg/server/handler.go:42:15')
})

// Non-matches
test('does not match plain words', () => {
  assert(matchFile('hello world'), null)
})

test('does not match URL (handled by WebLinkProvider)', () => {
  assert(matchFile('https://example.com/path.html'), null)
})

test('does not match path without extension', () => {
  assert(matchFile('src/utils/helpers'), null)
})

// Multiple files in one line
test('matches multiple files', () => {
  const files = matchAllFiles('diff src/a.ts src/b.ts')
  assert(files.length, 2)
  assert(files[0], 'src/a.ts')
  assert(files[1], 'src/b.ts')
})

console.log('─'.repeat(40))
console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
