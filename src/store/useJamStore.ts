import { create } from 'zustand';
import { jamService, JamParticipant, JamReaction, JamSyncStatus } from '../services/jamService';

interface JamStoreState {
  isJamModalOpen: boolean;
  isInRoom: boolean;
  isHost: boolean;
  roomCode: string | null;
  participants: JamParticipant[];
  reactions: JamReaction[];
  driftMs: number;
  syncStatus: JamSyncStatus;
  error: string | null;
  nickname: string;

  // Actions
  setJamModalOpen: (open: boolean) => void;
  setNickname: (name: string) => void;
  createRoom: () => Promise<string>;
  joinRoom: (code: string) => Promise<boolean>;
  leaveRoom: () => void;
  sendReaction: (emoji: string) => void;
}

export const useJamStore = create<JamStoreState>((set, get) => {
  // Subscribe to jamService updates
  jamService.subscribe((state) => {
    set({
      isInRoom: state.isInRoom,
      isHost: state.isHost,
      roomCode: state.roomCode,
      participants: state.participants,
      reactions: state.reactions,
      driftMs: state.driftMs,
      syncStatus: state.syncStatus,
      error: state.error
    });
  });

  return {
    isJamModalOpen: false,
    isInRoom: false,
    isHost: false,
    roomCode: null,
    participants: [],
    reactions: [],
    driftMs: 0,
    syncStatus: 'idle',
    error: null,
    nickname: localStorage.getItem('aura_jam_nickname') || 'Music Fan',

    setJamModalOpen: (open: boolean) => {
      set({ isJamModalOpen: open });
    },

    setNickname: (name: string) => {
      const clean = name.trim() || 'Music Fan';
      localStorage.setItem('aura_jam_nickname', clean);
      set({ nickname: clean });
    },

    createRoom: async () => {
      const { nickname } = get();
      const code = await jamService.createRoom(nickname);
      return code;
    },

    joinRoom: async (code: string) => {
      const { nickname } = get();
      const success = await jamService.joinRoom(code, nickname);
      return success;
    },

    leaveRoom: () => {
      jamService.leaveRoom();
    },

    sendReaction: (emoji: string) => {
      jamService.sendReaction(emoji);
    }
  };
});
