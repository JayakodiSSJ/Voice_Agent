export type AgentState = 'idle' | 'recording' | 'thinking' | 'speaking';
export type AppLanguage = 'en' | 'si' | 'ta';

export interface Turn {
  id: number;
  heard: string;
  answer: string;
  lang: AppLanguage;
  file?: { name: string; type: string };
  timestamp: Date;
}

export interface LanguageConfig {
  code: AppLanguage;
  bcp47: string;
  nativeLabel: string;
  flag: string;
}

export const LANGUAGES: Record<AppLanguage, LanguageConfig> = {
  en: { code: 'en', bcp47: 'en-US', nativeLabel: 'English', flag: '🇬🇧' },
  si: { code: 'si', bcp47: 'si-LK', nativeLabel: 'සිංහල', flag: '🇱🇰' },
  ta: { code: 'ta', bcp47: 'ta-LK', nativeLabel: 'தமிழ்', flag: '🇱🇰' },
};