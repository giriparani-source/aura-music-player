import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  Loader2,
  Key,
  Check
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { AiChatMessage } from '../../types/music';
import { audioEffectsService } from '../../services/audioEffectsService';
import { geminiAiService } from '../../services/geminiAiService';
import { searchJioSaavn } from '../../services/jiosaavnService';
import { fuzzySearchSongs } from '../../utils/fuzzySearch';

const QUICK_ACTIONS = [
  { label: '🎙️ Turn on Karaoke', query: 'turn on karaoke mode' },
  { label: '🔊 Boost Bass (+6dB)', query: 'boost bass' },
  { label: '🎧 Open AI DJ Studio', query: 'open ai dj studio' },
  { label: '⏭️ Next song', query: 'skip to next song' },
  { label: '🔀 Shuffle Queue', query: 'shuffle play' },
  { label: '📜 Explain current song', query: 'explain current song lyrics' }
];

type AiChatAction = NonNullable<AiChatMessage['action']>;

function createChatMessage(
  sender: AiChatMessage['sender'],
  text: string,
  action?: AiChatAction
): AiChatMessage {
  const timestamp = Date.now();
  return {
    id: `${sender}_${timestamp}_${Math.random().toString(36).substring(2, 6)}`,
    sender,
    text,
    timestamp,
    action
  };
}

