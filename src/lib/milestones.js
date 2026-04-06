import milestonesData from '../../milestones.json'

export const milestones = milestonesData.milestones

/**
 * Unique releases for the Mission Control selector.
 * Deduplicates by release codename — if multiple milestone entries exist
 * for the same release (Alpha, Beta, RC…), the last one wins so we always
 * use the most recent build list and mandatory flags.
 */
export const releases = Object.values(
  milestonesData.milestones.reduce((acc, ms) => {
    acc[ms.release] = ms
    return acc
  }, {}),
)

/** Maps project names to their OS filter string used in the Test Observer API. */
const PROJECT_OS = {
  ubuntu:         'ubuntu-desktop',
  edubuntu:       'edubuntu',
  kubuntu:        'kubuntu',
  lubuntu:        'lubuntu',
  'ubuntu-base':  null,
  'ubuntu-budgie': 'ubuntu-budgie',
  'ubuntu-unity': 'ubuntu-unity',
  ubuntucinnamon: 'ubuntucinnamon',
  ubuntustudio:   'ubuntustudio',
  xubuntu:        'xubuntu',
  'ubuntu-mate':  'ubuntu-mate',
  ubuntukylin:    'ubuntukylin',
}

/**
 * Derives the artifact filename and OS filter for a given build spec.
 * Returns { name: string|null, osFilter: string|null }
 */
export function deriveArtifact(release, { project, arch, type }) {
  const os = PROJECT_OS[project] ?? null

  if (project === 'ubuntu-base')
    return { name: `${release}-base-${arch}.tar.gz`, osFilter: null }

  if (type === 'desktop')
    return { name: `${release}-desktop-${arch}.iso`, osFilter: os }

  if (project === 'ubuntu') {
    const nameMap = {
      'live-server':          `${release}-live-server-${arch}.iso`,
      'preinstalled-desktop': `${release}-preinstalled-desktop-${arch}.img.xz`,
      'preinstalled-server':  `${release}-preinstalled-server-${arch}.img.xz`,
      wsl:                    `${release}-wsl-${arch}.wsl`,
      minimal:                `${release}-minimal-${arch}.iso`,
      mini:                   `${release}-mini-iso-${arch}.iso`,
    }
    return { name: nameMap[type] ?? null, osFilter: null }
  }

  if (type === 'preinstalled-desktop')
    return { name: `${release}-preinstalled-desktop-${arch}.img.xz`, osFilter: os }

  if (type === 'minimal')
    return { name: `${release}-minimal-${arch}.iso`, osFilter: os }

  return { name: null, osFilter: null }
}

/**
 * Returns a Set of "name||osFilter" keys for all mandatory builds
 * in the given milestone.
 */
export function buildMandatorySet(milestone) {
  const keys = new Set()
  for (const build of milestone.builds) {
    if (!build.mandatory) continue
    const { name, osFilter } = deriveArtifact(milestone.release, build)
    if (name) keys.add(`${name}||${osFilter ?? ''}`)
  }
  return keys
}
