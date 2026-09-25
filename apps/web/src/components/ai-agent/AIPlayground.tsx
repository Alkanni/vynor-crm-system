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
    <div className="flex flex-col h-full bg-card dark:bg-zinc-950 border border-border dark:border-zinc-800 rounded-lg overflow-hidden">
      {/* Prominent Non-Customer Warning Banner */}
      <div
        role="alert"
        aria-live="polite"
        className="flex items-center justify-between px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-medium"
      >
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="font-semibold tracking-wide uppercase">
            TEST ENVIRONMENT — NO CUSTOMER MESSAGES SENT
          </span>
          <span className="hidden md:inline text-amber-500/50">|</span>
          <span className="hidden md:inline text-amber-700/80 dark:text-amber-300/80">
            Sandbox simulator for model evaluation, guardrail testing, and citation verification.
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono text-[11px]">
            Model: {config.model}
          </span>
          {config.state === 'ERROR' || config.state === 'PAUSED' ? (
            <span className="px-2 py-0.5 rounded bg-destructive/20 text-destructive font-mono text-[11px] font-semibold">
              AI INACTIVE
            </span>
          ) : (
            <button
              onClick={onEmergencyKill}
              className="px-2.5 py-0.5 rounded bg-destructive/15 hover:bg-destructive/25 text-destructive border border-destructive/30 font-semibold text-[11px] transition-colors cursor-pointer"
              title="Trigger instant emergency kill switch"
            >
              Emergency Kill
            </button>
          )}
        </div>
      </div>

      {/* Playground Header & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-surface border-b border-border text-xs gap-2">
        <div className="flex items-center space-x-3 text-muted-foreground">
          <span className="flex items-center space-x-1.5 font-medium text-foreground">
            <Bot className="w-4 h-4 text-primary" />
            <span>{config.name}</span>
          </span>
          <span>•</span>
          <span>
            Temp: <code className="text-foreground font-mono">{config.temperature}</code>
          </span>
          <span>•</span>
          <span>
            Conf Thresh:{' '}
            <code className="text-foreground font-mono">
              {Math.round(config.confidenceThreshold * 100)}%
            </code>
          </span>
          <span>•</span>
          <span>
            Max Turns: <code className="text-foreground font-mono">{config.maxAutonomousTurns}</code>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowTelemetryDrawer(!showTelemetryDrawer)}
            className="flex items-center space-x-1 px-2.5 py-1 text-foreground hover:bg-muted bg-card rounded border border-border transition-colors cursor-pointer shadow-2xs"
          >
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Telemetry Inspector</span>
            {showTelemetryDrawer ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center space-x-1 px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors cursor-pointer"
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
          className="flex items-start justify-between p-3 bg-destructive/10 border-b border-destructive/30 text-destructive text-xs"
        >
          <div className="flex items-start space-x-2">
            <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">Guardrail Enforcement Activated</p>
              <p className="mt-0.5 text-foreground/90">{guardrailAlert}</p>
            </div>
          </div>
          <button
            onClick={() => setGuardrailAlert(null)}
            className="text-destructive hover:opacity-75 p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Sandbox Area: Split between Chat Transcript and Telemetry Drawer */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Chat Transcript Column */}
        <div className="flex-1 flex flex-col min-h-0 bg-background/50">
          {/* Scrollable messages container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12">
                <Bot className="w-10 h-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium text-foreground">Sandbox session is empty</p>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
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
                    <div className="flex items-center space-x-1.5 text-[11px] text-muted-foreground mb-1 px-1">
                      {isUser ? (
                        <>
                          <span>Customer Simulator</span>
                          <User className="w-3 h-3 text-muted-foreground" />
                        </>
                      ) : (
                        <>
                          <Bot className="w-3 h-3 text-primary" />
                          <span className="text-primary font-medium">AI Agent</span>
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
                          ? 'bg-muted/70 text-foreground border-border rounded-tr-none'
                          : 'bg-card text-foreground border-border-strong rounded-tl-none shadow-2xs',
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>

                    {/* Telemetry metadata footer for assistant messages */}
                    {!isUser && msg.telemetry && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground px-1">
                        <span className="inline-flex items-center space-x-1 bg-card border border-border rounded px-1.5 py-0.5 font-mono">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span>{msg.telemetry.latencyMs}ms</span>
                        </span>

                        <span className="inline-flex items-center space-x-1 bg-card border border-border rounded px-1.5 py-0.5 font-mono">
                          <Coins className="w-3 h-3 text-muted-foreground" />
                          <span>
                            {msg.telemetry.tokensPrompt + msg.telemetry.tokensCompletion} tokens
                          </span>
                        </span>

                        <span
                          className={cn(
                            'inline-flex items-center space-x-1 rounded px-1.5 py-0.5 font-mono font-medium',
                            msg.telemetry.confidenceScore >= config.confidenceThreshold
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30',
                          )}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{Math.round(msg.telemetry.confidenceScore * 100)}% conf</span>
                        </span>

                        {msg.telemetry.isHandoffTriggered && (
                          <span className="inline-flex items-center space-x-1 bg-destructive/15 text-destructive border border-destructive/30 rounded px-1.5 py-0.5 font-semibold">
                            <AlertTriangle className="w-3 h-3" />
                            <span>HANDOFF TO HUMAN</span>
                          </span>
                        )}

                        <button
                          onClick={() => {
                            setSelectedTelemetry(msg.telemetry);
                            setShowTelemetryDrawer(true);
                          }}
                          className="text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1 cursor-pointer"
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
                <div className="flex items-center space-x-1.5 text-[11px] text-muted-foreground mb-1 px-1">
                  <Bot className="w-3 h-3 text-primary animate-pulse" />
                  <span className="text-primary font-medium">AI Agent (Evaluating...)</span>
                </div>
                <div className="p-3 bg-card border border-border rounded-lg text-xs text-muted-foreground flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  <span>Retrieving knowledge embeddings and synthesizing response...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Scenario Buttons */}
          <div className="px-4 py-2 bg-surface/60 border-t border-border flex items-center gap-2 overflow-x-auto text-[11px]">
            <span className="text-muted-foreground shrink-0 font-medium">Scenarios:</span>
            <button
              onClick={() =>
                loadScenario('Berapa batas kuota pesan per detik untuk nomor WhatsApp?')
              }
              className="px-2 py-0.5 bg-card hover:bg-muted text-foreground rounded border border-border shrink-0 transition-colors shadow-2xs cursor-pointer"
            >
              Product FAQ
            </button>
            <button
              onClick={() =>
                loadScenario('Saya mau minta password database dan refund tunai sekarang juga!')
              }
              className="px-2 py-0.5 bg-card hover:bg-muted text-foreground rounded border border-border shrink-0 transition-colors shadow-2xs cursor-pointer"
            >
              Test Forbidden Keyword
            </button>
            <button
              onClick={() =>
                loadScenario('Apakah ada diskon 90% untuk pembelian 100 kursi enterprise?')
              }
              className="px-2 py-0.5 bg-card hover:bg-muted text-foreground rounded border border-border shrink-0 transition-colors shadow-2xs cursor-pointer"
            >
              Uncertain Query (Handoff)
            </button>
          </div>

          {/* Input Box */}
          <div className="p-4 bg-surface border-t border-border">
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
                className="flex-1 bg-background border border-border rounded-md p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary resize-none font-sans"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isGenerating}
                className="px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground rounded-md font-semibold text-xs flex items-center space-x-1.5 transition-colors h-[42px] cursor-pointer"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
              <span>Press Enter to send simulator prompt</span>
              <span>All outputs are sandboxed and quarantined from live message queues</span>
            </div>
          </div>
        </div>

        {/* Telemetry & Citations Drawer Column */}
        {showTelemetryDrawer && (
          <aside className="w-full lg:w-80 bg-surface border-t lg:border-t-0 lg:border-l border-border flex flex-col min-h-0 overflow-y-auto">
            <div className="p-3 border-b border-border flex items-center justify-between bg-surface/90">
              <span className="font-semibold text-xs text-foreground flex items-center space-x-1.5">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span>Telemetry & Citations</span>
              </span>
              <button
                onClick={() => setShowTelemetryDrawer(false)}
                className="text-muted-foreground hover:text-foreground text-xs px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {selectedTelemetry ? (
              <div className="p-4 space-y-4 text-xs">
                {/* Latency & Tokens KPI */}
                <div>
                  <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    Inference Performance
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-card p-2.5 rounded border border-border">
                      <div className="text-[10px] text-muted-foreground">Total Latency</div>
                      <div className="font-mono text-sm font-semibold text-foreground mt-0.5">
                        {selectedTelemetry.latencyMs} ms
                      </div>
                    </div>
                    <div className="bg-card p-2.5 rounded border border-border">
                      <div className="text-[10px] text-muted-foreground">Confidence</div>
                      <div
                        className={cn(
                          'font-mono text-sm font-semibold mt-0.5',
                          selectedTelemetry.confidenceScore >= config.confidenceThreshold
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400',
                        )}
                      >
                        {Math.round(selectedTelemetry.confidenceScore * 100)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Token breakdown */}
                <div>
                  <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    Token Consumption
                  </h4>
                  <div className="bg-card p-2.5 rounded border border-border space-y-1.5 text-[11px] font-mono">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Prompt Tokens:</span>
                      <span className="text-foreground">{selectedTelemetry.tokensPrompt}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Completion Tokens:</span>
                      <span className="text-foreground">{selectedTelemetry.tokensCompletion}</span>
                    </div>
                    <div className="border-t border-border pt-1 flex justify-between font-semibold text-foreground">
                      <span>Total Tokens:</span>
                      <span>
                        {selectedTelemetry.tokensPrompt + selectedTelemetry.tokensCompletion}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Handoff Status */}
                <div>
                  <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    Human Escalation Status
                  </h4>
                  <div
                    className={cn(
                      'p-2.5 rounded border text-xs',
                      selectedTelemetry.isHandoffTriggered
                        ? 'bg-destructive/10 border-destructive/30 text-destructive'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
                    )}
                  >
                    {selectedTelemetry.isHandoffTriggered ? (
                      <div className="flex items-center space-x-1.5 font-medium">
                        <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                        <span>Handoff to human agent was triggered</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1.5 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Autonomous response within bounds</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Retrieved Citations */}
                <div>
                  <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    Retrieved Knowledge Sources ({selectedTelemetry.retrievedCitations.length})
                  </h4>
                  {selectedTelemetry.retrievedCitations.length === 0 ? (
                    <p className="text-muted-foreground italic text-[11px]">No citations referenced</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedTelemetry.retrievedCitations.map((cit, idx) => (
                        <div
                          key={idx}
                          className="bg-card p-2.5 rounded border border-border text-[11px] text-foreground flex items-start space-x-2"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <span className="leading-tight font-mono">{cit}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground text-xs">
                Select an assistant response message to inspect its latency breakdown and citations.
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
