import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import zh from './locales/zh.json';
import es from './locales/es.json';
import hi from './locales/hi.json';
import ar from './locales/ar.json';
import pt from './locales/pt.json';
import fr from './locales/fr.json';
import ru from './locales/ru.json';
import ja from './locales/ja.json';
import de from './locales/de.json';
import ko from './locales/ko.json';
import id from './locales/id.json';
import tr from './locales/tr.json';
import it from './locales/it.json';
import pl from './locales/pl.json';

export const SUPPORTED_LANGUAGES = {
  en: 'English',
  zh: '中文',
  es: 'Español',
  hi: 'हिन्दी',
  ar: 'العربية',
  pt: 'Português',
  fr: 'Français',
  ru: 'Русский',
  ja: '日本語',
  de: 'Deutsch',
  ko: '한국어',
  id: 'Bahasa Indonesia',
  tr: 'Türkçe',
  it: 'Italiano',
  pl: 'Polski',
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
      es: { translation: es },
      hi: { translation: hi },
      ar: { translation: ar },
      pt: { translation: pt },
      fr: { translation: fr },
      ru: { translation: ru },
      ja: { translation: ja },
      de: { translation: de },
      ko: { translation: ko },
      id: { translation: id },
      tr: { translation: tr },
      it: { translation: it },
      pl: { translation: pl },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already handles escaping
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'mpc-language',
      caches: ['localStorage'],
    },
  });

export default i18n;
