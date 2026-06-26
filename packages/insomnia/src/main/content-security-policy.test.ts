import { describe, expect, it } from 'vitest';

import {
  CONTENT_SECURITY_POLICY_REPORT_ONLY,
  CSP_HEADER_NAME,
  withContentSecurityPolicy,
} from './content-security-policy';

describe('content security policy', () => {
  it('ships in report-only mode so it cannot block flows', () => {
    expect(CSP_HEADER_NAME).toBe('Content-Security-Policy-Report-Only');
  });

  it('includes the core directives', () => {
    expect(CONTENT_SECURITY_POLICY_REPORT_ONLY).toContain("default-src 'self'");
    expect(CONTENT_SECURITY_POLICY_REPORT_ONLY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY_REPORT_ONLY).toContain("base-uri 'self'");
  });

  it('applies the policy onto document headers without dropping existing ones', () => {
    const original = new Headers({ 'content-type': 'text/html' });
    const result = withContentSecurityPolicy(original);

    expect(result.get('content-type')).toBe('text/html');
    expect(result.get(CSP_HEADER_NAME)).toBe(CONTENT_SECURITY_POLICY_REPORT_ONLY);
    // does not mutate the input
    expect(original.get(CSP_HEADER_NAME)).toBeNull();
  });
});
