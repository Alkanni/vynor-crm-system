'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  Clock,
  Coins,
  CheckCircle2,
  FileText,
  User,
  Bot,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  XCircle,
} from 'lucide-react';
import type { AIAgentConfiguration, PlaygroundMessage } from './types';
import { cn } from '@/lib/utils';

interface AIPlaygroundProps {
  config: AIAgentConfiguration;
  onEmergencyKill?: () => void;
}

const INITIAL_MESSAGES: PlaygroundMessage[] = [
  {
    id: 'msg_01',
    role: 'user',
    content:
      'Halo, saya ingin menanyakan mengenai integrasi WhatsApp API untuk 5 nomor bisnis apakah didukung?',
    timestamp: '10:04:12',
  },
  {
    id: 'msg_02',
    role: 'assistant',
    content:
      'Halo! Ya, VYNOR CRM mendukung multi-number WhatsApp Business API secara native. Anda dapat mendaftarkan dan mengelola 5 nomor bisnis sekaligus dalam satu workspace internal dengan routing pesan otomatis dan analitik terpisah per nomor.',
    timestamp: '10:04:14',
    telemetry: {
      latencyMs: 342,
      tokensPrompt: 412,
      tokensCompletion: 58,
      confidenceScore: 0.96,
      retrievedCitations: [
        'KB-204: WhatsApp Business Cloud API Multi-Tenant Architecture',
        'DOC-112: Workspace Channel Quota & Rate Limits',
      ],
      isHandoffTriggered: false,
    },
  },
];

