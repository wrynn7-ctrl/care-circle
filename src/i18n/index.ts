import en from './en.json';

type Dictionary = typeof en;
export type TranslationKey = keyof Dictionary;

const dictionaries: Record<string, Dictionary> = { en };
let activeLocale = 'en';

export function setLocale(locale: string): void {
  if (dictionaries[locale]) activeLocale = locale;
}

/**
 * Minimal translation helper. All user-facing copy goes through here so a second locale is a new JSON
 * file, not a code change. `{{name}}` placeholders are replaced from `vars`.
 */
export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  const dict = dictionaries[activeLocale] ?? en;
  let text: string = dict[key] ?? en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{{${name}}}`, String(value));
    }
  }
  return text;
}
