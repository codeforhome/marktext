/**
 * WSL UNC path detection and normalization utilities.
 *
 * WSL UNC paths take one of two forms:
 *   \\wsl$\<distro>\<path>           (older Windows / WSL1)
 *   \\wsl.localhost\<distro>\<path>  (Windows 11+ / WSL2)
 *
 * These utilities help detect and normalize WSL UNC paths so the rest of the
 * codebase can compare, watch, and resolve them correctly on Windows.
 */

/**
 * Returns true if the path is a WSL UNC path starting with \\wsl$\ or \\wsl.localhost\.
 * Case-insensitive; handles both prefix forms.
 */
export const isWslUncPath = (p: string): boolean => {
  if (!p || typeof p !== 'string') return false
  return /^\\\\wsl(?:\$|\.localhost)\\/i.test(p)
}

/**
 * Extracts the WSL distribution name from a WSL UNC path.
 * Returns null if the path is not a WSL UNC path.
 *
 * Example: '\\wsl$\Ubuntu\home\user\file.md' → 'Ubuntu'
 * Example: '\\wsl.localhost\Debian\etc\hosts' → 'Debian'
 */
export const wslUncDistroName = (p: string): string | null => {
  if (!isWslUncPath(p)) return null
  const match = p.match(/^\\\\wsl(?:\$|\.localhost)\\([^\\]+)/i)
  return match ? match[1] : null
}

/**
 * Converts a WSL UNC path to a Linux-style absolute path by stripping the
 * \\wsl$\<distro> or \\wsl.localhost\<distro> prefix and converting
 * backslashes to forward slashes.
 *
 * Returns the path unchanged if it is not a WSL UNC path.
 *
 * Example: '\\wsl$\Ubuntu\home\user\file.md' → '/home/user/file.md'
 * Example: '\\wsl.localhost\Debian\etc\hosts' → '/etc/hosts'
 */
export const wslUncToLinuxPath = (p: string): string => {
  if (!isWslUncPath(p)) return p
  // Remove \\wsl$\DistroName or \\wsl.localhost\DistroName prefix
  const stripped = p.replace(/^\\\\wsl(?:\$|\.localhost)\\[^\\]+/i, '')
  // Convert remaining backslashes to forward slashes
  const converted = stripped.replace(/\\/g, '/')
  // Ensure the result starts with / (handles the case where nothing follows the distro)
  return converted || '/'
}

/**
 * Normalizes a WSL UNC path to the canonical \\wsl$\<distro>\<path> form by
 * converting the \\wsl.localhost\ prefix to \\wsl$\.
 *
 * Use this for path comparison so that \\wsl$\Ubuntu\... and
 * \\wsl.localhost\Ubuntu\... are treated as the same path.
 *
 * Returns non-WSL paths unchanged.
 */
export const normalizeWslPath = (p: string): string => {
  if (!isWslUncPath(p)) return p
  // Normalize \\wsl.localhost\ → \\wsl$\ for canonical representation
  return p.replace(/^\\\\wsl\.localhost\\/i, '\\\\wsl$\\')
}
