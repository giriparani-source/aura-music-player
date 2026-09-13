/**
 * server/middleware/index.ts
 * Barrel export for all Aura server middleware handlers and helpers.
 */

export { onlineSearchHandler } from './onlineSearch.ts';
export { onlineStreamHandler } from './onlineStream.ts';
export { aiRouterHandler } from './aiRouter.ts';
export { jamRoomHandler, startJamRoomCleanup } from './jamRoom.ts';
export { localAudioHandler } from './localAudio.ts';

export { searchCache, streamUrlCache, jamRooms } from '../helpers/caches.ts';
export type { JamRoomData } from '../helpers/caches.ts';
export { runPythonCommand, runAiCommand, isPythonAvailable, initPythonCheck } from '../helpers/pythonRunner.ts';
