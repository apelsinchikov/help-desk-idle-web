// IconProvider: единственная точка доступа к иконкам. Смена пака = другая папка/префикс здесь.
const pack = 'fluent3d'

const files = import.meta.glob<string>(
  '../../../HelpDeskIdle/HelpDeskIdle/Assets.xcassets/Icons/*.imageset/*.png',
  { eager: true, query: '?url', import: 'default' },
)

const byKey: Record<string, string> = {}
for (const [path, url] of Object.entries(files)) {
  const match = path.match(/\/([a-z0-9]+)_([a-z0-9_]+)\.imageset\//)
  if (match && match[1] === pack) byKey[match[2]] = url
}

/** URL картинки по iconKey из jobs.json; '' — иконки нет (UI рисует пустую плашку). */
export function iconUrl(iconKey: string): string {
  return byKey[iconKey] ?? ''
}
