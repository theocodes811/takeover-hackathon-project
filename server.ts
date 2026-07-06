import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { BusinessEvent, BusinessContext } from "./src/types";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Shared Business Context
const BUSINESS_CONTEXT: BusinessContext = {
  businessName: "Bloom & Brew Floral Cafe",
  businessType: "Floral Shop & Artisan Cafe",
  hours: "7:00 AM - 6:00 PM",
  tone: "Warm, welcoming, polite, and helpful, with a touch of botanical charm.",
  policies: {
    refundLimit: 50.0,
    cancellationWindow: "24 hours",
    deliveryRadiusMiles: 10
  }
};

// Lazy initialization of Gemini client
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    throw new Error("API_KEY_MISSING");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Default preloaded completed events to start with a beautiful, populated state
const DEFAULT_EVENTS: BusinessEvent[] = [
  {
    id: "init-1",
    timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
    sender: "Sarah Jenkins",
    content: "Absolutely loved the lavender latte and the custom orchid bouquet I got! Staff was incredibly friendly.",
    type: "customer_review",
    status: "completed",
    triage: {
      category: "customer_review",
      urgency: "low",
      sentiment: "positive",
      summary: "Highly positive review praising the lavender latte, custom orchid bouquet, and friendly baristas."
    },
    decision: {
      decision: "act",
      reasoning: "Review is highly positive with no complaints. Auto-reply thanking Sarah fits Bloom & Brew's warm brand voice and builds loyalty.",
      guardrailTriggered: false
    },
    action: {
      actionTaken: "Posted a warm thank you response",
      draftResponse: "Sarah, thank you so much for the lovely note! We are absolutely thrilled you enjoyed the lavender latte and your custom orchid bouquet. Our team loved hosting you! We can't wait to see you again soon at Bloom & Brew. - The Bloom & Brew Team"
    }
  },
  {
    id: "init-2",
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    sender: "Nova Inventory System",
    content: "Alert: Oat milk stock is running low. Only 2 cartons remaining in stock.",
    type: "inventory",
    status: "completed",
    triage: {
      category: "inventory",
      urgency: "medium",
      sentiment: "neutral",
      summary: "Automated alert indicating oat milk inventory has dropped to critical levels."
    },
    decision: {
      decision: "act",
      reasoning: "Oat milk is a high-volume essential ingredient for cafe operations. Automated restock triggers safe ordering limits.",
      guardrailTriggered: false
    },
    action: {
      actionTaken: "Generated replenishment supplier order",
      draftResponse: "Nova Automated Inventory Dispatch:\nReplenishment order of 12 cartons of Organic Barista Oat Milk has been compiled and dispatched to Pacific Dairy Distribution. Scheduled delivery: Tomorrow morning before opening (7:00 AM)."
    }
  },
  {
    id: "init-3",
    timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
    sender: "James Miller",
    content: "Hi! Table reservation request for a group of 4 people on Saturday at 10:00 AM for brunch.",
    type: "booking",
    status: "completed",
    triage: {
      category: "booking",
      urgency: "low",
      sentiment: "neutral",
      summary: "Brunch reservation request for 4 people this Saturday at 10:00 AM."
    },
    decision: {
      decision: "act",
      reasoning: "Requested time falls well within standard business operating hours. Group size of 4 conforms to standard table allocation policies.",
      guardrailTriggered: false
    },
    action: {
      actionTaken: "Confirmed reservation & dispatched confirmation",
      draftResponse: "Hi James, we would love to host you and your group! We've confirmed your reservation for 4 guests this Saturday at 10:00 AM. We have saved a beautiful table for you right next to our botanical orchid corner. If anything changes, let us know! See you soon. - Bloom & Brew Cafe"
    }
  }
];

// In-Memory state for the active business operations list
let currentEvents: BusinessEvent[] = [...DEFAULT_EVENTS];

// Pools for demo injection
const POOL_OF_NORMAL_EVENTS = [
  {
    sender: "Alice Rivera",
    content: "Hey, do you deliver custom flower arrangements to the Westside area? It is about 8 miles from your location.",
    type: "customer_message" as const
  },
  {
    sender: "MatchaLover22 (Review)",
    content: "The barista who made my matcha latte today was so incredibly nice! She even drew a little leaf pattern in the foam. Best morning ever.",
    type: "customer_review" as const
  },
  {
    sender: "Nova Inventory System",
    content: "Alert: Fresh lavender stems stock below minimum threshold. Current: 5 bunches. Reorder trigger level: 10 bunches.",
    type: "inventory" as const
  },
  {
    sender: "Carlos Mendoza",
    content: "Hi! Do you do wedding flower catering? Looking for a quote and consultation for a mid-October wedding.",
    type: "customer_message" as const
  },
  {
    sender: "Chloe Chang",
    content: "Review: Flower bouquet was gorgeous, but order #1021 was delayed by 30 minutes. Missed the very start of our bridal shower brunch.",
    type: "customer_review" as const
  }
];

