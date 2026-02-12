import { AuthContext } from '@jobbuilda/contracts';

/**
 * MCP Resource representation
 */
export interface MCPResource<T = unknown> {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
  data: T;
}

/**
 * MCP Tool call parameters
 */
export interface MCPToolCallParams {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * MCP Tool call result
 */
export interface MCPToolResult<T = unknown> {
  content: Array<{
    type: string;
    text?: string;
    data?: T;
  }>;
  isError?: boolean;
}

/**
 * MCP Server connection configuration
 */
export interface MCPServerConnection {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * MCP call metadata with auth context
 */
export interface MCPCallMeta {
  context: AuthContext;
}
