export interface BusinessEvent {
  id: string;
  timestamp: string;
  sender: string;
  content: string;
  type: 'customer_review' | 'booking' | 'inventory' | 'customer_message';
  
  // Pipeline processing status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  // Triage step output
  triage?: {
    category: 'customer_review' | 'booking' | 'inventory' | 'customer_message';
    urgency: 'low' | 'medium' | 'high' | 'critical';
    sentiment: 'positive' | 'neutral' | 'negative';
    summary: string;
  };
  
  // Decision step output
  decision?: {
    decision: 'act' | 'wait' | 'escalate';
    reasoning: string;
    guardrailTriggered?: boolean;
    guardrailRule?: string;
  };
  
  // Action step output
  action?: {
    actionTaken: string;
    draftResponse: string;
  };
  
  error?: string;
}

export interface BusinessContext {
  businessName: string;
  businessType: string;
  hours: string;
  tone: string;
  policies: {
    refundLimit: number;
    cancellationWindow: string;
    deliveryRadiusMiles: number;
  };
}

export interface DigestResponse {
  digest: string;
  timestamp: string;
}
