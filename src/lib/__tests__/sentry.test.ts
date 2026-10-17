import { REDACTED, scrubBreadcrumb, scrubEvent, scrubText, scrubValue } from '../sentry';

describe('sentry scrubber', () => {
  it('removes emails, phone numbers and JWTs from text', () => {
    const text =
      'Contact dana@example.com or +1 (555) 123-4567 token eyJabcdefghijk.abcdefghijklm.abcdefghijklmn';
    const out = scrubText(text);
    expect(out).not.toContain('dana@example.com');
    expect(out).not.toContain('555');
    expect(out).not.toContain('eyJ');
    expect(out.match(/\[redacted\]/g)?.length).toBe(3);
  });

  it('redacts sensitive keys anywhere in nested data', () => {
    const out = scrubValue({
      medication: 'Lisinopril 10mg',
      nested: { transcript: 'the doctor said', ok: 'fine', patient_email: 'x@y.org' },
      list: [{ dose: '5 mg' }],
    }) as Record<string, unknown>;
    expect(out.medication).toBe(REDACTED);
    expect((out.nested as Record<string, unknown>).transcript).toBe(REDACTED);
    expect((out.nested as Record<string, unknown>).ok).toBe('fine');
    expect((out.nested as Record<string, unknown>).patient_email).toBe(REDACTED);
    expect((out.list as Record<string, unknown>[])[0]?.dose).toBe(REDACTED);
  });

  it('strips request data and user details from events', () => {
    const event = scrubEvent({
      message: 'failed for dana@example.com',
      request: { url: 'https://x/rest/v1/medications?select=*' },
      user: { id: 'u1', email: 'dana@example.com', ip_address: '1.2.3.4' },
      extra: { notes: 'private', count: 2 },
      exception: { values: [{ value: 'Error: sam@example.com' }] },
    } as never) as Record<string, unknown>;
    expect(event.request).toBeUndefined();
    expect(event.user).toEqual({ id: 'u1' });
    expect((event.extra as Record<string, unknown>).notes).toBe(REDACTED);
    expect((event.extra as Record<string, unknown>).count).toBe(2);
    expect(event.message).not.toContain('@');
    expect((event.exception as { values: { value: string }[] }).values[0]?.value).not.toContain(
      '@',
    );
  });

  it('reduces network breadcrumbs to method and status', () => {
    const crumb = scrubBreadcrumb({
      category: 'fetch',
      message: 'GET https://x/rest/v1/medications?circle_id=abc',
      data: { method: 'GET', status_code: 200, url: 'https://x/rest/v1/medications?circle_id=abc' },
    });
    expect(crumb?.message).toBeUndefined();
    expect(crumb?.data).toEqual({ method: 'GET', status_code: 200 });
  });
});
