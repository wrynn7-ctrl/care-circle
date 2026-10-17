import { t } from '..';

describe('i18n', () => {
  it('returns copy and fills placeholders', () => {
    expect(t('common.continue')).toBe('Continue');
    expect(t('verify.subtitle', { email: 'a@b.c' })).toContain('a@b.c');
  });
});