const POOL_OF_ESCALATION_EVENTS = [
  {
    sender: "Marcus Vance",
    content: "I had your almond milk cappuccino yesterday and broke out in severe hives. I think there was major cross-contamination with peanuts or dairy, which I'm highly allergic to! I had to go to the hospital.",
    type: "customer_message" as const
  },
  {
    sender: "Regina George",
    content: "I spent $350 on catering flowers for our anniversary party, but the delivery never arrived. I want a full refund of $350 immediately and compensation for ruining my party!",
    type: "customer_message" as const
  },
  {
    sender: "Arthur Pendelton",
    content: "Your delivery van backed into our mailbox and smashed our decorative stone planter. It will cost at least $450 to repair. If you do not pay us back within 48 hours, my lawyer will contact you and we will file a lawsuit.",
    type: "customer_message" as const
  },
  {
    sender: "Luna Entertainment",
    content: "Hi, we want to rent out your entire cafe and flower shop space next Friday evening for a film shoot from 8 PM to 2 AM. We have a crew of 25 people and need full power hookups. We can pay $1000.",
    type: "booking" as const
  }
];

// Hardcoded Safety Guardrail logic
function checkSafetyGuardrails(text: string): { triggered: boolean; rule: string } {
  const lower = text.toLowerCase();
  
  // Guardrail 1: Legal/Lawsuit threats
  if (lower.includes("legal") || lower.includes("lawsuit") || lower.includes("lawyer") || lower.includes("sue") || lower.includes("court")) {
    return { 
      triggered: true, 
      rule: "Safety Guardrail: Legal keyword detected. Autonomous client-facing communications suspended to prevent operational liability." 
    };
  }
  
  // Guardrail 2: Health / Safety / Allergies / Hospitalization
  if (lower.includes("injury") || lower.includes("hives") || lower.includes("allergic") || lower.includes("allergy") || lower.includes("hospital") || lower.includes("peanut") || lower.includes("contamination")) {
    return { 
      triggered: true, 
      rule: "Safety Guardrail: Health and safety hazard / allergy warning detected. Mandatory manual escalation triggered for health safety protocol." 
    };
  }
  
  // Guardrail 3: High-value refund or compensation (refund mention where there's a big amount or "compensation")
  if (lower.includes("compensation") || (lower.includes("refund") && (lower.includes("350") || lower.includes("500") || lower.includes("hundred") || lower.includes("thousand")))) {
    return { 
      triggered: true, 
      rule: "Safety Guardrail: High-value refund request or financial compensation claim exceeds digital policy cap ($50.00). Forced escalation." 
    };
  }

  return { triggered: false, rule: "" };
}

