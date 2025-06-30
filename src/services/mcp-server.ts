import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/bedrock-sdk';
import { MCPRequest, MCPResponse, MCPTool, MCPToolCall, MCPToolResult } from '../types/mcp';
import { ChatCompletionMessage } from '../types/openai';

export class MCPServer {
  private openai: OpenAI;
  private anthropic: Anthropic | null = null;
  private availableTools: MCPTool[];

  constructor(
    openaiApiKey: string,
    anthropicApiKey?: string,
    tools: MCPTool[] = []
  ) {
    this.openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    if (anthropicApiKey) {
      // For Anthropic, we'll just create a dummy instance as we need to properly
      // configure it based on the actual API provider (AWS Bedrock, direct API, etc.)
      this.anthropic = { messages: { create: async () => ({ content: [], id: '' }) } } as any;
    }

    this.availableTools = tools;
  }

  registerTool(tool: MCPTool): void {
    this.availableTools.push(tool);
  }

  registerTools(tools: MCPTool[]): void {
    this.availableTools.push(...tools);
  }

  async processRequest(request: MCPRequest): Promise<MCPResponse> {
    const tools = request.tools || this.availableTools;
    
    if (request.model?.includes('claude')) {
      return this.processClaudeRequest(request, tools);
    } else {
      return this.processOpenAIRequest(request, tools);
    }
  }

