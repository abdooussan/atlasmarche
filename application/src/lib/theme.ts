export const colors = {
  primary: '#C1272D',
  primaryDark: '#8E1B20',
  primarySoft: '#FBE9EA',
  background: '#F5F6F3',
  surface: '#FFFFFF',
  text: '#15211B',
  muted: '#55615A',
  border: '#E2E5E0',
  borderStrong: '#C9CFC9',
  divider: '#EEF0EC',
  neutralSoft: '#F0F2EE',
  warning: '#9A4A08',
  warningDark: '#5E2D04',
  warningSoft: '#FDF0E1',
  danger: '#B42318',
};

export type Categorie = 'Travaux' | 'Fournitures' | 'Services';

export const CATEGORIES: Categorie[] = ['Travaux', 'Fournitures', 'Services'];

export const categoryStyle: Record<string, { bg: string; fg: string; icon: 'business-outline' | 'cube-outline' | 'briefcase-outline' }> = {
  Travaux: { bg: '#E6EEF8', fg: '#1F4E8C', icon: 'business-outline' },
  Fournitures: { bg: '#E3F0E9', fg: '#0E6B47', icon: 'cube-outline' },
  Services: { bg: '#F0EAF8', fg: '#6B3FA0', icon: 'briefcase-outline' },
};

export const fallbackCategory = { bg: colors.neutralSoft, fg: '#3B463F', icon: 'document-outline' as const };

export const radius = { sm: 6, md: 10, lg: 14 };
