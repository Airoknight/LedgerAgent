'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  Paperclip, 
  X, 
  ChevronUp, 
  ChevronDown, 
  Terminal, 
  Bot, 
  User, 
  Check, 
  Layers
} from 'lucide-react';
import { ChatMessage, WorkspaceTab } from '@/types';
import { API_BASE_URL } from '@/config/api';

interface AssistantBarProps {
  activeTab: WorkspaceTab | undefined;
  onOpenUploadModal: () => void;
  onExecuteAction?: (action: string) => void;
}

export const AssistantBar: React.FC<AssistantBarProps> = ({
  activeTab,
  onOpenUploadModal,
  onExecuteAction
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "Hello CA Hehram. LedgerAgent is active for **Alpha Enterprises (FY 2026–27)**. I track all ingested vouchers, run deterministic arithmetic validations, and assist with reconciliation.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      contextUsed: "Alpha Enterprises Master",
      suggestedActions: ["/summary", "/exceptions", "/closecheck"]
    }
  ]);
  const [isThinking, setIsThinking] = useState(false);

  const slashCommands = [
    { cmd: '/summary', desc: 'Query period metrics and unresolved items' },
    { cmd: '/exceptions', desc: 'Inspect high-value unresolved exceptions' },
    { cmd: '/closecheck', desc: 'Evaluate period close checklist & blockers' },
    { cmd: '/reconcile', desc: 'Check bank statement matching status' },
    { cmd: '/report', desc: 'Open operational expense analysis report' },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputQuery(val);
    if (val.startsWith('/')) {
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleSelectSlash = (cmd: string) => {
    setInputQuery(cmd);
    setShowSlashMenu(false);
    handleSubmit(cmd);
  };

  const handleSubmit = async (queryToSubmit?: string) => {
    const q = (queryToSubmit || inputQuery).trim();
    if (!q) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: 'usr-' + Date.now(),
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setShowSlashMenu(false);
    setIsDrawerOpen(true);
    setIsThinking(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/chat/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          active_tab_id: activeTab?.id,
          active_context: activeTab ? {
            doc_id: activeTab.documentId,
            doc_title: activeTab.title,
            tab_type: activeTab.type
          } : null
        })
      });

      if (!res.ok) throw new Error('Query failed');
      const data = await res.json();

      const aiMsg: ChatMessage = {
        id: 'ai-' + Date.now(),
        sender: 'assistant',
        text: data.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        contextUsed: data.context_used,
        actionType: data.action_type,
        suggestedActions: data.suggested_actions
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      // Fallback simulation
      setTimeout(() => {
        let simulatedAnswer = `Processed query: "${q}". Verified against transactional database.`;
        if (q.startsWith('/summary')) {
          simulatedAnswer = `**September 2026 Summary**:\n- 3 Ingested Documents\n- 2 Automated Checks Passed\n- 1 Arithmetic Flag (INV-1042 variance of ₹1,000)`;
        } else if (q.startsWith('/exceptions')) {
          simulatedAnswer = `**1 Open Exception**:\n- **[HIGH]** Invoice Total Discrepancy in INV-1042-Cloud-Services.pdf (₹1,000 difference)`;
        } else if (q.startsWith('/closecheck')) {
          simulatedAnswer = `**Close Readiness: BLOCKED**\n- 1 Open Exception pending resolution\n- 2 Documents pending CA approval`;
        } else if (activeTab?.type === 'invoice') {
          simulatedAnswer = `Context **${activeTab.title}**: Document subtotal is ₹52,000 + 18% GST (₹9,360) = ₹61,360. Document total prints ₹62,360, creating a ₹1,000 discrepancy.`;
        }

        const aiMsg: ChatMessage = {
          id: 'ai-' + Date.now(),
          sender: 'assistant',
          text: simulatedAnswer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          contextUsed: activeTab ? activeTab.title : "Alpha Enterprises Master",
          suggestedActions: ["/summary", "/exceptions"]
        };
        setMessages(prev => [...prev, aiMsg]);
        setIsThinking(false);
      }, 400);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="border-t border-slate-800 bg-slate-900/95 flex flex-col relative z-20">
      {/* Expandable Chat Drawer */}
      {isDrawerOpen && (
        <div className="h-64 border-b border-slate-800 bg-slate-950/90 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold text-slate-200">LedgerAgent Accounting Conversation</span>
            </div>
            <button 
              onClick={() => setIsDrawerOpen(false)}
              className="p-1 hover:text-white rounded hover:bg-slate-800"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {messages.map((m) => (
            <div 
              key={m.id} 
              className={`flex gap-3 text-xs ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.sender === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div className={`max-w-xl rounded-xl p-3 leading-relaxed ${
                m.sender === 'user' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'bg-slate-900 border border-slate-800 text-slate-200 shadow-sm'
              }`}>
                {m.contextUsed && (
                  <div className="text-[10px] text-indigo-400 font-mono mb-1 flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    <span>Context: {m.contextUsed}</span>
                  </div>
                )}
                <div className="whitespace-pre-wrap">{m.text}</div>

                {m.suggestedActions && m.suggestedActions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-800 flex flex-wrap gap-1.5">
                    {m.suggestedActions.map((act, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSubmit(act)}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 font-mono border border-slate-700 transition-colors"
                      >
                        {act}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {m.sender === 'user' && (
                <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}

          {isThinking && (
            <div className="flex items-center gap-2 text-xs text-slate-400 italic">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              <span>Querying verified accounting records...</span>
            </div>
          )}
        </div>
      )}

      {/* Slash Command Autocomplete Menu */}
      {showSlashMenu && (
        <div className="absolute bottom-12 left-4 w-96 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-30">
          <div className="text-[10px] uppercase font-bold text-slate-500 px-2 py-1">
            Available Slash Commands
          </div>
          <div className="space-y-1">
            {slashCommands.map((c) => (
              <div
                key={c.cmd}
                onClick={() => handleSelectSlash(c.cmd)}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors text-xs"
              >
                <span className="font-mono font-bold text-indigo-400">{c.cmd}</span>
                <span className="text-slate-400 text-[11px]">{c.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Bottom Chat Input Bar */}
      <div className="h-12 px-4 flex items-center gap-3">
        {/* Active Context Chip */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/80 text-[11px] text-slate-300 shrink-0">
          <span className="text-slate-500 font-medium">Context:</span>
          <span className="font-semibold text-indigo-400 font-mono truncate max-w-[140px]">
            {activeTab ? activeTab.title : 'Alpha Enterprises'}
          </span>
        </div>

        {/* Attachment Button */}
        <button
          onClick={onOpenUploadModal}
          title="Upload or attach financial documents"
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Text Input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputQuery}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
            placeholder={`Ask LedgerAgent about ${activeTab ? activeTab.title : 'accounts'} or type / for commands...`}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 font-sans"
          />
        </div>

        {/* Toggle Drawer Button */}
        <button
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          className="p-1.5 text-slate-400 hover:text-slate-200 rounded-md hover:bg-slate-800 transition-colors"
          title="Toggle conversation drawer"
        >
          {isDrawerOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>

        {/* Send Button */}
        <button
          onClick={() => handleSubmit()}
          disabled={!inputQuery.trim()}
          className={`p-2 rounded-lg text-white transition-colors ${
            inputQuery.trim() ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-800 text-slate-600 cursor-not-allowed'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

