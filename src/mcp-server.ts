#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { BubbleService } from "./bubbleService.js";
import dotenv from "dotenv";
// Load environment variables
dotenv.config();

// Read-only mode helpers
function isReadOnlyMode(): boolean {
    const mode = process.env.MCP_MODE?.toLowerCase();
    // Default to read-only for safety
    return mode !== 'read-write';
}

function logAction(tool: string, params: Record<string, any>, blocked: boolean = false): void {
    const sanitizedParams = Object.entries(params)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' ');

    if (blocked) {
        console.error(`[AUDIT] tool=${tool} BLOCKED (read-only mode) ${sanitizedParams}`);
    } else {
        console.error(`[AUDIT] tool=${tool} ${sanitizedParams}`);
    }
}

const WRITE_TOOLS = ['bubble_create', 'bubble_update', 'bubble_delete', 'bubble_workflow'];

// Initialize Bubble service
const bubbleService = new BubbleService();
// Create MCP server
const server = new Server({
    name: "bubble-mcp-server",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "bubble_get_schema",
                description: "Get the schema of the Bubble application including data types and workflows",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "bubble_list",
                description: "List records of a specific data type",
                inputSchema: {
                    type: "object",
                    properties: {
                        dataType: {
                            type: "string",
                            description: "The data type to list (e.g., 'user', 'order', 'custom.organization')",
                        },
                        limit: {
                            type: "number",
                            description: "Maximum number of records to return",
                            default: 100,
                        },
                        cursor: {
                            type: "number",
                            description: "Cursor for pagination",
                        },
                    },
                    required: ["dataType"],
                },
            },
            {
                name: "bubble_get",
                description: "Get a specific record by ID",
                inputSchema: {
                    type: "object",
                    properties: {
                        dataType: {
                            type: "string",
                            description: "The data type of the record",
                        },
                        id: {
                            type: "string",
                            description: "The unique ID of the record",
                        },
                    },
                    required: ["dataType", "id"],
                },
            },
            {
                name: "bubble_create",
                description: "Create a new record",
                inputSchema: {
                    type: "object",
                    properties: {
                        dataType: {
                            type: "string",
                            description: "The data type to create",
                        },
                        data: {
                            type: "object",
                            description: "The data for the new record",
                        },
                    },
                    required: ["dataType", "data"],
                },
            },
            {
                name: "bubble_update",
                description: "Update an existing record",
                inputSchema: {
                    type: "object",
                    properties: {
                        dataType: {
                            type: "string",
                            description: "The data type of the record",
                        },
                        id: {
                            type: "string",
                            description: "The unique ID of the record to update",
                        },
                        data: {
                            type: "object",
                            description: "The updated data",
                        },
                    },
                    required: ["dataType", "id", "data"],
                },
            },
            {
                name: "bubble_delete",
                description: "Delete a record",
                inputSchema: {
                    type: "object",
                    properties: {
                        dataType: {
                            type: "string",
                            description: "The data type of the record",
                        },
                        id: {
                            type: "string",
                            description: "The unique ID of the record to delete",
                        },
                    },
                    required: ["dataType", "id"],
                },
            },
            {
                name: "bubble_workflow",
                description: "Execute a workflow",
                inputSchema: {
                    type: "object",
                    properties: {
                        workflowName: {
                            type: "string",
                            description: "The name of the workflow to execute",
                        },
                        data: {
                            type: "object",
                            description: "The data to pass to the workflow",
                            default: {},
                        },
                    },
                    required: ["workflowName"],
                },
            },
        ],
    };
});
// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        // Check if this is a write tool and we're in read-only mode
        if (WRITE_TOOLS.includes(name) && isReadOnlyMode()) {
            logAction(name, args || {}, true);
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${name} is disabled in read-only mode. Set MCP_MODE=read-write to enable write operations.`,
                    },
                ],
                isError: true,
            };
        }

        switch (name) {
            case "bubble_get_schema": {
                logAction(name, {});
                const schema = await bubbleService.getSchema();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(schema, null, 2),
                        },
                    ],
                };
            }
            case "bubble_list": {
                if (!args)
                    throw new Error('Arguments are undefined');
                logAction(name, { dataType: args.dataType, limit: args.limit, cursor: args.cursor });
                const result = await bubbleService.list(args.dataType as string, {
                    limit: args.limit as number | undefined,
                    cursor: args.cursor as number | undefined,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            case "bubble_get": {
                if (!args)
                    throw new Error('Arguments are undefined');
                logAction(name, { dataType: args.dataType, id: args.id });
                const result = await bubbleService.get(args.dataType as string, args.id as string);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            case "bubble_create": {
                if (!args)
                    throw new Error('Arguments are undefined');
                logAction(name, { dataType: args.dataType });
                const result = await bubbleService.create(args.dataType as string, args.data as Record<string, any>);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            case "bubble_update": {
                if (!args)
                    throw new Error('Arguments are undefined');
                logAction(name, { dataType: args.dataType, id: args.id });
                const result = await bubbleService.update(args.dataType as string, args.id as string, args.data as Record<string, any>);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            case "bubble_delete": {
                if (!args)
                    throw new Error('Arguments are undefined');
                logAction(name, { dataType: args.dataType, id: args.id });
                const result = await bubbleService.delete(args.dataType as string, args.id as string);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            case "bubble_workflow": {
                if (!args)
                    throw new Error('Arguments are undefined');
                logAction(name, { workflowName: args.workflowName });
                const result = await bubbleService.executeWorkflow(args.workflowName as string, (args.data || {}) as Record<string, any>);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        if (error instanceof Error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${error.message}`,
                    },
                ],
                isError: true,
            };
        }
        return {
            content: [
                {
                    type: "text",
                    text: "Unknown error occurred",
                },
            ],
            isError: true,
        };
    }
});
// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    const mode = isReadOnlyMode() ? 'read-only' : 'read-write';
    console.error(`Bubble MCP server running on stdio (mode: ${mode})`);
}
main();
//# sourceMappingURL=mcp-server.js.map