// Simulated fallback pipeline when Gemini API Key is missing or invalid
async function runMockPipeline(event: { sender: string; content: string; type: 'customer_review' | 'booking' | 'inventory' | 'customer_message' }): Promise<BusinessEvent> {
  const id = "evt-" + Math.random().toString(36).substr(2, 9);
  const guard = checkSafetyGuardrails(event.content);
  
  // Create intermediate state
  const mockEvent: BusinessEvent = {
    id,
    timestamp: new Date().toISOString(),
    sender: event.sender,
    content: event.content,
    type: event.type,
    status: "completed"
  };

  // Mock Triage
  let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
  let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
  
  if (event.content.includes("loved") || event.content.includes("nice")) {
    sentiment = "positive";
  } else if (event.content.includes("delayed") || event.content.includes("hives") || event.content.includes("smashed") || event.content.includes("never arrived")) {
    sentiment = "negative";
  }

  if (event.content.includes("hives") || event.content.includes("allergic") || event.content.includes("lawyer")) {
    urgency = "critical";
  } else if (event.content.includes("350") || event.content.includes("refund") || event.content.includes("below minimum")) {
    urgency = "high";
  } else if (event.content.includes("wedding") || event.content.includes("shoot")) {
    urgency = "medium";
  }

  mockEvent.triage = {
    category: event.type,
    urgency,
    sentiment,
    summary: `[Simulator] Processed ${event.type} from ${event.sender}.`
  };

  // Mock Decision
  let decision: 'act' | 'wait' | 'escalate' = 'act';
  let reasoning = "Automatically triaged. Standard flow handles review / stock alerts comfortably.";
  
  if (guard.triggered) {
    decision = "escalate";
    reasoning = `System classified this as an operational hazard. ${guard.rule}`;
  } else if (event.content.includes("rent out") || event.content.includes("film shoot")) {
    decision = "escalate";
    reasoning = "Requested rental hours (8 PM - 2 AM) exceed standard business operations (7 AM - 6 PM). Manual scheduling required.";
  }

  mockEvent.decision = {
    decision,
    reasoning,
    guardrailTriggered: guard.triggered,
    guardrailRule: guard.triggered ? guard.rule : undefined
  };

  // Mock Action
  if (decision === "act") {
    let actionTaken = "Automated reply generated";
    let draftResponse = "";

    if (event.type === "customer_review" && sentiment === "positive") {
      actionTaken = "Posted appreciative review reply";
      draftResponse = `Thank you so much, ${event.sender}! We love serving you and look forward to your next visit! - Bloom & Brew Cafe`;
    } else if (event.type === "customer_review" && sentiment === "negative") {
      actionTaken = "Drafted apology & coupon dispatch";
      draftResponse = `Hi Chloe, we are so sorry to hear order #1021 was delayed. We strive for excellence. Please accept a $10 cafe voucher on us.`;
    } else if (event.type === "inventory") {
      actionTaken = "Dispatched supplier replenishment order";
      draftResponse = `Restock order dispatched automatically to regional suppliers for standard delivery.`;
    } else {
      actionTaken = "Sent wedding guide / info packet";
      draftResponse = `Hi Carlos, we would love to help! Here is our wedding guide brochure. Let's set up a consultation call.`;
    }

    mockEvent.action = {
      actionTaken,
      draftResponse
    };
  }

  return mockEvent;
}

// Server API Routes

// Get business context
app.get("/api/context", (req, res) => {
  res.json(BUSINESS_CONTEXT);
});

// Get current event feed state
app.get("/api/events", (req, res) => {
  res.json({
    events: currentEvents,
    usingMockModel: !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY"
  });
});

// Clear/Reset events
app.post("/api/events/clear", (req, res) => {
  currentEvents = [...DEFAULT_EVENTS];
  res.json({ success: true, events: currentEvents });
});

// Resolve an escalated event
app.post("/api/events/resolve", (req, res) => {
  const { id, draftResponse } = req.body;
  const eventIdx = currentEvents.findIndex(e => e.id === id);
  
  if (eventIdx !== -1) {
    const updated = { ...currentEvents[eventIdx] };
    updated.status = 'completed';
    // Modify decision to act, meaning human approved
    if (updated.decision) {
      updated.decision.decision = 'act';
    }
    updated.action = {
      actionTaken: "Approved & Resolved by Manager",
      draftResponse: draftResponse || "Action handled manually."
    };
    currentEvents[eventIdx] = updated;
    res.json({ success: true, event: updated });
  } else {
    res.status(404).json({ error: "Event not found" });
  }
});

// Inject a new event
app.post("/api/events/inject", async (req, res) => {
  const { forceEscalation } = req.body;
  
  // Pick random event from appropriate pool
  const pool = forceEscalation ? POOL_OF_ESCALATION_EVENTS : POOL_OF_NORMAL_EVENTS;
  const randomPick = pool[Math.floor(Math.random() * pool.length)];
  
  const id = "evt-" + Math.random().toString(36).substr(2, 9);
  
  // Create an initial processing placeholder so the frontend can immediately show the card in a "thinking" state
  const pendingEvent: BusinessEvent = {
    id,
    timestamp: new Date().toISOString(),
    sender: randomPick.sender,
    content: randomPick.content,
    type: randomPick.type,
    status: 'processing'
  };
  
  // Prepend to current list
  currentEvents.unshift(pendingEvent);

  const usingMock = !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY";

  if (usingMock) {
    // Wait a brief simulated latency (1.5 seconds) to mimic real Gemini AI pipeline processing
    setTimeout(async () => {
      try {
        const processed = await runMockPipeline(randomPick);
        processed.id = id; // maintain same ID
        processed.timestamp = pendingEvent.timestamp;
        
        // Update in list
        const idx = currentEvents.findIndex(e => e.id === id);
        if (idx !== -1) {
          currentEvents[idx] = processed;
        }
      } catch (err) {
        console.error(err);
      }
    }, 1500);
    
    return res.json({ success: true, eventId: id, usingMock: true });
  }

  // Real Gemini Pipeline runs asynchronously so client gets immediate ack, 
  // and the client can poll `/api/events` or the pipeline completes and we push to feed
  // Let's run it in a background promise so we don't block the request. 
  // The client will poll or view the processing status. This is extremely robust!
  runRealGeminiPipeline(id, randomPick)
    .then(processed => {
      const idx = currentEvents.findIndex(e => e.id === id);
      if (idx !== -1) {
        currentEvents[idx] = processed;
      }
    })
    .catch(err => {
      console.error("Gemini pipeline failure:", err);
      const idx = currentEvents.findIndex(e => e.id === id);
      if (idx !== -1) {
        currentEvents[idx].status = 'failed';
        currentEvents[idx].error = err.message || "Failed during AI reasoning pipeline";
      }
    });

  res.json({ success: true, eventId: id, usingMock: false });
});

