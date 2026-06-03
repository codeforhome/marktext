import { describe, it, expect } from 'vitest'
import {
  isWslUncPath,
  wslUncDistroName,
  wslUncToLinuxPath,
  normalizeWslPath
} from 'common/filesystem/wsl'

// NOTE: In JavaScript string literals, \\ is a single backslash.
// So '\\\\wsl$\\Ubuntu\\...' is the actual string \\wsl$\Ubuntu\...
// which is the Windows UNC form of a WSL path.

describe('isWslUncPath', () => {
  it('detects \\\\wsl$\\ paths', () => {
    expect(isWslUncPath('\\\\wsl$\\Ubuntu\\home\\user\\file.md')).toBe(true)
  })

  it('detects \\\\wsl.localhost\\ paths', () => {
    expect(isWslUncPath('\\\\wsl.localhost\\Ubuntu\\home\\user\\file.md')).toBe(true)
  })

  it('is case-insensitive on the prefix', () => {
    expect(isWslUncPath('\\\\WSL$\\Ubuntu\\home\\user\\file.md')).toBe(true)
    expect(isWslUncPath('\\\\WSL.LOCALHOST\\Ubuntu\\home\\user\\file.md')).toBe(true)
  })

  it('returns false for normal Windows paths', () => {
    expect(isWslUncPath('C:\\Users\\user\\file.md')).toBe(false)
    expect(isWslUncPath('D:\\projects\\notes.md')).toBe(false)
  })

  it('returns false for Linux paths', () => {
    expect(isWslUncPath('/home/user/file.md')).toBe(false)
    expect(isWslUncPath('/etc/hosts')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isWslUncPath('')).toBe(false)
  })

  it('returns false for null and undefined', () => {
    expect(isWslUncPath(null as unknown as string)).toBe(false)
    expect(isWslUncPath(undefined as unknown as string)).toBe(false)
  })

  it('returns false for regular UNC server paths (not WSL)', () => {
    expect(isWslUncPath('\\\\server\\share\\file.md')).toBe(false)
    expect(isWslUncPath('\\\\192.168.1.1\\share\\file.txt')).toBe(false)
  })

  it('requires a backslash after the prefix (not just \\\\wsl$)', () => {
    // \\wsl$ without trailing backslash is not a valid WSL path
    expect(isWslUncPath('\\\\wsl$')).toBe(false)
    expect(isWslUncPath('\\\\wsl.localhost')).toBe(false)
  })
})

describe('wslUncDistroName', () => {
  it('extracts distro from \\\\wsl$\\ path', () => {
    expect(wslUncDistroName('\\\\wsl$\\Ubuntu\\home\\user\\file.md')).toBe('Ubuntu')
  })

  it('extracts distro from \\\\wsl.localhost\\ path', () => {
    expect(wslUncDistroName('\\\\wsl.localhost\\Debian\\etc\\hosts')).toBe('Debian')
  })

  it('handles distro name with hyphens and dots', () => {
    expect(wslUncDistroName('\\\\wsl$\\Ubuntu-22.04\\home\\user')).toBe('Ubuntu-22.04')
  })

  it('returns null for non-WSL Windows paths', () => {
    expect(wslUncDistroName('C:\\Users\\user\\file.md')).toBeNull()
  })

  it('returns null for Linux paths', () => {
    expect(wslUncDistroName('/home/user/file.md')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(wslUncDistroName('')).toBeNull()
  })

  it('returns just the distro (no trailing path segment)', () => {
    const result = wslUncDistroName('\\\\wsl$\\Ubuntu\\a\\b\\c\\d.md')
    expect(result).toBe('Ubuntu')
    expect(result).not.toContain('\\')
  })
})

describe('wslUncToLinuxPath', () => {
  it('converts \\\\wsl$\\ path to Linux path', () => {
    expect(wslUncToLinuxPath('\\\\wsl$\\Ubuntu\\home\\user\\file.md')).toBe('/home/user/file.md')
  })

  it('converts \\\\wsl.localhost\\ path to Linux path', () => {
    expect(wslUncToLinuxPath('\\\\wsl.localhost\\Debian\\etc\\hosts')).toBe('/etc/hosts')
  })

  it('preserves deep nested paths', () => {
    expect(
      wslUncToLinuxPath('\\\\wsl$\\Ubuntu\\home\\user\\projects\\docs\\notes.md')
    ).toBe('/home/user/projects/docs/notes.md')
  })

  it('returns "/" when only the distro prefix is present', () => {
    // \\wsl$\Ubuntu\ → strip distro → \ → convert → /
    expect(wslUncToLinuxPath('\\\\wsl$\\Ubuntu\\')).toBe('/')
  })

  it('returns non-WSL Windows paths unchanged', () => {
    const win = 'C:\\Users\\user\\file.md'
    expect(wslUncToLinuxPath(win)).toBe(win)
  })

  it('returns Linux paths unchanged', () => {
    const linux = '/home/user/file.md'
    expect(wslUncToLinuxPath(linux)).toBe(linux)
  })
})

describe('normalizeWslPath', () => {
  it('normalizes \\\\wsl.localhost\\ to \\\\wsl$\\ prefix', () => {
    expect(normalizeWslPath('\\\\wsl.localhost\\Ubuntu\\home\\user\\file.md')).toBe(
      '\\\\wsl$\\Ubuntu\\home\\user\\file.md'
    )
  })

  it('leaves \\\\wsl$\\ paths unchanged', () => {
    const path = '\\\\wsl$\\Ubuntu\\home\\user\\file.md'
    expect(normalizeWslPath(path)).toBe(path)
  })

  it('returns non-WSL Windows paths unchanged', () => {
    const win = 'C:\\Users\\user\\file.md'
    expect(normalizeWslPath(win)).toBe(win)
  })

  it('returns Linux paths unchanged', () => {
    const linux = '/home/user/file.md'
    expect(normalizeWslPath(linux)).toBe(linux)
  })

  it('returns empty string unchanged', () => {
    expect(normalizeWslPath('')).toBe('')
  })

  it('makes \\\\wsl$\\ and \\\\wsl.localhost\\ the same path after normalization', () => {
    const wslDollar = '\\\\wsl$\\Ubuntu\\home\\user\\file.md'
    const wslLocalhost = '\\\\wsl.localhost\\Ubuntu\\home\\user\\file.md'
    expect(normalizeWslPath(wslDollar)).toBe(normalizeWslPath(wslLocalhost))
  })
})
