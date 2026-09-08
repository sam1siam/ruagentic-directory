import { mcp } from '@/lib/server/mcp';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = (request: Request) => mcp.fetch(request);
export const GET = (request: Request) => mcp.fetch(request);
export const DELETE = (request: Request) => mcp.fetch(request);
