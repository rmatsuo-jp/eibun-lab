export interface Mistake {
  category: string;
  original: string;
  corrected: string;
  explanation: string;
}

export interface CorrectionSession {
  id: string;
  date: string;
  original: string;
  corrected: string;
  mistakes: Mistake[];
}