export function AIPlayground({ config, onEmergencyKill }: AIPlaygroundProps) {
  const [messages, setMessages] = useState<PlaygroundMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTelemetry, setSelectedTelemetry] = useState<PlaygroundMessage['telemetry'] | null>(
    INITIAL_MESSAGES[1]?.telemetry ?? null,
  );
  const [guardrailAlert, setGuardrailAlert] = useState<string | null>(null);
  const [showTelemetryDrawer, setShowTelemetryDrawer] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleReset = () => {
    setMessages([]);
    setSelectedTelemetry(null);
    setGuardrailAlert(null);
  };

  const handleSend = () => {
    if (!input.trim() || isGenerating) return;

    const userText = input.trim();
    setInput('');
    setGuardrailAlert(null);

    const now = new Date().toLocaleTimeString('id-ID', { hour12: false });
    const userMsg: PlaygroundMessage = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: userText,
      timestamp: now,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsGenerating(true);

    // Check guardrails against forbidden keywords
    const lowerText = userText.toLowerCase();
    const matchedForbidden = config.forbiddenKeywords.find((kw) =>
      lowerText.includes(kw.toLowerCase()),
    );

    setTimeout(() => {
      setIsGenerating(false);

      if (matchedForbidden) {
        setGuardrailAlert(
          `Guardrail Triggered: Forbidden term "${matchedForbidden}" detected. AI generation suspended and routed for human supervisor triage.`,
        );

        const blockedResponse: PlaygroundMessage = {
          id: `msg_${Date.now()}_a`,
          role: 'assistant',
          content:
            'Maaf, permintaan Anda telah kami eskalasikan langsung ke supervisor operasional VYNOR CRM untuk penanganan manual sesuai kebijakan keamanan komunikasi.',
          timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false }),
          telemetry: {
            latencyMs: 184,
            tokensPrompt: 290,
            tokensCompletion: 28,
            confidenceScore: 0.12,
            retrievedCitations: ['SAFETY-RULE-04: Strict Escalation Policy'],
            isHandoffTriggered: true,
          },
        };
        setMessages((prev) => [...prev, blockedResponse]);
        setSelectedTelemetry(blockedResponse.telemetry);
        return;
      }

      // Normal response simulation
      const isComplexRefund = lowerText.includes('refund') || lowerText.includes('pengembalian');
      const confidence = isComplexRefund ? 0.74 : 0.94;
      const requiresHandoff = confidence < config.confidenceThreshold;

      const aiResponse: PlaygroundMessage = {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content: requiresHandoff
          ? 'Pertanyaan mengenai proses refund memerlukan verifikasi tagihan langsung dari tim Finance kami. Agen manusia akan segera mengambil alih percakapan ini.'
          : `Terima kasih atas pertanyaannya. Menanggapi pesan "${userText}": Sistem VYNOR CRM telah memproses instruksi ini sesuai konfigurasi model ${config.model} dengan parameter temperature ${config.temperature}.`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false }),
        telemetry: {
          latencyMs: Math.floor(Math.random() * 200) + 260,
          tokensPrompt: 380,
          tokensCompletion: 64,
          confidenceScore: confidence,
          retrievedCitations: [
            'KB-101: Knowledge Retrieval Pipeline',
            'KB-305: Omnichannel Dispatch Latency SLAs',
          ],
          isHandoffTriggered: requiresHandoff,
        },
      };

      setMessages((prev) => [...prev, aiResponse]);
      setSelectedTelemetry(aiResponse.telemetry);
    }, 850);
  };

  const loadScenario = (text: string) => {
    setInput(text);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Prominent Non-Customer Warning Banner */}
      <div
        role="alert"
        aria-live="polite"
        className="flex items-center justify-between px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-xs font-medium"
      >
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold tracking-wide uppercase">
            TEST ENVIRONMENT — NO CUSTOMER MESSAGES SENT
          </span>
          <span className="hidden md:inline text-amber-400/70">|</span>
          <span className="hidden md:inline text-amber-200/80">
            Sandbox simulator for model evaluation, guardrail testing, and citation verification.
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[11px]">
            Model: {config.model}
          </span>
          {config.state === 'ERROR' || config.state === 'PAUSED' ? (
            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-mono text-[11px] font-semibold">
              AI INACTIVE
            </span>
          ) : (
            <button
              onClick={onEmergencyKill}
              className="px-2.5 py-0.5 rounded bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-semibold text-[11px] transition-colors"
              title="Trigger instant emergency kill switch"
            >
              Emergency Kill
            </button>
          )}
        </div>
      </div>

      {/* Playground Header & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-zinc-800 text-xs gap-2">
        <div className="flex items-center space-x-3 text-zinc-400">
          <span className="flex items-center space-x-1.5 font-medium text-zinc-300">
            <Bot className="w-4 h-4 text-emerald-400" />
            <span>{config.name}</span>
          </span>
          <span>•</span>
          <span>
            Temp: <code className="text-zinc-200 font-mono">{config.temperature}</code>
          </span>
          <span>•</span>
          <span>
            Conf Thresh:{' '}
            <code className="text-zinc-200 font-mono">
              {Math.round(config.confidenceThreshold * 100)}%
            </code>
          </span>
          <span>•</span>
          <span>
            Max Turns: <code className="text-zinc-200 font-mono">{config.maxAutonomousTurns}</code>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowTelemetryDrawer(!showTelemetryDrawer)}
            className="flex items-center space-x-1 px-2.5 py-1 text-zinc-300 hover:text-zinc-100 bg-zinc-800 hover:bg-zinc-700/80 rounded border border-zinc-700 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Telemetry Inspector</span>
            {showTelemetryDrawer ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center space-x-1 px-2.5 py-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
            title="Clear simulator conversation history"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset History</span>
          </button>
        </div>
      </div>

      {/* Guardrail Violation Alert */}
      {guardrailAlert && (
        <div
          role="alert"
          className="flex items-start justify-between p-3 bg-red-950/40 border-b border-red-500/40 text-red-300 text-xs"
        >
          <div className="flex items-start space-x-2">
            <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-200">Guardrail Enforcement Activated</p>
              <p className="mt-0.5 text-red-300/90">{guardrailAlert}</p>
            </div>
          </div>
          <button
            onClick={() => setGuardrailAlert(null)}
            className="text-red-400 hover:text-red-200 p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Sandbox Area: Split between Chat Transcript and Telemetry Drawer */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Chat Transcript Column */}
        <div className="flex-1 flex flex-col min-h-0 bg-zinc-950">
          {/* Scrollable messages container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 py-12">
                <Bot className="w-10 h-10 text-zinc-700 mb-2" />
                <p className="text-sm font-medium text-zinc-400">Sandbox session is empty</p>
                <p className="text-xs text-zinc-600 max-w-sm mt-1">
                  Type a customer query below or pick a test scenario to evaluate prompt behavior,
                  guardrail filters, and citation retrieval.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex flex-col max-w-[85%]',
                      isUser ? 'ml-auto items-end' : 'mr-auto items-start',
                    )}
                  >
                    {/* Role header & timestamp */}
                    <div className="flex items-center space-x-1.5 text-[11px] text-zinc-500 mb-1 px-1">
                      {isUser ? (
                        <>
                          <span>Customer Simulator</span>
                          <User className="w-3 h-3 text-zinc-400" />
                        </>
                      ) : (
                        <>
                          <Bot className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-medium">AI Agent</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="font-mono">{msg.timestamp}</span>
                    </div>

                    {/* Bubble */}
                    <div
                      className={cn(
                        'p-3.5 rounded-lg text-xs leading-relaxed border',
                        isUser
                          ? 'bg-zinc-800 text-zinc-100 border-zinc-700 rounded-tr-none'
                          : 'bg-zinc-900 text-zinc-200 border-zinc-800 rounded-tl-none shadow-sm',
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>

                    {/* Telemetry metadata footer for assistant messages */}
                    {!isUser && msg.telemetry && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-zinc-400 px-1">
                        <span className="inline-flex items-center space-x-1 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 font-mono">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          <span>{msg.telemetry.latencyMs}ms</span>
                        </span>

                        <span className="inline-flex items-center space-x-1 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 font-mono">
                          <Coins className="w-3 h-3 text-zinc-500" />
                          <span>
                            {msg.telemetry.tokensPrompt + msg.telemetry.tokensCompletion} tokens
                          </span>
                        </span>

                        <span
                          className={cn(
                            'inline-flex items-center space-x-1 rounded px-1.5 py-0.5 font-mono font-medium',
                            msg.telemetry.confidenceScore >= config.confidenceThreshold
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
                          )}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{Math.round(msg.telemetry.confidenceScore * 100)}% conf</span>
                        </span>

                        {msg.telemetry.isHandoffTriggered && (
                          <span className="inline-flex items-center space-x-1 bg-red-500/20 text-red-400 border border-red-500/40 rounded px-1.5 py-0.5 font-semibold">
                            <AlertTriangle className="w-3 h-3" />
                            <span>HANDOFF TO HUMAN</span>
                          </span>
                        )}

                        <button
                          onClick={() => {
                            setSelectedTelemetry(msg.telemetry);
                            setShowTelemetryDrawer(true);
                          }}
                          className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2 ml-1"
                        >
                          View Citations ({msg.telemetry.retrievedCitations.length})
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {isGenerating && (
              <div className="flex flex-col mr-auto items-start max-w-[85%]">
                <div className="flex items-center space-x-1.5 text-[11px] text-zinc-500 mb-1 px-1">
                  <Bot className="w-3 h-3 text-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-medium">AI Agent (Evaluating...)</span>
                </div>
                <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Retrieving knowledge embeddings and synthesizing response...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Scenario Buttons */}
          <div className="px-4 py-2 bg-zinc-900/50 border-t border-zinc-800 flex items-center gap-2 overflow-x-auto text-[11px]">
            <span className="text-zinc-500 shrink-0 font-medium">Scenarios:</span>
            <button
              onClick={() =>
                loadScenario('Berapa batas kuota pesan per detik untuk nomor WhatsApp?')
              }
              className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 shrink-0 transition-colors"
            >
              Product FAQ
            </button>
            <button
              onClick={() =>
                loadScenario('Saya mau minta password database dan refund tunai sekarang juga!')
              }
              className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 shrink-0 transition-colors"
            >
              Test Forbidden Keyword
            </button>
            <button
              onClick={() =>
                loadScenario('Apakah ada diskon 90% untuk pembelian 100 kursi enterprise?')
              }
              className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 shrink-0 transition-colors"
            >
              Uncertain Query (Handoff)
            </button>
          </div>

          {/* Input Box */}
          <div className="p-4 bg-zinc-900 border-t border-zinc-800">
            <div className="flex items-end space-x-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isGenerating}
                placeholder="Type customer message to test AI model behavior (Enter to send, Shift+Enter for newline)..."
                rows={2}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-md p-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600 resize-none font-sans"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isGenerating}
                className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 rounded-md font-medium text-xs flex items-center space-x-1.5 transition-colors h-[42px]"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 text-[10px] text-zinc-500">
              <span>Press Enter to send simulator prompt</span>
              <span>All outputs are sandboxed and quarantined from live message queues</span>
            </div>
          </div>
        </div>

        {/* Telemetry & Citations Drawer Column */}
        {showTelemetryDrawer && (
          <aside className="w-full lg:w-80 bg-zinc-900 border-t lg:border-t-0 lg:border-l border-zinc-800 flex flex-col min-h-0 overflow-y-auto">
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
              <span className="font-semibold text-xs text-zinc-200 flex items-center space-x-1.5">
                <FileText className="w-4 h-4 text-zinc-400" />
                <span>Telemetry & Citations</span>
              </span>
              <button
                onClick={() => setShowTelemetryDrawer(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs px-1"
              >
                ✕
              </button>
            </div>

            {selectedTelemetry ? (
              <div className="p-4 space-y-4 text-xs">
                {/* Latency & Tokens KPI */}
                <div>
                  <h4 className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 mb-2">
                    Inference Performance
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
                      <div className="text-[10px] text-zinc-500">Total Latency</div>
                      <div className="font-mono text-sm font-semibold text-zinc-200 mt-0.5">
                        {selectedTelemetry.latencyMs} ms
                      </div>
                    </div>
                    <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
                      <div className="text-[10px] text-zinc-500">Confidence</div>
                      <div
                        className={cn(
                          'font-mono text-sm font-semibold mt-0.5',
                          selectedTelemetry.confidenceScore >= config.confidenceThreshold
                            ? 'text-emerald-400'
                            : 'text-amber-400',
                        )}
                      >
                        {Math.round(selectedTelemetry.confidenceScore * 100)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Token breakdown */}
                <div>
                  <h4 className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 mb-2">
                    Token Consumption
                  </h4>
                  <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800 space-y-1.5 text-[11px] font-mono">
                    <div className="flex justify-between text-zinc-400">
                      <span>Prompt Tokens:</span>
                      <span className="text-zinc-200">{selectedTelemetry.tokensPrompt}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Completion Tokens:</span>
                      <span className="text-zinc-200">{selectedTelemetry.tokensCompletion}</span>
                    </div>
                    <div className="border-t border-zinc-800 pt-1 flex justify-between font-semibold text-zinc-100">
                      <span>Total Tokens:</span>
                      <span>
                        {selectedTelemetry.tokensPrompt + selectedTelemetry.tokensCompletion}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Handoff Status */}
                <div>
                  <h4 className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 mb-2">
                    Human Escalation Status
                  </h4>
                  <div
                    className={cn(
                      'p-2.5 rounded border text-xs',
                      selectedTelemetry.isHandoffTriggered
                        ? 'bg-red-500/10 border-red-500/30 text-red-300'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
                    )}
                  >
                    {selectedTelemetry.isHandoffTriggered ? (
                      <div className="flex items-center space-x-1.5 font-medium">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>Handoff to human agent was triggered</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1.5 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Autonomous response within bounds</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Retrieved Citations */}
                <div>
                  <h4 className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 mb-2">
                    Retrieved Knowledge Sources ({selectedTelemetry.retrievedCitations.length})
                  </h4>
                  {selectedTelemetry.retrievedCitations.length === 0 ? (
                    <p className="text-zinc-500 italic text-[11px]">No citations referenced</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedTelemetry.retrievedCitations.map((cit, idx) => (
                        <div
                          key={idx}
                          className="bg-zinc-950 p-2.5 rounded border border-zinc-800 text-[11px] text-zinc-300 flex items-start space-x-2"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                          <span className="leading-tight font-mono">{cit}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-zinc-500 text-xs">
                Select an assistant response message to inspect its latency breakdown and citations.
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
