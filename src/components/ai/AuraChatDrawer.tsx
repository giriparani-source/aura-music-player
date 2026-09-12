import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  Mic2,
  Sliders,
  Play,
  SkipForward,
  FileText,
  Radio,
  Loader2
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { AiChatMessage } from '../../types/music';
import { audioEffectsService } from '../../services/audioEffectsService';

const QUICK_ACTIONS = [
  { label: '🎙️ Turn on Karaoke', query: 'turn on karaoke mode' },
  { label: '🔊 Boost Bass (+6dB)', query: 'boost bass' },
  { label: '📜 Explain current song', query: 'explain current song lyrics' },
  { label: '⏭️ Next song', query: 'skip to next song' },
  { label: '🎧 Open AI DJ Studio', query: 'open ai dj studio' }
];

export const AuraChatDrawer: React.FC = () => {
  const {
    isAiAssistantOpen,
    setAiAssistantOpen,
    currentSong,
    isPlaying,
    togglePlay,
    nextSong,
    toggleKaraoke,
    openWithTab
  } = usePlayerStore();

  const { setActiveTab } = useLibraryStore();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'welcome',
      sender: 'aura',
      text: 'Vanakkam nanba! Naan unga Aura AI Music Assistant. Song explain panna, EQ tune panna, alladhu Karaoke mode toggle panna enkitta sollunga! 🎶✨',
      timestamp: Date.now()
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isAiAssistantOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAiAssistantOpen]);

  const executeAction = (action: any) => {
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
      case 'PAUSE':
        togglePlay();
        break;
      case 'NEXT_TRACK':
        nextSong();
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

    const userMsg: AiChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          currentSong: currentSong
            ? {
                title: currentSong.title,
                artist: currentSong.artist,
                album: currentSong.album
              }
            : null
        })
      });

      const data = await res.json();
      const botMsg: AiChatMessage = {
        id: `aura_${Date.now()}`,
        sender: 'aura',
        text: data.reply || 'Super nanba, done!',
        timestamp: Date.now(),
        action: data.action
      };

      setMessages((prev) => [...prev, botMsg]);

      // If there's an action, automatically execute it
      if (data.action) {
        executeAction(data.action);
      }
    } catch (err) {
      console.error('AI chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'aura',
          text: 'Oops, connection issue nanba. Please try again.',
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Launcher Button */}
      {!isAiAssistantOpen && (
        <button
          onClick={() => setAiAssistantOpen(true)}
          className="fixed bottom-24 right-6 z-30 p-3.5 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 text-white shadow-2xl shadow-purple-600/40 hover:scale-105 transition-all flex items-center gap-2 cursor-pointer border border-white/20 group"
          title="Chat with Aura AI"
        >
          <div className="relative">
            <Sparkles size={18} className="text-amber-300 animate-pulse" />
          </div>
          <span className="text-xs font-extrabold hidden sm:inline-block pr-1">Ask Aura AI</span>
        </button>
      )}

      {/* Slide-in Chat Drawer */}
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
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </h4>
                <p className="text-[10px] text-neutral-400">
                  {currentSong ? `Playing: ${currentSong.title}` : 'Online Music AI'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setAiAssistantOpen(false)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

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
                      <span>Execute Action</span>
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
                <span>Aura is thinking...</span>
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
              placeholder="Ask Aura anything (e.g. 'boost bass', 'karaoke')..."
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
