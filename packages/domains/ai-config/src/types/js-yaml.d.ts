declare module 'js-yaml' {
  export interface YAMLException extends Error {
    reason?: string
    mark?: {
      line?: number
      column?: number
    }
  }

  export function load(content: string): unknown
}
