import { problemResponse } from '@/lib/agent-responses';

/** Any /api path without its own route answers with a JSON problem instead
 *  of the HTML 404 page; existing routes always take precedence. */
const missing = () =>
  problemResponse(
    'endpoint_not_found',
    'There is no API endpoint at this path.',
  );
export const GET = missing;
export const POST = missing;
export const PUT = missing;
export const PATCH = missing;
export const DELETE = missing;
export const OPTIONS = missing;
