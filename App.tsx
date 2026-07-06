import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Plus, 
  ShieldAlert, 
  Inbox, 
  CheckCircle2, 
  Hourglass, 
  AlertTriangle, 
  ArrowRight, 
  X, 
  RotateCcw, 
  FileText,
  AlertOctagon,
  ArrowUpRight,
  MessageSquare,
  Bookmark,
  Coffee,
  Package,
  Calendar,
  Check
} from "lucide-react";
import { BusinessEvent, BusinessContext } from "./types";

export default function App() {
  const [events, setEvents] = useState<BusinessEvent[]>([]);
  const [businessContext, setBusinessContext] = useState<BusinessContext | null>(null);
  const [morningDigest, setMorningDigest] = useState<string>("Reading logs and generating the morning digest...");
  const [isGeneratingDigest, setIsGeneratingDigest] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  
  // Escalation resolution drafting state
  const [draftingEventId, setDraftingEventId] = useState<string | null>(null);
  const [customDraftText, setCustomDraftText] = useState("");
  const [isResolving, setIsResolving] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    fetchContext();
    fetchEvents();
    fetchDigest();

    // Setup polling every 2 seconds to check on any processing pipeline
    const interval = setInterval(() => {
      fetchEventsQuietly();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const fetchContext = async () => {
    try {
      const res = await fetch("/api/context");
      if (res.ok) {
        const data = await res.json();
        setBusinessContext(data);
      }
    } catch (err) {
      console.error("Failed to fetch business context", err);
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
        setUsingMock(data.usingMockModel);
      }
    } catch (err) {
      console.error("Failed to fetch events", err);
    }
  };

  const fetchEventsQuietly = async () => {
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
      }
    } catch (err) {
      console.error("Failed to fetch events quietly", err);
    }
  };

  const fetchDigest = async () => {
    setIsGeneratingDigest(true);
    try {
      const res = await fetch("/api/digest");
      if (res.ok) {
        const data = await res.json();
        setMorningDigest(data.digest);
      }
    } catch (err) {
      console.error("Failed to fetch digest", err);
      setMorningDigest("Failed to compile today's business digest. Check your connection or API key.");
    } finally {
      setIsGeneratingDigest(false);
    }
  };

  // Inject standard business event
  const handleInjectEvent = async (forceEscalation: boolean) => {
    setIsInjecting(true);
    try {
      const res = await fetch("/api/events/inject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceEscalation })
      });
      if (res.ok) {
        // Refresh feed immediately to show 'processing' state
        await fetchEvents();
        
        // After 2 seconds, refresh digest to summarize new changes
        setTimeout(() => {
          fetchDigest();
        }, 3000);
      }
    } catch (err) {
      console.error("Injection failed", err);
    } finally {
      setIsInjecting(false);
    }
  };

  // Reset the feed back to starting state
  const handleResetEvents = async () => {
    if (!window.confirm("Are you sure you want to reset the event feed to default demo state?")) {
      return;
    }
    try {
      const res = await fetch("/api/events/clear", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
        setDraftingEventId(null);
        setCustomDraftText("");
        setTimeout(() => {
          fetchDigest();
        }, 500);
      }
    } catch (err) {
      console.error("Failed to reset", err);
    }
  };

  // Human Resolve Escalation
  const handleResolveEscalation = async (eventId: string) => {
    setIsResolving(eventId);
    try {
      const res = await fetch("/api/events/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: eventId, draftResponse: customDraftText })
      });
      if (res.ok) {
        setDraftingEventId(null);
        setCustomDraftText("");
        await fetchEvents();
        await fetchDigest();
      }
    } catch (err) {
      console.error("Failed to resolve escalation", err);
    } finally {
      setIsResolving(null);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "customer_review":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" id="icon-review" />;
      case "booking":
        return <Calendar className="w-4 h-4 text-indigo-600" id="icon-booking" />;
      case "inventory":
        return <Package className="w-4 h-4 text-amber-600" id="icon-inventory" />;
      case "customer_message":
        return <MessageSquare className="w-4 h-4 text-blue-600" id="icon-message" />;
      default:
        return <FileText className="w-4 h-4 text-neutral-500" id="icon-default" />;
    }
  };

  const getEventTypeName = (type: string) => {
    switch (type) {
      case "customer_review": return "Customer Review";
      case "booking": return "Table/Space Booking";
      case "inventory": return "Inventory Alert";
      case "customer_message": return "Direct Message";
      default: return "Event";
    }
  };

  // Filter Escalations
  const escalatedEvents = events.filter(e => e.decision?.decision === "escalate");

  return (
    <div className="min-h-screen bg-[#F6F6F6] text-[#111111] antialiased selection:bg-neutral-200" id="nova-app-root">
      
      {/* Top Utility Header */}
      <header className="border-b border-neutral-200/60 bg-white/90 backdrop-blur-md sticky top-0 z-30" id="header-utility">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3" id="logo-block">
            <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center text-white font-semibold text-sm tracking-tight shadow-sm">
              N
            </div>
            <div>
              <span className="font-display font-medium text-base tracking-tight block text-neutral-900">
                Nova
              </span>
              <span className="text-[10px] text-neutral-400 font-mono block -mt-1 uppercase tracking-wider">
                Autonomous Business GM
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-6" id="status-block">
            {/* Business Profile Summary */}
            <div className="hidden md:flex items-center space-x-2 text-xs text-neutral-500 border-r border-neutral-200 pr-6">
              <Coffee className="w-3.5 h-3.5 text-neutral-400" />
              <span className="font-medium text-neutral-700">{businessContext?.businessName || "Bloom & Brew Floral Cafe"}</span>
              <span className="text-neutral-300">•</span>
              <span>{businessContext?.hours || "7 AM - 6 PM"}</span>
            </div>

            {/* Model/API Status indicator */}
            <div className="flex items-center space-x-2 bg-neutral-50 border border-neutral-200/80 px-2.5 py-1 rounded-full text-xs">
              <div className={`w-2 h-2 rounded-full ${usingMock ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
              <span className="font-mono text-[11px] text-neutral-600">
                {usingMock ? "MOCK PIPELINE (Missing Key)" : "GEMINI 3.5 ACTIVE"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="main-content">
        
        {/* Welcome Section */}
        <div className="mb-8" id="welcome-header">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-1.5">
                Overview &amp; Action Hub
              </p>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-neutral-900">
                Morning Briefing
              </h1>
            </div>
            
            {/* Demo Trigger Suite */}
            <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border border-neutral-200/80 shadow-sm" id="demo-controls-wrapper">
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 px-2">
                Demo Panel:
              </span>
              <button
                onClick={() => handleInjectEvent(false)}
                disabled={isInjecting}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 active:bg-neutral-200 border border-neutral-200 rounded-lg transition-all focus:ring-1 focus:ring-neutral-400 cursor-pointer disabled:opacity-50"
                id="btn-inject-normal"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Inject Business Event</span>
              </button>
              <button
                onClick={() => handleInjectEvent(true)}
                disabled={isInjecting}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border border-amber-200/60 rounded-lg transition-all focus:ring-1 focus:ring-amber-400 cursor-pointer disabled:opacity-50"
                id="btn-inject-escalation"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Inject Escalation Case</span>
              </button>
              <button
                onClick={handleResetEvents}
                title="Reset Feed"
                className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 active:bg-neutral-100 border border-neutral-100 rounded-lg transition-all cursor-pointer"
                id="btn-reset-feed"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Morning Digest Banner */}
        <section className="mb-10 bg-white border border-neutral-200/80 rounded-2xl p-6 md:p-8 shadow-sm relative overflow-hidden" id="morning-digest-section">
          {/* Subtle elegant design accents */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-radial from-neutral-50 to-transparent pointer-events-none rounded-full translate-x-20 -translate-y-20 opacity-70" />
          
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-3">
                <Sparkles className="w-4 h-4 text-neutral-900" />
                <span className="text-xs font-mono font-medium uppercase tracking-widest text-neutral-500">
                  Nova Daily Summary
                </span>
                {isGeneratingDigest && (
                  <span className="text-[11px] font-mono text-neutral-400 animate-pulse ml-2">
                    (Generating...)
                  </span>
                )}
              </div>
              
              <blockquote className="text-neutral-800 font-display text-lg md:text-xl font-normal leading-relaxed">
                "{morningDigest}"
              </blockquote>
            </div>

            <button
              onClick={fetchDigest}
              disabled={isGeneratingDigest}
              className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 active:bg-black rounded-lg transition-all focus:ring-1 focus:ring-neutral-400 shadow-xs cursor-pointer disabled:opacity-50"
              id="btn-refresh-digest"
            >
              <span>Refresh Recap</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>

        {/* Dashboard Panels Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="dashboard-grid">
          
          {/* Left Column: Escalation Inbox (Human-in-the-Loop) - takes 5 cols */}
          <section className="lg:col-span-5 flex flex-col" id="escalation-column">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center space-x-2">
                <Inbox className="w-4.5 h-4.5 text-neutral-700" />
                <h2 className="font-display text-lg font-semibold text-neutral-900">
                  Escalation Inbox
                </h2>
              </div>
              <span className="px-2 py-0.5 text-xs font-mono font-medium bg-neutral-100 rounded-full text-neutral-600">
                {escalatedEvents.length} Pending
              </span>
            </div>

            {/* Inbox list */}
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-4 shadow-sm flex-1 min-h-[450px]" id="escalation-inbox-card">
              {escalatedEvents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-400" id="inbox-empty">
                  <div className="w-12 h-12 rounded-full bg-neutral-50 flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-6 h-6 text-neutral-300" />
                  </div>
                  <h3 className="font-display text-sm font-medium text-neutral-700">All Escalations Resolved</h3>
                  <p className="text-xs text-neutral-400 mt-1 max-w-[280px]">
                    Nova is successfully running the day-to-day. No manual actions or emergency approvals required.
                  </p>
                </div>
              ) : (
                <div className="space-y-4" id="escalation-list">
                  <p className="text-xs text-neutral-500 mb-2 px-1">
                    These items matched safety guardrails or required high-value custom decisions. Review and craft the response below:
                  </p>
                  
                  {escalatedEvents.map((event) => {
                    const isSelected = draftingEventId === event.id;
                    const hasGuardrail = event.decision?.guardrailTriggered;

                    return (
                      <div 
                        key={event.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isSelected 
                            ? 'bg-neutral-50 border-neutral-900 shadow-xs' 
                            : 'bg-white border-neutral-100 hover:border-neutral-200'
                        }`}
                        id={`escalation-card-${event.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-medium text-neutral-800">{event.sender}</span>
                            <span className="text-[10px] font-mono text-neutral-400">
                              {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                            event.triage?.urgency === 'critical' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-neutral-100 text-neutral-700'
                          }`}>
                            {event.triage?.urgency.toUpperCase() || "HIGH"}
                          </span>
                        </div>

                        {/* Content text */}
                        <p className="text-xs text-neutral-600 mt-2 line-clamp-3 leading-relaxed font-sans">
                          "{event.content}"
                        </p>

                        {/* Reason for escalation */}
                        {event.decision?.reasoning && (
                          <div className="mt-3 bg-neutral-100/50 p-2.5 rounded-lg border border-neutral-200/30 text-[11px] text-neutral-700 flex items-start space-x-1.5">
                            {hasGuardrail ? (
                              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <span className="font-semibold block text-neutral-800">
                                {hasGuardrail ? "Safety Guardrail Override" : "Escalation Reason"}
                              </span>
                              {event.decision.reasoning}
                            </div>
                          </div>
                        )}

                        {/* Interactive Drawer inside Card */}
                        {isSelected ? (
                          <div className="mt-4 pt-3 border-t border-neutral-200/60" id={`resolve-drawer-${event.id}`}>
                            <label className="block text-[11px] font-mono text-neutral-500 uppercase tracking-wider mb-1">
                              Review &amp; Draft Approved Action/Response:
                            </label>
                            <textarea
                              className="w-full text-xs p-2.5 bg-white border border-neutral-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-neutral-900 font-sans min-h-[90px] leading-relaxed"
                              placeholder="Type direct response to customer, supplier dispatch, or log message here..."
                              value={customDraftText}
                              onChange={(e) => setCustomDraftText(e.target.value)}
                            />
                            
                            <div className="flex items-center justify-end space-x-2 mt-3">
                              <button
                                onClick={() => {
                                  setDraftingEventId(null);
                                  setCustomDraftText("");
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-800 transition-all cursor-pointer"
                                id={`btn-cancel-draft-${event.id}`}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleResolveEscalation(event.id)}
                                disabled={isResolving === event.id || !customDraftText.trim()}
                                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg transition-all focus:ring-1 focus:ring-neutral-500 cursor-pointer disabled:opacity-40"
                                id={`btn-approve-${event.id}`}
                              >
                                {isResolving === event.id ? (
                                  <span className="animate-pulse">Processing...</span>
                                ) : (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Approve &amp; Send</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 flex justify-end">
                            <button
                              onClick={() => {
                                setDraftingEventId(event.id);
                                // Prepopulate custom text with a starting suggestion based on the event type
                                if (event.type === "customer_message") {
                                  setCustomDraftText(`Hi ${event.sender}, we're sorry about the trouble. We have received your request and will organize a proper solution. - The Bloom & Brew Team`);
                                } else {
                                  setCustomDraftText(`Hello, thank you for reaching out. We have logged your request regarding "${event.triage?.summary || 'this matter'}" and have initiated direct coordination. - Bloom & Brew Management`);
                                }
                              }}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 active:bg-neutral-200 border border-neutral-200 rounded-lg transition-all cursor-pointer"
                              id={`btn-open-resolver-${event.id}`}
                            >
                              <span>Review &amp; Act</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Right Column: Live Activity Feed - takes 7 cols */}
          <section className="lg:col-span-7 flex flex-col" id="activity-column">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4.5 h-4.5 text-neutral-700" />
                <h2 className="font-display text-lg font-semibold text-neutral-900">
                  Live Activity Feed
                </h2>
              </div>
              <span className="text-xs text-neutral-500 font-mono">
                Real-time Monitoring
              </span>
            </div>

            {/* Activity feed list */}
            <div className="space-y-4" id="activity-feed">
              {events.map((event) => {
                const isProcessing = event.status === 'processing';
                const isEscalated = event.decision?.decision === 'escalate';
                const isActed = event.decision?.decision === 'act';
                const isWaiting = event.decision?.decision === 'wait';

                return (
                  <div 
                    key={event.id}
                    className={`bg-white border rounded-2xl p-5 shadow-xs transition-all relative overflow-hidden ${
                      isProcessing 
                        ? 'border-neutral-200/80 bg-neutral-50/50' 
                        : isEscalated 
                          ? 'border-amber-200 bg-white' 
                          : 'border-neutral-100'
                    }`}
                    id={`activity-card-${event.id}`}
                  >
                    {/* Visual Status Rail Line */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                      isProcessing 
                        ? 'bg-neutral-300 animate-pulse' 
                        : isEscalated 
                          ? 'bg-amber-400' 
                          : isActed 
                            ? 'bg-emerald-400' 
                            : 'bg-neutral-300'
                    }`} />

                    {/* Top row */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center">
                          {getEventIcon(event.type)}
                        </div>
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">
                            {getEventTypeName(event.type)}
                          </span>
                          <span className="text-xs font-semibold text-neutral-800 block">
                            {event.sender}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 text-right">
                        <span className="text-[10px] font-mono text-neutral-400">
                          {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>

                        {/* Process status indicators */}
                        {isProcessing ? (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-neutral-100 text-[10px] font-mono font-medium text-neutral-600 border border-neutral-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-brainwave" />
                            <span>Thinking...</span>
                          </span>
                        ) : isEscalated ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-[10px] font-mono font-medium text-amber-800 border border-amber-200">
                            <AlertCircleIcon className="w-3 h-3" />
                            <span>Escalated</span>
                          </span>
                        ) : isActed ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-[10px] font-mono font-medium text-emerald-800 border border-emerald-200">
                            <CheckCircleIcon className="w-3 h-3" />
                            <span>Autonomously Acted</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-neutral-50 text-[10px] font-mono font-medium text-neutral-600 border border-neutral-200">
                            <Hourglass className="w-3 h-3" />
                            <span>Waiting</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Original Message Block */}
                    <div className="mt-4 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                      <span className="text-[10px] font-mono text-neutral-400 block mb-1">Incoming Business Event:</span>
                      <p className="text-xs text-neutral-700 font-sans leading-relaxed">
                        "{event.content}"
                      </p>
                    </div>

                    {/* Processing Output Breakdown */}
                    {!isProcessing && (event.triage || event.decision) && (
                      <div className="mt-4 space-y-3 pt-3 border-t border-neutral-100" id={`analysis-${event.id}`}>
                        
                        {/* Gemini Reasoning & Decision Output */}
                        {event.decision && (
                          <div>
                            <span className="text-[10px] font-mono text-neutral-400 block mb-1">Nova Reasoning:</span>
                            <p className="text-xs text-neutral-600 font-sans leading-relaxed">
                              {event.decision.reasoning}
                            </p>
                          </div>
                        )}

                        {/* Category & Sentiment Details */}
                        {event.triage && (
                          <div className="flex flex-wrap items-center gap-3 mt-1.5">
                            <span className="text-[10px] font-mono text-neutral-500 bg-neutral-50 border border-neutral-100 px-2 py-0.5 rounded-md">
                              Sentiment: <span className={
                                event.triage.sentiment === 'positive' ? 'text-emerald-700 font-medium' :
                                event.triage.sentiment === 'negative' ? 'text-amber-700 font-medium' : 'text-neutral-600'
                              }>{event.triage.sentiment.toUpperCase()}</span>
                            </span>
                            <span className="text-[10px] font-mono text-neutral-500 bg-neutral-50 border border-neutral-100 px-2 py-0.5 rounded-md">
                              Urgency: <span className="font-medium text-neutral-700">{event.triage.urgency.toUpperCase()}</span>
                            </span>
                          </div>
                        )}

                        {/* Action Text Taken (If 'act' decision was chosen) */}
                        {isActed && event.action && (
                          <div className="mt-3.5 pt-3.5 border-t border-neutral-100 bg-neutral-50/50 p-3 rounded-xl border border-neutral-200/40">
                            <div className="flex items-center space-x-1.5 mb-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="text-xs font-semibold text-emerald-950">
                                {event.action.actionTaken}
                              </span>
                            </div>
                            <blockquote className="text-xs text-neutral-600 bg-white p-2.5 rounded-lg border border-neutral-200/40 font-mono leading-relaxed whitespace-pre-wrap">
                              {event.action.draftResponse}
                            </blockquote>
                          </div>
                        )}

                        {/* Manual Resolution Text (If completed after escalation) */}
                        {event.status === 'completed' && isActed && !event.action && (
                          <div className="mt-3 bg-neutral-50 p-3 rounded-xl border border-neutral-200/40 text-xs">
                            <span className="font-semibold block text-neutral-800">Action Resolved by Manager</span>
                            <p className="text-neutral-600 mt-1 font-mono">Action processed and dispatched successfully.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fatal Error Fallback Indicator */}
                    {event.status === 'failed' && (
                      <div className="mt-4 bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start space-x-2">
                        <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold block">Pipeline Processing Failure</span>
                          <p className="text-amber-700">{event.error || "Reasoning error occured. Event marked as Escalated for safety."}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      {/* Decorative footer */}
      <footer className="bg-white border-t border-neutral-200/60 mt-20 py-8 text-center text-xs text-neutral-400 font-mono" id="app-footer">
        <p>© 2026 Bloom &amp; Brew Cafe. Guided by Nova Autonomous Systems.</p>
      </footer>
    </div>
  );
}

// Inline minimalist micro-icons to prevent bulky imports
function AlertCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3 h-3"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CheckCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3 h-3"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