export const AuraChatDrawer: React.FC = () => {
  const isAiAssistantOpen = usePlayerStore((s) => s.isAiAssistantOpen);
  const setAiAssistantOpen = usePlayerStore((s) => s.setAiAssistantOpen);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const nextSong = usePlayerStore((s) => s.nextSong);
  const previousSong = usePlayerStore((s) => s.previousSong);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const playSong = usePlayerStore((s) => s.playSong);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const volume = usePlayerStore((s) => s.volume);
  const toggleKaraoke = usePlayerStore((s) => s.toggleKaraoke);
  const openWithTab = usePlayerStore((s) => s.openWithTab);

  const { songs, setActiveTab } = useLibraryStore();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(() => geminiAiService.getApiKey());
  const [savedKeySuccess, setSavedKeySuccess] = useState(false);

  const [messages, setMessages] = useState<AiChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'aura',
      text: 'Vanakkam nanba! Naan unga Aura AI Assistant. Ungaluku songs play panna, Bass boost panna, Karaoke toggle panna, alladhu AI DJ Studio open panna enkitta sollunga! 🎶✨',
      timestamp: Date.now()
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isAiAssistantOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAiAssistantOpen]);

  const handleSearchAndPlay = async (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return;

    // 1. Search local library first
    const localMatches = fuzzySearchSongs(songs, q);
    if (localMatches.length > 0) {
      await playSong(localMatches[0], localMatches);
      return;
    }

    // 2. Search online catalog
    try {
      const onlineTracks = await searchJioSaavn(q);
      if (onlineTracks && onlineTracks.length > 0) {
        await playSong(onlineTracks[0], onlineTracks);
      }
    } catch (err) {
      console.warn('Online search and play error:', err);
    }
  };

  const executeAction = async (action: AiChatAction | undefined) => {
    if (!action) return;
    switch (action.type) {
      case 'TOGGLE_KARAOKE':
        toggleKaraoke();
        break;
      case 'SET_EQ_PRESET':
        if (action.preset) {
          audioEffectsService.applyPreset(action.preset);
        }
        break;
      case 'PLAY':
        if (!isPlaying) togglePlay();
        break;
      case 'PAUSE':
        if (isPlaying) togglePlay();
        break;
      case 'NEXT_TRACK':
        nextSong();
        break;
      case 'PREV_TRACK':
        previousSong();
        break;
      case 'TOGGLE_SHUFFLE':
        toggleShuffle();
        break;
      case 'SET_VOLUME':
        if (typeof action.volume === 'number') {
          setVolume(action.volume);
        }
        break;
      case 'SEARCH_AND_PLAY':
        if (action.query) {
          await handleSearchAndPlay(action.query);
        }
        break;
      case 'OPEN_AI_INSIGHTS':
        openWithTab('ai-insights');
        break;
      case 'NAVIGATE_TAB':
        if (action.tab) {
          setActiveTab(action.tab);
        }
        break;
    }
  };

  const handleSend = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text || isLoading) return;

    const userMsg = createChatMessage('user', text);
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await geminiAiService.askAssistant(text, {
        currentSong: currentSong
          ? {
              id: currentSong.id,
              title: currentSong.title,
              artist: currentSong.artist,
              album: currentSong.album
            }
          : null,
        isPlaying,
        volume
      });

      const botMsg = createChatMessage('aura', response.reply, response.action);
      setMessages((prev) => [...prev, botMsg]);

      // Automatically execute player command
      if (response.action) {
        await executeAction(response.action);
      }
    } catch (err: any) {
      const errMsg = createChatMessage(
        'aura',
        `Vanakkam nanba! Request process panradhula chinna thadangal: ${err.message || 'Unknown error'}. Local mode ready-a iruku!`
      );
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveApiKey = () => {
    geminiAiService.setApiKey(tempApiKey);
    setSavedKeySuccess(true);
    setTimeout(() => {
      setSavedKeySuccess(false);
      setShowApiKeyModal(false);
    }, 1200);
  };

  const hasApiKey = geminiAiService.hasApiKey();

  return (
    <>
      {isAiAssistantOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 w-[92vw] sm:w-96 max-h-[580px] h-[80vh] z-50 rounded-3xl glass-card border border-indigo-500/30 bg-[#0e1118]/95 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in select-none">
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md">
                <Bot size={16} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  Aura AI Assistant
                  <span
                    className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-emerald-400 animate-pulse' : 'bg-indigo-400'}`}
                    title={
                      geminiAiService.getProvider() === 'openai'
                        ? 'OpenAI GPT-4o-mini Connected'
                        : hasApiKey
                        ? 'Gemini 2.5 Flash Connected'
                        : 'Smart Offline NLP Active'
                    }
                  />
                </h4>
                <p className="text-[10px] text-neutral-400">
                  {currentSong
                    ? `Playing: ${currentSong.title}`
                    : geminiAiService.getProvider() === 'openai'
                    ? 'OpenAI GPT-4o-mini'
                    : hasApiKey
                    ? 'Gemini AI'
                    : 'Smart Tanglish Agent'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowApiKeyModal(!showApiKeyModal)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  hasApiKey
                    ? 'text-emerald-400 hover:bg-emerald-500/10'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
                title="Configure Gemini or OpenAI API Key"
              >
                <Sparkles size={16} />
              </button>
              <button
                onClick={() => setAiAssistantOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                title="Close Assistant"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Optional Gemini / OpenAI API Key Drawer / Settings Banner */}
          {showApiKeyModal && (
            <div className="p-3 bg-indigo-950/40 border-b border-indigo-500/20 space-y-2 text-xs animate-fade-in">
              <div className="flex items-center justify-between text-indigo-300 font-semibold text-[11px]">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={12} />
                  AI API Key (Gemini or OpenAI)
                </span>
                <span className="text-[10px] text-neutral-400">
                  {hasApiKey ? 'Connected 🟢' : 'Optional (Cloud AI)'}
                </span>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="Paste Gemini (AIza...) or OpenAI (sk-...) Key"
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white text-xs placeholder:text-neutral-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSaveApiKey}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {savedKeySuccess ? <Check size={12} /> : null}
                  <span>{savedKeySuccess ? 'Saved' : 'Save'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'aura' && (
                  <div className="w-6 h-6 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center shrink-0 mt-1">
                    <Sparkles size={12} />
                  </div>
                )}

                <div
                  className={`p-3 rounded-2xl max-w-[80%] text-xs leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none'
                      : 'bg-white/10 text-neutral-200 border border-white/5 rounded-bl-none'
                  }`}
                >
                  <p>{m.text}</p>

                  {/* If there's an action badge */}
                  {m.action && (
                    <button
                      onClick={() => executeAction(m.action)}
                      className="mt-2.5 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-bold text-white flex items-center gap-1.5 cursor-pointer transition-colors border border-white/20"
                    >
                      <Sparkles size={10} className="text-amber-400" />
                      <span>Command Executed: {m.action.type}</span>
                    </button>
                  )}
                </div>

                {m.sender === 'user' && (
                  <div className="w-6 h-6 rounded-lg bg-white/10 text-neutral-300 flex items-center justify-center shrink-0 mt-1">
                    <User size={12} />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-neutral-400 pl-8">
                <Loader2 size={13} className="animate-spin text-indigo-400" />
                <span>Aura is tuning & thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Chips */}
          <div className="p-2 border-t border-white/5 bg-black/20 flex gap-1.5 overflow-x-auto no-scrollbar">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.label}
                onClick={() => handleSend(qa.query)}
                className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-medium text-neutral-300 whitespace-nowrap cursor-pointer transition-colors shrink-0"
              >
                {qa.label}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-3 border-t border-white/10 bg-white/5 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend(input);
              }}
              placeholder="Ask Aura anything (e.g. 'boost bass', 'karaoke', 'open ai dj studio')..."
              className="flex-1 px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => handleSend(input)}
              disabled={isLoading || !input.trim()}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors cursor-pointer"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
