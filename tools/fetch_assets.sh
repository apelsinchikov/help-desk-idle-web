#!/usr/bin/env bash
# Скачивает иконки Microsoft Fluent Emoji 3D (MIT) и шрифты Unbounded / Manrope (OFL).
# Запуск из корня репозитория:  bash tools/fetch_assets.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/HelpDeskIdle/HelpDeskIdle"
ICONS="$APP/Assets.xcassets/Icons"
FONTS="$APP/Fonts"
FLUENT="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets"
mkdir -p "$ICONS" "$FONTS"
printf '{\n  "info" : { "author" : "xcode", "version" : 1 }\n}\n' > "$ICONS/Contents.json"

fetch_icon() { # $1 = iconKey, $2 = путь внутри fluentui-emoji/assets
  local dir="$ICONS/fluent3d_$1.imageset"
  mkdir -p "$dir"
  local url="$FLUENT/$(echo "$2" | sed 's/ /%20/g')"
  if curl -fsSL "$url" -o "$dir/$1.png"; then
    printf '{\n  "images" : [ { "filename" : "%s.png", "idiom" : "universal" } ],\n  "info" : { "author" : "xcode", "version" : 1 }\n}\n' "$1" > "$dir/Contents.json"
    echo "ok   $1"
  else
    echo "FAIL $1  ($url)"; rm -rf "$dir"
  fi
}

fetch_icon reboot              "Electric plug/3D/electric_plug_3d.png"
fetch_icon plug_mouse          "Computer mouse/3D/computer_mouse_3d.png"
fetch_icon accounting_printer  "Printer/3D/printer_3d.png"
fetch_icon escalate            "Outbox tray/3D/outbox_tray_3d.png"
fetch_icon works_on_my_machine "Laptop/3D/laptop_3d.png"
fetch_icon button_color_call   "Artist palette/3D/artist_palette_3d.png"
fetch_icon accounting_1c       "Receipt/3D/receipt_3d.png"
fetch_icon friday_deploy       "Fire/3D/fire_3d.png"
fetch_icon spec_like_apple     "Clipboard/3D/clipboard_3d.png"
fetch_icon regression          "Lady beetle/3D/lady_beetle_3d.png"
fetch_icon ai_everything       "Robot/3D/robot_3d.png"
fetch_icon ddos_rivals         "Comet/3D/comet_3d.png"
fetch_icon avatar              "Technologist/Default/3D/technologist_3d_default.png"
fetch_icon lock                "Locked/3D/locked_3d.png"

GF="https://raw.githubusercontent.com/google/fonts/main/ofl"
curl -fsSL "$GF/unbounded/Unbounded%5Bwght%5D.ttf" -o "$FONTS/Unbounded.ttf" && echo "ok   Unbounded" || echo "FAIL Unbounded"
curl -fsSL "$GF/manrope/Manrope%5Bwght%5D.ttf"     -o "$FONTS/Manrope.ttf"   && echo "ok   Manrope"   || echo "FAIL Manrope"

cat > "$APP/LICENSES.md" <<'LIC'
# Сторонние ресурсы
- Иконки: Microsoft Fluent Emoji — MIT License, https://github.com/microsoft/fluentui-emoji
- Шрифты: Unbounded, Manrope — SIL Open Font License 1.1, https://github.com/google/fonts
LIC
echo "Готово. Вернись в Xcode — новые файлы подхватятся сами."
