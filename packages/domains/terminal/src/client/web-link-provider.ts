import type { ILinkProvider, ILink, Terminal, IBufferLine } from '@xterm/xterm'

// From xterm.js addon-web-links — matches http:// and https:// URLs.
// Excludes unsafe chars from RFC 3986/1738, trailing punctuation, and brackets.
export const URL_REGEX = /(https?|HTTPS?):[/]{2}[^\s"'!*(){}|\\\^<>`]*[^\s"':,.!?{}|\\\^~\[\]`()<>]/

/**
 * Join wrapped lines around `lineIndex` into a single string for URL matching.
 * Stops expanding at whitespace boundaries or 2048 chars (same heuristic as xterm).
 * Returns [joinedText, topLineIndex].
 */
export function getWindowedLineStrings(lineIndex: number, terminal: Terminal): [string[], number] {
  let line: IBufferLine | undefined
  let topIdx = lineIndex
  let bottomIdx = lineIndex
  let length = 0
  let content = ''
  const lines: string[] = []

  if ((line = terminal.buffer.active.getLine(lineIndex))) {
    const currentContent = line.translateToString(true)

    // Expand upward through wrapped lines
    if (line.isWrapped && currentContent[0] !== ' ') {
      length = 0
      while ((line = terminal.buffer.active.getLine(--topIdx)) && length < 2048) {
        content = line.translateToString(true)
        length += content.length
        lines.push(content)
        if (!line.isWrapped || content.indexOf(' ') !== -1) break
      }
      lines.reverse()
    }

    lines.push(currentContent)

    // Expand downward through wrapped lines
    length = 0
    while ((line = terminal.buffer.active.getLine(++bottomIdx)) && line.isWrapped && length < 2048) {
      content = line.translateToString(true)
      length += content.length
      lines.push(content)
      if (content.indexOf(' ') !== -1) break
    }
  }
  return [lines, topIdx]
}

/**
 * Map a string index within the joined text back to a buffer position [lineIndex, columnIndex].
 * Both values are 0-based. Returns [-1, -1] if the line doesn't exist.
 */
export function mapStringIndex(terminal: Terminal, lineIndex: number, startCol: number, stringIndex: number): [number, number] {
  const buf = terminal.buffer.active
  let col = startCol
  while (stringIndex > 0) {
    const line = buf.getLine(lineIndex)
    if (!line) return [-1, -1]
    const lineLen = line.length
    const remaining = lineLen - col
    if (stringIndex < remaining) return [lineIndex, col + stringIndex]
    stringIndex -= remaining
    lineIndex++
    col = 0
  }
  return [lineIndex, col]
}

// Matches file paths with optional line:col suffix.
// Patterns: ./relative/path.ts, ../up/path.js, src/foo.tsx:42:10, /absolute/path.rs:10
// Requires a file extension to avoid false positives on plain words.
// The line:col suffix (:digits and optionally :digits) is captured but not part of the "file" match group.
export const FILE_REGEX = /(?<![:/\w.])(?:\.{1,2}\/[\w./-]+|[a-zA-Z][\w./-]*\/[\w./-]*\.[a-zA-Z]\w*|\/[\w./-]+\.[a-zA-Z]\w*)(?::(\d+)(?::(\d+))?)?/

export class FileLinkProvider implements ILinkProvider {
  constructor(
    private _terminal: Terminal,
    private _activate: (event: MouseEvent, filePath: string, line?: number, col?: number) => void
  ) {}

  provideLinks(bufferLineNumber: number, callback: (links: ILink[] | undefined) => void): void {
    const line = this._terminal.buffer.active.getLine(bufferLineNumber - 1)
    if (!line) {
      callback(undefined)
      return
    }

    // File links don't span wrapped lines — paths with spaces aren't matched anyway
    const text = line.translateToString(true)
    const regex = new RegExp(FILE_REGEX.source, 'g')
    const links: ILink[] = []
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      const fullMatch = match[0]
      const lineNum = match[1] ? parseInt(match[1], 10) : undefined
      const colNum = match[2] ? parseInt(match[2], 10) : undefined
      // Strip the :line:col suffix from the file path
      const filePath = lineNum !== undefined ? fullMatch.replace(/:\d+(?::\d+)?$/, '') : fullMatch
      const startX = match.index

      links.push({
        range: {
          start: { x: startX + 1, y: bufferLineNumber },
          end: { x: startX + fullMatch.length + 1, y: bufferLineNumber }
        },
        text: fullMatch,
        decorations: { underline: false, pointerCursor: true },
        activate: (event: MouseEvent) => this._activate(event, filePath, lineNum, colNum)
      })
    }

    callback(links.length > 0 ? links : undefined)
  }
}

export class WebLinkProvider implements ILinkProvider {
  constructor(
    private _terminal: Terminal,
    private _activate: (event: MouseEvent, uri: string) => void
  ) {}

  provideLinks(bufferLineNumber: number, callback: (links: ILink[] | undefined) => void): void {
    const lineIndex = bufferLineNumber - 1
    const [lines, topLineIndex] = getWindowedLineStrings(lineIndex, this._terminal)
    const joinedText = lines.join('')
    if (!joinedText) {
      callback(undefined)
      return
    }

    const regex = new RegExp(URL_REGEX.source, 'g')
    const links: ILink[] = []
    let match: RegExpExecArray | null

    while ((match = regex.exec(joinedText)) !== null) {
      const uri = match[0]

      const [startY, startX] = mapStringIndex(this._terminal, topLineIndex, 0, match.index)
      const [endY, endX] = mapStringIndex(this._terminal, topLineIndex, 0, match.index + uri.length)
      if (startY === -1 || endY === -1) continue

      links.push({
        range: {
          start: { x: startX + 1, y: startY + 1 },
          end: { x: endX, y: endY + 1 }
        },
        text: uri,
        decorations: { underline: false, pointerCursor: true },
        activate: (event: MouseEvent) => this._activate(event, uri)
      })
    }

    callback(links.length > 0 ? links : undefined)
  }
}