// Real Gemini Pipeline implementation
async function runRealGeminiPipeline(id: string, event: { sender: string; content: string; type: 'customer_review' | 'booking' | 'inventory' | 'customer_message' }): Promise<BusinessEvent> {
  const ai = getGemini();
  const modelName = "gemini-3.5-flash";

  const resultEvent: BusinessEvent = {
    id,
    timestamp: new Date().toISOString(),
    sender: event.sender,
    content: event.content,
    type: event.type,
    status: 'processing'
  };

  // STEP 1: TRIAGE STEP
  let triageResult;
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `You are Nova, an AI General Manager triaging an incoming business event.
Analyze the following event content and classify it.

Event Content: "${event.content}"

Respond with strict JSON matching the required schema. Ensure the summary is a short, concise sentence.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              enum: ["customer_review", "booking", "inventory", "customer_message"],
              description: "Classify the event into one of the four categories."
            },
            urgency: {
              type: Type.STRING,
              enum: ["low", "medium", "high", "critical"],
              description: "The urgency of the event."
            },
            sentiment: {
              type: Type.STRING,
              enum: ["positive", "neutral", "negative"],
              description: "The sentiment expressed in the event."
            },
            summary: {
              type: Type.STRING,
              description: "A very brief, one-sentence summary of the event."
            }
          },
          required: ["category", "urgency", "sentiment", "summary"]
        }
      }
    });

    triageResult = JSON.parse(response.text.trim());
    resultEvent.triage = triageResult;
  } catch (err) {
    console.error("Triage parsing failure, applying fallback triage", err);
    triageResult = {
      category: event.type,
      urgency: 'high',
      sentiment: 'neutral',
      summary: "Automatic fallback summary due to triage system parsing error."
    };
    resultEvent.triage = triageResult;
  }

  // Check safety guardrails first on event content
  const guard = checkSafetyGuardrails(event.content);

  // STEP 2: DECISION STEP
  let decisionResult;
  if (guard.triggered) {
    // If safety guardrail is triggered, bypass the Gemini decision and force escalate
    decisionResult = {
      decision: "escalate" as const,
      reasoning: `Safety Guardrail triggered: ${guard.rule}`
    };
    resultEvent.decision = {
      decision: "escalate",
      reasoning: decisionResult.reasoning,
      guardrailTriggered: true,
      guardrailRule: guard.rule
    };
  } else {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: `You are Nova, the AI General Manager. You need to make an operational decision for an incoming event.
You must choose between:
- "act": Nova can handle this autonomously according to business context and policies.
- "wait": Nova should hold or wait for more information.
- "escalate": Nova needs human judgment or manual intervention because of policy boundaries, complexity, negative sentiment, or high priority.

Business Context & Policies:
- Business Name: ${BUSINESS_CONTEXT.businessName}
- Type: ${BUSINESS_CONTEXT.businessType}
- Operating Hours: ${BUSINESS_CONTEXT.hours}
- Tone: ${BUSINESS_CONTEXT.tone}
- Refund Limit: $${BUSINESS_CONTEXT.policies.refundLimit}
- Cancellation Window: ${BUSINESS_CONTEXT.policies.cancellationWindow}
- Delivery Radius: ${BUSINESS_CONTEXT.policies.deliveryRadiusMiles} miles

Event details:
- Content: "${event.content}"
- Classifications: Category: ${triageResult.category}, Urgency: ${triageResult.urgency}, Sentiment: ${triageResult.sentiment}

Respond with strict JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              decision: {
                type: Type.STRING,
                enum: ["act", "wait", "escalate"],
                description: "Decide whether Nova can handle this ('act'), should wait for external conditions ('wait'), or needs human intervention ('escalate')."
              },
              reasoning: {
                type: Type.STRING,
                description: "Detailed, professional reasoning explaining why this decision was made under the business's policies and context."
              }
            },
            required: ["decision", "reasoning"]
          }
        }
      });

      decisionResult = JSON.parse(response.text.trim());
      resultEvent.decision = {
        decision: decisionResult.decision,
        reasoning: decisionResult.reasoning,
        guardrailTriggered: false
      };
    } catch (err) {
      console.error("Decision parsing failure, falling back to escalate", err);
      resultEvent.decision = {
        decision: "escalate",
        reasoning: "System parsing failure. Escalated to prevent unauthorized automatic processing.",
        guardrailTriggered: false
      };
    }
  }

  // STEP 3: ACTION STEP (Only if decision is 'act')
  if (resultEvent.decision.decision === "act") {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: `You are Nova, the AI General Manager. You have decided to "act" (autonomously handle) the following event.
Generate the response, message, or system log corresponding to this action. Adhere strictly to the business tone and guidelines.

Business Context:
- Business Name: ${BUSINESS_CONTEXT.businessName}
- Business Type: ${BUSINESS_CONTEXT.businessType}
- Tone: ${BUSINESS_CONTEXT.tone}

Event Content: "${event.content}"
Event Category: ${triageResult.category}

Respond with strict JSON containing 'actionTaken' and 'draftResponse'.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              actionTaken: {
                type: Type.STRING,
                description: "A clear, brief label describing what action Nova took (e.g., 'Drafted warm review reply', 'Scheduled restocking alert')."
              },
              draftResponse: {
                type: Type.STRING,
                description: "The professional, beautifully written response draft or automated system message. Address the customer directly and adhere to the business's tone of voice and guidelines."
              }
            },
            required: ["actionTaken", "draftResponse"]
          }
        }
      });

      const actionResult = JSON.parse(response.text.trim());
      resultEvent.action = actionResult;
    } catch (err) {
      console.error("Action parsing failure", err);
      resultEvent.action = {
        actionTaken: "Action failed during generation",
        draftResponse: "Draft generation timed out or failed. Manual review suggested."
      };
    }
  }

  resultEvent.status = 'completed';
  return resultEvent;
}

// Generate the Morning Digest summary
app.get("/api/digest", async (req, res) => {
  const usingMock = !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY";
  
  if (currentEvents.length === 0) {
    return res.json({
      digest: "Bloom & Brew is completely quiet today. There are no recent events or activities to summarize. All systems running normally.",
      timestamp: new Date().toISOString()
    });
  }

  // Compile a list of actions/escalations for the model
  const logsText = currentEvents.map(e => {
    const outcome = e.status === 'processing' 
      ? 'Processing...' 
      : e.decision?.decision === 'act' 
        ? `Nova acted autonomously (${e.action?.actionTaken || 'N/A'})` 
        : e.decision?.decision === 'wait' 
          ? 'Nova is waiting' 
          : 'Escalated to human supervisor';
    return `- [${e.type}] from ${e.sender}: "${e.content}" (Outcome: ${outcome})`;
  }).join("\n");

  if (usingMock) {
    // Generate a beautiful mock digest summaries depending on current state of events
    const escalations = currentEvents.filter(e => e.decision?.decision === 'escalate');
    const actionsCount = currentEvents.filter(e => e.decision?.decision === 'act').length;
    
    let mockDigest = "";
    if (escalations.length > 0) {
      mockDigest = `Bloom & Brew is operating smoothly with ${actionsCount} customer response${actionsCount === 1 ? '' : 's'} handled autonomously. However, ${escalations.length} critical issue${escalations.length === 1 ? '' : 's'} involving allergy complaints or high-value refund requests require your immediate managerial review in the Escalation Inbox.`;
    } else {
      mockDigest = `Today is off to a wonderful start at Bloom & Brew. Nova has successfully managed ${actionsCount} operations autonomously, including customer review thank-yous and low stock inventory orders. All queues are fully resolved with zero pending escalations.`;
    }
    
    return res.json({ digest: mockDigest, timestamp: new Date().toISOString() });
  }

  try {
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `You are Nova, the AI General Manager. Summarize the actions taken today based on the log of events below.
Produce a brief, elegant 2-to-3 sentence plain-English summary highlighting key achievements and any escalated issues.
Keep the summary concise, professional, warm, and highly polished. Do not use bullet points or markdown formatting inside the summary string.

Event Logs:
${logsText}`,
    });

    res.json({
      digest: response.text.trim(),
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("Failed to generate digest via Gemini:", err);
    res.status(500).json({ error: err.message || "Failed to generate digest" });
  }
});

// Vite & Static file handler setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Nova Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
