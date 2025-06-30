// OpenAI ChatCompletionMessage types
export interface ChatCompletionUserMessage {
  role: 'user';
  content: string;
}

export interface ChatCompletionAssistantMessage {
  role: 'assistant';
  content: string | null;
  tool_calls?: {
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }[];
}

export interface ChatCompletionSystemMessage {
  role: 'system';
  content: string;
}

export interface ChatCompletionToolMessage {
  role: 'tool';
  tool_call_id: string;
  content: string;
}

export type ChatCompletionMessage =
  | ChatCompletionUserMessage
  | ChatCompletionAssistantMessage
  | ChatCompletionSystemMessage
  | ChatCompletionToolMessage;