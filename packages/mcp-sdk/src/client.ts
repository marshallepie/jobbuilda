import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { AuthContext } from '@jobbuilda/contracts';
import {
  MCPServerConnection,
  MCPToolCallParams,
  MCPToolResult,
  MCPResource,
  MCPCallMeta
} from './types';

/**
 * Typed MCP Client wrapper with automatic AuthContext propagation
 */
export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private connected = false;

  constructor(
    private serverName: string,
    private connection: MCPServerConnection
  ) {
    this.client = new Client({
      name: `jobbuilda-coordinator`,
      version: '2.0.0'
    }, {
      capabilities: {}
    });
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    this.transport = new StdioClientTransport({
      command: this.connection.command,
      args: this.connection.args,
      env: {
        ...(process.env as Record<string, string>),
        ...this.connection.env
      }
    });

    await this.client.connect(this.transport);
    this.connected = true;
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    await this.client.close();
    this.connected = false;
  }

  /**
   * Read a resource from the MCP server
   * @param uri - Resource URI (e.g., "res://identity/users/123")
   * @param context - Auth context to propagate
   */
  async readResource<T = unknown>(
    uri: string,
    context: AuthContext
  ): Promise<MCPResource<T>> {
    if (!this.connected) {
      throw new Error(`MCP client for ${this.serverName} not connected`);
    }

    const result = await this.client.readResource({
      uri,
      _meta: { context } as MCPCallMeta
    } as any);

    const content = result.contents[0];
    const textContent = content && 'text' in content ? content.text : '{}';

    return {
      uri: content?.uri || uri,
      mimeType: content?.mimeType,
      data: JSON.parse(textContent) as T
    };
  }

  /**
   * Call a tool on the MCP server
   * @param name - Tool name
   * @param args - Tool arguments
   * @param context - Auth context to propagate
   */
  async callTool<T = unknown>(
    name: string,
    args: Record<string, unknown>,
    context: AuthContext
  ): Promise<MCPToolResult<T>> {
    if (!this.connected) {
      throw new Error(`MCP client for ${this.serverName} not connected`);
    }

    const result = await this.client.callTool({
      name,
      arguments: {
        ...args,
        _meta: { context }
      }
    } as MCPToolCallParams);

    return result as MCPToolResult<T>;
  }

  /**
   * List available resources
   */
  async listResources(): Promise<Array<{ uri: string; name?: string; description?: string }>> {
    if (!this.connected) {
      throw new Error(`MCP client for ${this.serverName} not connected`);
    }

    const result = await this.client.listResources();
    return result.resources;
  }

  /**
   * List available tools
   */
  async listTools(): Promise<Array<{ name: string; description?: string; inputSchema: unknown }>> {
    if (!this.connected) {
      throw new Error(`MCP client for ${this.serverName} not connected`);
    }

    const result = await this.client.listTools();
    return result.tools;
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}
