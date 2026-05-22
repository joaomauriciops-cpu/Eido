export type ExtractedTask = {
  title: string;
  description?: string;
  due_date?: string | null;
  confidence: number;
};

export type ExtractedEvent = {
  title: string;
  start_time?: string | null;
  end_time?: string | null;
  confidence: number;
};

export type ExtractedIdea = {
  title: string;
  content: string;
};

export type ExtractionResult = {
  summary: string;
  tasks: ExtractedTask[];
  events: ExtractedEvent[];
  ideas: ExtractedIdea[];
  notes: string[];
};