/**
 * server/helpers/pythonRunner.ts
 * Shared Python subprocess runner for online_stream.py and ai_engine.py.
 * Extracted from vite.config.ts lines 27-93.
 *
 * Includes one-time Python availability check so the Node server never
 * crashes if Python or yt-dlp are not installed.
 */

import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';

// Detect Windows vs Linux/Mac for Python binary name
const IS_WIN = process.platform === 'win32';
const PYTHON_BIN = IS_WIN ? 'python' : 'python3';

// One-time availability flag
let _pythonChecked = false;
let _pythonAvailable = false;

/**
 * Check if Python is available on the system. Called once, result is cached.
 */
export function checkPythonAvailable(): boolean {
  if (_pythonChecked) return _pythonAvailable;

  try {
    const res = spawnSync(PYTHON_BIN, ['--version'], { encoding: 'utf-8', timeout: 3000 });
    _pythonChecked = true;
    _pythonAvailable = res.status === 0;
    if (!_pythonAvailable) {
      console.warn(`[Aura] Python not found (tried '${PYTHON_BIN} --version'). Online streaming via yt-dlp is disabled. YouTube HTML search will still work.`);
    }
  } catch {
    _pythonChecked = true;
    _pythonAvailable = false;
    console.warn(`[Aura] Python not found (tried '${PYTHON_BIN} --version'). Online streaming via yt-dlp is disabled. YouTube HTML search will still work.`);
  }

  return _pythonAvailable;
}

/** Returns cached Python availability. */
export function isPythonAvailable(): boolean {
  if (!_pythonChecked) {
    return checkPythonAvailable();
  }
  return _pythonAvailable;
}

/** Eagerly check Python on startup */
export function initPythonCheck(): boolean {
  return checkPythonAvailable();
}

/**
 * Run server/online_stream.py with given arguments.
 * Returns parsed JSON output or rejects with an Error.
 * If Python is unavailable, rejects immediately with a clean error.
 */
export function runPythonCommand(args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!isPythonAvailable()) {
      reject(new Error('Python is not available on this system'));
      return;
    }

    const pythonScript = path.join(process.cwd(), 'server', 'online_stream.py');
    const proc = spawn(PYTHON_BIN, [pythonScript, ...args]);
    let stdout = '';
    let stderr = '';
    let isSettled = false;

    // 15-second child process watchdog timeout
    const timeout = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        try { proc.kill(); } catch {}
        reject(new Error('Python command timed out after 15s'));
      }
    }, 15000);

    proc.stdout.on('data', (data) => {
      stdout += data.toString('utf-8');
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString('utf-8');
    });

    proc.on('close', (code) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeout);
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr || `Process exited with code ${code}`));
        return;
      }
      try {
        const json = JSON.parse(stdout.trim());
        resolve(json);
      } catch {
        reject(new Error(`Failed to parse JSON: ${stdout.slice(0, 100)}`));
      }
    });

    proc.on('error', (err) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Run server/ai_engine.py with given arguments.
 * Returns parsed JSON output or rejects with an Error.
 * If Python is unavailable, rejects immediately with a clean error.
 */
export function runAiCommand(args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!isPythonAvailable()) {
      reject(new Error('Python is not available on this system'));
      return;
    }

    // Use process.cwd() since this runs in Vite/Node context
    const pythonScript = path.join(process.cwd(), 'server', 'ai_engine.py');
    const proc = spawn(PYTHON_BIN, [pythonScript, ...args]);
    let stdout = '';
    let stderr = '';
    let isSettled = false;

    // 15-second child process watchdog timeout
    const timeout = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        try { proc.kill(); } catch {}
        reject(new Error('AI Python command timed out after 15s'));
      }
    }, 15000);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`AI Script failed with code ${code}: ${stderr}`));
        return;
      }
      try {
        const json = JSON.parse(stdout.trim());
        resolve(json);
      } catch {
        reject(new Error(`Failed to parse JSON: ${stdout.slice(0, 100)}`));
      }
    });

    proc.on('error', (err) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeout);
      reject(err);
    });
  });
}
