import { z } from 'zod';
import { categoryNames } from './categories';
export const filterInput = z
  .object({
    query: z.string().max(200).default(''),
    kind: z.enum(['all', 'server', 'client', 'product']).default('all'),
    category: z
      .enum(['All categories', ...categoryNames])
      .default('All categories'),
  })
  .strict();
type Context = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function registerDirectoryFilter(
  context: Context | undefined,
  apply: (input: z.infer<typeof filterInput>) => unknown,
) {
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  try {
    void Promise.resolve(
      context.registerTool(
        {
          name: 'filter_directory',
          title: 'Filter the directory',
          description:
            'Update the visible RUAGENTIC directory search, project type, and category. Returns matching public listing names and links. Does not submit, pay for, or publish a listing.',
          inputSchema: z.toJSONSchema(filterInput),
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          execute(input) {
            return apply(filterInput.parse(input));
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
  } catch {}
  return () => lifecycle.abort();
}
export function browserModelContext() {
  return typeof document === 'undefined'
    ? undefined
    : (document as Document & { modelContext?: Context }).modelContext;
}
