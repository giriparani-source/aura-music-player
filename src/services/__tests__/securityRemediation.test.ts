/**
 * Security Remediation Tests — Phase 1
 *
 * Tests for P0/P1 security fixes:
 * - SEC-01: WebView debugging disabled in production (verified via config)
 * - SEC-02: Cleartext HTTP blocked (verified via config)
 * - SEC-03: API key obfuscation (verified via unit tests)
 */
import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

// ────────────────────────────────────────────────────────────────────
// SEC-01 & SEC-02: Capacitor Config Verification
// ────────────────────────────────────────────────────────────────────

describe('SEC-01: WebView debugging must not be hardcoded enabled', () => {
  test('capacitor.config.ts should not contain webContentsDebuggingEnabled: true', () => {
    const content = fs.readFileSync(path.join(PROJECT_ROOT, 'capacitor.config.ts'), 'utf-8');
    expect(content).not.toContain('webContentsDebuggingEnabled: true');
  });

  test('bundled capacitor.config.json should not contain webContentsDebuggingEnabled', () => {
    const content = fs.readFileSync(
      path.join(PROJECT_ROOT, 'android', 'app', 'src', 'main', 'assets', 'capacitor.config.json'),
      'utf-8'
    );
    const parsed = JSON.parse(content);
    expect(parsed.android?.webContentsDebuggingEnabled).not.toBe(true);
  });
});

describe('SEC-02: Cleartext HTTP must not be blanket-allowed', () => {
  test('capacitor.config.ts should not contain cleartext: true', () => {
    const content = fs.readFileSync(path.join(PROJECT_ROOT, 'capacitor.config.ts'), 'utf-8');
    expect(content).not.toContain('cleartext: true');
  });

  test('bundled capacitor.config.json should not contain cleartext: true', () => {
    const content = fs.readFileSync(
      path.join(PROJECT_ROOT, 'android', 'app', 'src', 'main', 'assets', 'capacitor.config.json'),
      'utf-8'
    );
    const parsed = JSON.parse(content);
    expect(parsed.server?.cleartext).not.toBe(true);
  });

  test('capacitor.config.ts should not contain allowMixedContent: true', () => {
    const content = fs.readFileSync(path.join(PROJECT_ROOT, 'capacitor.config.ts'), 'utf-8');
    expect(content).not.toContain('allowMixedContent: true');
  });

  test('AndroidManifest.xml should use networkSecurityConfig instead of usesCleartextTraffic', () => {
    const content = fs.readFileSync(
      path.join(PROJECT_ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
      'utf-8'
    );
    expect(content).not.toContain('usesCleartextTraffic="true"');
    expect(content).toContain('networkSecurityConfig');
  });

  test('network_security_config.xml should exist and block cleartext globally', () => {
    const content = fs.readFileSync(
      path.join(PROJECT_ROOT, 'android', 'app', 'src', 'main', 'res', 'xml', 'network_security_config.xml'),
      'utf-8'
    );
    expect(content).toContain('cleartextTrafficPermitted="false"');
    expect(content).toContain('127.0.0.1');
    expect(content).toContain('localhost');
  });

  test('MainActivity.java should use MIXED_CONTENT_COMPATIBILITY_MODE not ALWAYS_ALLOW', () => {
    const content = fs.readFileSync(
      path.join(PROJECT_ROOT, 'android', 'app', 'src', 'main', 'java', 'com', 'aura', 'musicplayer', 'MainActivity.java'),
      'utf-8'
    );
    expect(content).not.toContain('MIXED_CONTENT_ALWAYS_ALLOW');
    expect(content).toContain('MIXED_CONTENT_COMPATIBILITY_MODE');
  });

  test('MainActivity.java should gate WebView debugging on debug flag', () => {
    const content = fs.readFileSync(
      path.join(PROJECT_ROOT, 'android', 'app', 'src', 'main', 'java', 'com', 'aura', 'musicplayer', 'MainActivity.java'),
      'utf-8'
    );
    const hasDebugGating = content.includes('WebView.setWebContentsDebuggingEnabled(isDebug)') ||
                           content.includes('WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)');
    expect(hasDebugGating).toBe(true);
  });
});