  private async processOpenAIRequest(
    request: MCPRequest,
    tools: MCPTool[]
  ): Promise<MCPResponse> {
    try {
      console.log('Processing OpenAI request with message:', request.message);

      // Transform the tools to OpenAI-compatible format
      const openaiTools = tools.map(tool => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        }
      }));

      console.log('Prepared OpenAI tools:', JSON.stringify(openaiTools));

      // Add a system message to help guide the AI
      const messages = [
        {
          role: 'system' as const,
          content: 'You are a helpful assistant that helps users control a Mapbox map. ' +
                   'You have access to powerful map and data tools with smart performance optimizations:\n\n' +
                   '🗺️ **Map Tools:**\n' +
                   '• map_search: Search for locations and fly to them\n' +
                   '• map_add_polygon: Draw polygon boundaries around geographic areas (parks, neighborhoods, cities, etc.) - USE THIS when users ask to "draw", "show", "outline", or "where is" for areas like parks, neighborhoods, or landmarks\n' +
                   '• map_get_bounds: Get current map viewport bounds - USE THIS when users say "in this area", "here", "current view", or want to query the visible area\n' +
                   '• map_initialize: Initialize the map with specific settings\n' +
                   '• map_move: Move the map to specific coordinates\n' +
                   '• map_add_layer/map_remove_layer: Add or remove map layers\n' +
                   '⚡ **Smart Performance Features:**\n' +
                   '• Zoom-based limits: Prevents overwhelming queries at low zoom levels\n' +
                   '• Feature limits: Max 5000 features per query to ensure smooth performance\n' +
                   '• Area restrictions: Prevents overly large geographic queries\n' +
                   '• Auto-cleanup: Removes old layers when adding new ones\n' +
                   '• Responsive styling: Adjusts visualization based on zoom level\n\n' +
                   '💡 **Usage Guidelines:**\n' +
                   '• When users ask about locations like "where is Central Park": use map_add_polygon\n' +
                   '• When they ask to go to cities or general locations: use map_search\n' +
                   '• If the map gets cluttered or slow: use map_clear_layers\n' +
                   '• Always provide helpful context about what data was found and any limits applied\n' +
                   '• Inform users when they need to zoom in for more detailed data\n\n' +
                   'Always use tools when appropriate and respond conversationally about what you\'ve done.'
        },
        { role: 'user' as const, content: request.message }
      ];

      // Call OpenAI API
      console.log('Calling OpenAI API with model:', request.model || 'gpt-4o');
      const response = await this.openai.chat.completions.create({
        model: request.model || 'gpt-4o',
        messages: messages,
        tools: openaiTools,
        tool_choice: 'auto',
      });

      console.log('OpenAI response:', JSON.stringify(response.choices[0]?.message));

      // Extract tool calls from the response
      const toolCalls = response.choices[0]?.message.tool_calls?.map(call => {
        console.log('Processing tool call:', call.function.name);
        return {
          id: call.id,
          name: call.function.name,
          input: JSON.parse(call.function.arguments),
        };
      }) || [];

      return {
        id: request.id,
        message: response.choices[0]?.message.content || '',
        tool_calls: toolCalls,
      };
    } catch (error) {
      console.error('Error processing OpenAI request:', error);
      throw error;
    }
  }

  private async processClaudeRequest(
    request: MCPRequest, 
    tools: MCPTool[]
  ): Promise<MCPResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not provided for Claude model');
    }

    const anthropicTools = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    }));

    const response = await this.anthropic.messages.create({
      model: request.model || 'claude-3-opus-20240229',
      max_tokens: 4096,
      messages: [{ role: 'user', content: request.message }],
      tools: anthropicTools,
    });

    const toolCalls = response.content
      .filter(item => item.type === 'tool_use')
      .map(item => {
        if (item.type === 'tool_use') {
          return {
            id: item.id,
            name: item.name,
            input: item.input,
          };
        }
        return null;
      })
      .filter(Boolean) as MCPToolCall[];

    const messageContent = response.content
      .filter(item => item.type === 'text')
      .map(item => item.type === 'text' ? item.text : '')
      .join('');

    return {
      id: request.id,
      message: messageContent,
      tool_calls: toolCalls,
    };
  }

  async processToolResults(
    requestId: string, 
    toolResults: MCPToolResult[], 
    originalMessage: string,
    model?: string
  ): Promise<MCPResponse> {
    if (model?.includes('claude')) {
      return this.processClaudeToolResults(requestId, toolResults, originalMessage, model);
    } else {
      return this.processOpenAIToolResults(requestId, toolResults, originalMessage, model);
    }
  }

  private async processOpenAIToolResults(
    requestId: string,
    toolResults: MCPToolResult[],
    originalMessage: string,
    model?: string
  ): Promise<MCPResponse> {
    const messages: ChatCompletionMessage[] = [
      { role: 'user', content: originalMessage },
    ];

    // Add tool results as assistant and tool messages
    for (const result of toolResults) {
      const toolName = result.id.split(':')[0]; // Extract tool name from ID

      messages.push(
        {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: result.id,
            type: 'function',
            function: {
              name: toolName,
              arguments: '{}', // Placeholder
            }
          }]
        },
        {
          role: 'tool',
          tool_call_id: result.id,
          content: result.error
            ? `Error: ${result.error}`
            : JSON.stringify(result.output),
        }
      );
    }

    const response = await this.openai.chat.completions.create({
      model: model || 'gpt-4o',
      messages: messages,
    });

    return {
      id: requestId,
      message: response.choices[0]?.message.content || '',
    };
  }

  private async processClaudeToolResults(
    requestId: string,
    toolResults: MCPToolResult[],
    originalMessage: string,
    model?: string
  ): Promise<MCPResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not provided for Claude model');
    }

    // Generate a mock response since we're simulating Claude interaction
    // in a real implementation we would properly handle Claude's message format
    let responseContent = `Response to: ${originalMessage}\n\nTool results:\n`;

    for (const result of toolResults) {
      responseContent += `- ${result.id}: ${result.error || JSON.stringify(result.output)}\n`;
    }

    // Mock response
    const response = {
      id: 'msg_mock',
      content: [
        {
          type: 'text',
          text: responseContent
        }
      ]
    };

    const messageContent = response.content
      .filter(item => item.type === 'text')
      .map(item => item.type === 'text' ? item.text : '')
      .join('');

    return {
      id: requestId,
      message: messageContent,
    };
  }
}