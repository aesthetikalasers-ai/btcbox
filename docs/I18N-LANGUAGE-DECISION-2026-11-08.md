# BTCBOX language scope decision — 2026-11-08

## Owner-confirmed official locales

The official BTCBOX product language selector must expose exactly these seven locales:

| Locale | Language | Locale tag |
|---|---|---|
| `ja` | Japanese (日本語) | `ja-JP` |
| `en` | English | `en-US` |
| `zh-CN` | Simplified Chinese (简体中文) | `zh-CN` |
| `es` | Spanish (Español) | `es-ES` |
| `pt` | Portuguese (Português) | `pt-PT` |
| `it` | Italian (Italiano) | `it-IT` |
| `de` | German (Deutsch) | `de-DE` |

Vietnamese (`vi`) is not part of the official seven-language selector.

## Preservation rule

Existing Vietnamese translations and any already completed localization work must be preserved. Do not delete the Vietnamese dictionary or discard existing translations merely because Vietnamese is not in the official selector. It may remain as a legacy/optional locale in source while the product's official language list and default selector are limited to the seven owner-confirmed locales.

## Implementation requirements

- Add and complete a German dictionary; do not label English fallback text as German.
- Update the Language type, locale tag map, language selector options, saved-language validation, and locale completeness checker consistently.
- Keep existing Japanese, English, Simplified Chinese, Spanish, Portuguese, and Italian translations intact.
- Preserve language persistence across reloads and set the document `lang` attribute correctly.
- Audit all customer-facing routes and Admin Panel strings, including navigation, forms, validation, empty/loading/error states, dialogs, and operational status messages.
- Report translation coverage per official locale. Missing German translations must remain visible as incomplete; do not claim completion based only on fallback behavior.
- No production deployment or merge to `main` is authorized by this language-scope decision.
