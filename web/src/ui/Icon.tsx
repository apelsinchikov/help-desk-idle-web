/** Картинка из IconProvider; нет файла — пустая плашка того же размера. */
export function Icon({ src, class: cls }: { src: string; class?: string }) {
  return src ? <img src={src} class={cls} alt="" draggable={false} /> : <span class={cls} />
}
