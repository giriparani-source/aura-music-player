/**
 * Security Remediation Tests — Phase 1
 *
 * Tests for P0/P1 security fixes:
 * - SEC-01: WebView debugging disabled in production (verified via config)
 * - SEC-02: Cleartext HTTP blocked (verified via config)
 * - SEC-03: API key obfuscation (verified via unit tests)
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
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

// ────────────────────────────────────────────────────────────────────
// SEC-03: API Key Obfuscation Unit Tests
// ────────────────────────────────────────────────────────────────────

describe('SEC-03: API key must not be stored in plaintext localStorage', () => {
  let store: Record<string, string>;
  const hadWindow = typeof globalThis.window !== 'undefined';

  beforeEach(() => {
    vi.resetModules();
    store = {};

    // The service checks `typeof window === 'undefined'` — we must provide a window-like global
    if (!hadWindow) {
      (globalThis as any).window = globalThis;
    }

    const mockStorage: Storage = {
      getItem: (key: string): string | null => key in store ? store[key] : null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; },
      key: (_i: number) => null,
      length: 0,
    };
    Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, writable: true, configurable: true });
  });

  afterEach(() => {
    if (!hadWindow) {
      delete (globalThis as any).window;
    }
  });

  async function getService() {
    const mod = await import('../geminiAiService');
    return mod.geminiAiService;
  }

  test('setApiKey should NOT store key in plaintext under the old V1 key', async () => {
    const svc = await getService();
    const testKey = 'AIzaSyTestKey12345678';
    svc.setApiKey(testKey);

    expect(store['AURA_GEMINI_API_KEY']).toBeUndefined();
    expect(store['AURA_AI_KEY_V2']).toBeDefined();
    expect(store['AURA_AI_KEY_V2']).not.toBe(testKey);
  });

  test('getApiKey should correctly retrieve an obfuscated key', async () => {
    const svc = await getService();
    const testKey = 'AIzaSyTestKey12345678';
    svc.setApiKey(testKey);
    expect(svc.getApiKey()).toBe(testKey);
  });

  test('setApiKey with empty string should clear all stored keys', async () => {
    const svc = await getService();
    svc.setApiKey('AIzaSyTestKey12345678');
    svc.setApiKey('');
    expect(store['AURA_AI_KEY_V2']).toBeUndefined();
    expect(store['AURA_GEMINI_API_KEY']).toBeUndefined();
    expect(svc.getApiKey()).toBe('');
  });

  test('V1 plaintext key should be auto-migrated to V2 on read', async () => {
    store['AURA_GEMINI_API_KEY'] = 'sk-oldPlaintextKey123';
    const svc = await getService();
    const retrieved = svc.getApiKey();
    expect(retrieved).toBe('sk-oldPlaintextKey123');
    expect(store['AURA_GEMINI_API_KEY']).toBeUndefined();
    expect(store['AURA_AI_KEY_V2']).toBeDefined();
  });

  test('stored V2 value should not equal plaintext key', async () => {
    const svc = await getService();
    const testKey = 'AIzaSy_my_secret_key';
    svc.setApiKey(testKey);
    const stored = store['AURA_AI_KEY_V2'];
    expect(stored).toBeDefined();
    expect(stored).not.toBe(testKey);
    expect(svc.getApiKey()).toBe(testKey);
  });

  test('hasApiKey returns true when key is set', async () => {
    const svc = await getService();
    svc.setApiKey('AIzaSyTest');
    expect(svc.hasApiKey()).toBe(true);
  });

  test('hasApiKey returns false when no key is set', async () => {
    const svc = await getService();
    expect(svc.hasApiKey()).toBe(false);
  });

  test('getProvider detects OpenAI key prefix', async () => {
    const svc = await getService();
    svc.setApiKey('sk-openai-test-key');
    expect(svc.getProvider()).toBe('openai');
  });

  test('getProvider detects Gemini key prefix', async () => {
    const svc = await getService();
    svc.setApiKey('AIzaSyGeminiTestKey');
    expect(svc.getProvider()).toBe('gemini');
  });

  test('getProvider returns none when no key', async () => {
    const svc = await getService();
    expect(svc.getProvider()).toBe('none');
  });

  test('obfuscation is reversible for various key formats', async () => {
    const svc = await getService();
    const testKeys = [
      'AIzaSyDwjfTjAEhMkXJNLh2V83mPqw',
      'sk-proj-abc123def456ghi789',
      'simple',
      'a',
    ];
    for (const key of testKeys) {
      svc.setApiKey(key);
      expect(svc.getApiKey()).toBe(key);
    }
  });
});
