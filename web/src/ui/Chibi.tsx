// Чиби-человечек гардероба: базовая фигура и слой на каждый слот; надетая вещь красится в цвет своей редкости.
// Геометрия — здесь, цвета — только токенами темы (классы chibi__* в styles.css).
import type { ComponentChildren } from 'preact'
import type { ItemDefinition, Slot } from '../core/content.ts'

type Worn = Partial<Record<Slot, ItemDefinition>>

export function Chibi({ worn: items }: { worn: Worn }) {
  const worn = (slot: Slot, layer: ComponentChildren) => {
    const item = items[slot]
    return item ? <g class={`chibi__slot rarity-fill--${item.rarity}`} data-slot={slot}>{layer}</g> : null
  }
  return (
    <svg viewBox="0 0 200 262" class="chibi" aria-hidden="true">
      <g>
        <rect class="chibi__skin" x="78" y="200" width="18" height="44" rx="8" />
        <rect class="chibi__skin" x="104" y="200" width="18" height="44" rx="8" />
        <rect class="chibi__shorts" x="72" y="190" width="56" height="24" rx="9" />
        <ellipse class="chibi__plain" cx="86" cy="248" rx="13" ry="7" />
        <ellipse class="chibi__plain" cx="114" cy="248" rx="13" ry="7" />
      </g>
      {worn('pants', (
        <>
          <rect class="chibi__paint" x="73" y="196" width="25" height="48" rx="8" />
          <rect class="chibi__paint" x="102" y="196" width="25" height="48" rx="8" />
          <rect class="chibi__paint" x="71" y="188" width="58" height="22" rx="9" />
          <path class="chibi__line" d="M100 196 V212" />
        </>
      ))}
      {worn('shoes', (
        <>
          <path class="chibi__paint" d="M70 250 C70 236 84 234 92 238 C98 241 102 246 102 250 Z" />
          <path class="chibi__paint" d="M98 250 C98 246 102 241 108 238 C116 234 130 236 130 250 Z" />
          <rect class="chibi__sole" x="68" y="247" width="36" height="7" rx="3.5" />
          <rect class="chibi__sole" x="96" y="247" width="36" height="7" rx="3.5" />
        </>
      ))}
      <g>
        <rect class="chibi__skin" x="52" y="138" width="17" height="48" rx="8.5" />
        <rect class="chibi__skin" x="131" y="138" width="17" height="48" rx="8.5" />
        <rect class="chibi__plain" x="68" y="130" width="64" height="66" rx="16" />
        <rect class="chibi__plain" x="50" y="136" width="21" height="20" rx="9" />
        <rect class="chibi__plain" x="129" y="136" width="21" height="20" rx="9" />
      </g>
      {worn('top', (
        <>
          <rect class="chibi__paint" x="49" y="134" width="22" height="50" rx="10" />
          <rect class="chibi__paint" x="129" y="134" width="22" height="50" rx="10" />
          <rect class="chibi__paint" x="66" y="128" width="68" height="70" rx="17" />
          <path class="chibi__line" d="M100 140 V196" />
          <path class="chibi__line" d="M78 176 H90 M110 176 H122" />
        </>
      ))}
      <g>
        <circle class="chibi__skin" cx="60" cy="190" r="9" />
        <circle class="chibi__skin" cx="140" cy="190" r="9" />
      </g>
      {worn('watch', (
        <>
          <rect class="chibi__paint" x="49" y="171" width="23" height="11" rx="3.5" />
          <circle class="chibi__white" cx="60.5" cy="176.5" r="6.5" />
        </>
      ))}
      {worn('accessory', (
        <>
          <path class="chibi__cord" d="M84 134 L100 162 L116 134" />
          <rect class="chibi__white" x="89" y="160" width="22" height="28" rx="3" />
          <rect class="chibi__paint chibi__flat" x="89.5" y="160.5" width="21" height="8" rx="2.5" />
          <circle class="chibi__skin" cx="100" cy="177" r="4" />
        </>
      ))}
      <g>
        <circle class="chibi__skin" cx="45" cy="88" r="10" />
        <circle class="chibi__skin" cx="155" cy="88" r="10" />
        <circle class="chibi__skin" cx="100" cy="80" r="56" />
        <path class="chibi__hair" d="M44 90 C38 40 66 18 100 18 C134 18 162 40 156 90 C152 72 144 62 132 58 C122 72 104 74 90 64 C78 74 60 76 44 90 Z" />
        <ellipse class="chibi__eye" cx="80" cy="94" rx="5.5" ry="7.5" />
        <ellipse class="chibi__eye" cx="120" cy="94" rx="5.5" ry="7.5" />
        <circle class="chibi__glint" cx="82" cy="91" r="2" />
        <circle class="chibi__glint" cx="122" cy="91" r="2" />
        <ellipse class="chibi__blush" cx="68" cy="110" rx="8" ry="4.5" />
        <ellipse class="chibi__blush" cx="132" cy="110" rx="8" ry="4.5" />
        <path class="chibi__mouth" d="M93 112 Q100 118 107 112" />
      </g>
      {worn('glasses', (
        <>
          <circle class="chibi__lens" cx="80" cy="94" r="14" />
          <circle class="chibi__lens" cx="120" cy="94" r="14" />
          <path class="chibi__frame" d="M94 94 H106 M66 92 L46 86 M134 92 L154 86" />
        </>
      ))}
      {worn('head', (
        <>
          <path class="chibi__paint" d="M40 76 C38 -4 162 -4 160 76 Z" />
          <path class="chibi__paint" d="M96 70 C130 62 160 64 178 76 C160 84 128 82 96 76 Z" />
          <path class="chibi__line" d="M100 18 V72 M68 28 C80 44 82 60 80 74 M132 28 C120 44 118 60 120 74" />
          <circle class="chibi__paint" cx="100" cy="17" r="5" />
        </>
      ))}
    </svg>
  )
}
