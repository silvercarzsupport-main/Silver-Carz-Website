import { describe, expect, it } from 'vitest';

import { contactConfig, contactWhatsappLink } from '@/config/contact';

describe('contactConfig', () => {
  it('exposes the public phone, email, and Instagram', () => {
    expect(contactConfig.phoneHref).toBe('tel:+919028468412');
    expect(contactConfig.email).toBe('silvercarzsupport@gmail.com');
    expect(contactConfig.instagramUrl).toBe('https://www.instagram.com/silvercarzz/');
    expect(contactWhatsappLink('Hello').startsWith('https://wa.me/919028468412?text=')).toBe(true);
  });
});
