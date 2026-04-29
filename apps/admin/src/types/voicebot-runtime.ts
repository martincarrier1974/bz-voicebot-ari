export type PublishedVoicebotPromptSet = {
  main: string;
  greeting: string;
  silence: string;
  clarification: string;
  fallback: string;
  transferSupport: string;
  transferSales: string;
  transferReception: string;
};

export type PublishedVoicebotContext = {
  name: string;
  description: string;
  instructions: string;
  voiceTone: string;
  rules: string;
  limits: string;
  responseExamples: string;
};

export type PublishedVoicebotRoute = {
  serviceName: string;
  extension: string;
  priority: number;
  keywords: string[];
};

export type PublishedVoicebotIntent = {
  label: string;
  keywords: string[];
  response: string;
  finalAction: string;
  destinationPost: string;
  priority: number;
  routeServiceName: string | null;
};

export type PublishedVoicebotFlow = {
  name: string;
  welcomeMessage: string;
  silencePrompt: string;
  ambiguousPrompt: string;
  fallbackPrompt: string;
  finalAction: string;
  destinationLabel: string;
  destinationPost: string;
  maxFailedAttempts: number;
  contextName: string | null;
  intents: PublishedVoicebotIntent[];
};

export type PublishedVoicebotDirectoryContact = {
  extension: string;
  name: string;
  aliases: string[];
  voicemail: string | null;
  tech: string | null;
};

export type PublishedBookingService = {
  name: string;
  slug: string;
  description: string | null;
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
};

export type PublishedCalendarConnection = {
  name: string;
  provider: string;
  tenantId: string | null;
  clientId: string | null;
  clientSecret: string | null;
  refreshToken: string | null;
  accountEmail: string | null;
  defaultCalendarId: string | null;
  timezone: string | null;
};

export type PublishedCalendarResource = {
  name: string;
  employeeName: string | null;
  calendarId: string;
  calendarAddress: string | null;
  timezone: string | null;
  bookingNotes: string | null;
  connectionName: string;
  provider: string;
  supportedServices: Array<{
    serviceSlug: string;
    serviceName: string;
    priority: number;
  }>;
};

export type PublishedVoicebotConfig = {
  version: number;
  generatedAt: string;
  companyName: string;
  prompts: PublishedVoicebotPromptSet;
  settings: Record<string, string>;
  context: PublishedVoicebotContext | null;
  routes: PublishedVoicebotRoute[];
  flows: PublishedVoicebotFlow[];
  directoryContacts: PublishedVoicebotDirectoryContact[];
  bookingServices: PublishedBookingService[];
  calendarConnections: PublishedCalendarConnection[];
  calendarResources: PublishedCalendarResource[];
};

export type CallRuntimeState = {
  session: {
    callId: string;
    sessionId: string;
    startedAt: number;
    updatedAt: number;
    language: string;
    businessName: string;
  };
  audio: {
    isListening: boolean;
    isSpeaking: boolean;
    isMuted: boolean;
    bargeInEnabled: boolean;
    silenceCount: number;
  };
  nlu: {
    currentIntent: string;
    confidence: number;
    extractedEntities: Record<string, unknown>;
    needsClarification: boolean;
  };
  flow: {
    currentStep: string;
    retryCount: number;
    maxRetries: number;
    transferTarget: string;
  };
  history: Array<Record<string, unknown>>;
  flags: {
    handoffRequested: boolean;
    transferLocked: boolean;
    callEnded: boolean;
    debugMode: boolean;
  };
  metadata: Record<string, unknown>;
};

export type LiveCallsSnapshot = {
  updatedAt: string;
  count: number;
  calls: CallRuntimeState[];
};

export function createInitialCallRuntimeState(input?: {
  callId?: string;
  sessionId?: string;
  businessName?: string;
  language?: string;
  maxRetries?: number;
  debugMode?: boolean;
}): CallRuntimeState {
  return {
    session: {
      callId: input?.callId ?? crypto.randomUUID(),
      sessionId: input?.sessionId ?? crypto.randomUUID(),
      startedAt: Date.now(),
      updatedAt: Date.now(),
      language: input?.language ?? "fr",
      businessName: input?.businessName ?? "BZ Telecom",
    },
    audio: {
      isListening: false,
      isSpeaking: false,
      isMuted: false,
      bargeInEnabled: true,
      silenceCount: 0,
    },
    nlu: {
      currentIntent: "unknown",
      confidence: 0,
      extractedEntities: {},
      needsClarification: false,
    },
    flow: {
      currentStep: "welcome",
      retryCount: 0,
      maxRetries: input?.maxRetries ?? 2,
      transferTarget: "NONE",
    },
    history: [],
    flags: {
      handoffRequested: false,
      transferLocked: false,
      callEnded: false,
      debugMode: input?.debugMode ?? false,
    },
    metadata: {},
  };
}
