# Правила разработки — Help Desk Idle

## Код
- Swift API Design Guidelines; 4 пробела; один основной тип на файл; файл ≤ ~300 строк, иначе дробить.
- Вью без бизнес-логики: вся математика — в `Core/Economy`, мутации состояния — в `GameEngine`.
- Никаких магических чисел баланса в коде — только `jobs.json` / `GameConfig`.
- Никаких строк UI в коде без локализации.
- `print` не оставлять; для отладки — `Logger` (os.log) с категорией.
- Секреты (Supabase URL/key) — только в `Config/Secrets.xcconfig` (в .gitignore).
- Тесты пока не обязательны. Если пишем — начинаем с `Core/Economy` (чистые функции).

## Git
- Ветки: `main` (стабильная), `dev` (рабочая). Фичи можно коммитить прямо в `dev`; крупное — `feature/<коротко>` → PR в `dev`.
- `dev` → `main` только через Pull Request.
- Коммиты: Conventional Commits на английском: `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`, `refactor: ...`, `balance: ...` (правки чисел экономики).
- Автор коммитов — `Evgeniy <evgenyassylov@gmail.com>`. Никаких трейлеров `Co-Authored-By: Claude` / `Claude-Session` и подписей «Generated with Claude» в коммитах и описаниях PR.
- Не коммитить: `xcuserdata/`, `DerivedData/`, `.DS_Store`, `Secrets.xcconfig`.

## Работа с Claude
- В начале сессии — `CLAUDE.md`, дальше только нужный файл из `docs/`.
- Новое решение (стек, правило, баланс) → строчка в `docs/DECISIONS.md`.
- Меняешь баланс → обнови таблицу в `docs/ECONOMY.md` и `jobs.json` одновременно.
