import type { PublicListing } from '@/lib/listing';
import { connectPlan } from '@/lib/connect';
/** "How to connect" for a listing, generated from stored facts only. Each
 *  question is unique to the listing because it embeds that listing's
 *  endpoint, package or documentation. */
export default function ConnectGuide({ item }: { item: PublicListing }) {
  const plan = connectPlan(item);
  const docs = item.documentation || item.homepage;
  const questions: { q: string; a: React.ReactNode }[] = [];
  const known = (answer: string) =>
    !/^Not specified|^Not applicable/.test(answer);
  if (item.kind === 'server') {
    if (plan.remote || plan.pkg)
      questions.push({
        q: 'What is the endpoint and how does it run?',
        a: <p>{plan.transportAnswer}</p>,
      });
    else
      questions.push({
        q: `How do I run ${item.name}?`,
        a: (
          <p>
            {item.repository ? (
              <>
                Install and run it from its source repository,{' '}
                <a
                  href={item.repository}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.repository.replace(/^https?:\/\//, '')}
                </a>
                . The README there covers the install command and any
                credentials it needs.
              </>
            ) : (
              <>
                The publisher’s{' '}
                <a href={docs} target="_blank" rel="noopener noreferrer">
                  documentation
                </a>{' '}
                covers how it is run.
              </>
            )}
          </p>
        ),
      });
    if (
      known(plan.authAnswer) ||
      plan.requiredHeaders.length ||
      plan.requiredEnv.length
    )
      questions.push({
        q: 'Does it need authentication?',
        a: (
          <>
            <p>{plan.authAnswer}</p>
            {plan.requiredHeaders.length > 0 && (
              <p>
                Required request headers:{' '}
                {plan.requiredHeaders.map((h, i) => (
                  <span key={h}>
                    {i > 0 && ', '}
                    <code>{h}</code>
                  </span>
                ))}
                .
              </p>
            )}
            {plan.requiredEnv.length > 0 && (
              <p>
                Required environment variables:{' '}
                {plan.requiredEnv.map((e, i) => (
                  <span key={e}>
                    {i > 0 && ', '}
                    <code>{e}</code>
                  </span>
                ))}
                .
              </p>
            )}
          </>
        ),
      });
    if (plan.snippets.length) {
      questions.push({
        q: `How do I add ${item.name} to Claude Code, Cursor or Claude Desktop?`,
        a: (
          <div className="snippet-list">
            {plan.snippets.map((s) => (
              <div className="snippet" key={s.label}>
                <span className="label">{s.label}</span>
                <pre>
                  <code>{s.code}</code>
                </pre>
              </div>
            ))}
            <p className="muted">
              Snippets are generated from the published{' '}
              {plan.remote ? 'endpoint' : 'package name'}; the server name{' '}
              <code>{plan.key}</code> is only a label you can change.
              {plan.authAnswer.startsWith('No credentials')
                ? ''
                : ' Add the credentials the publisher documents.'}
            </p>
          </div>
        ),
      });
    }
  } else if (item.kind === 'client') {
    questions.push({
      q: `How do I connect MCP servers to ${item.name}?`,
      a: (
        <p>
          {item.name} connects to MCP servers through its own settings. The
          publisher’s{' '}
          <a href={docs} target="_blank" rel="noopener noreferrer">
            documentation
          </a>{' '}
          describes where to add a server URL or command.
          {item.transport &&
          item.transport !== 'unknown' &&
          item.transport !== 'not-applicable'
            ? ` Published transport support: ${item.transport}.`
            : ''}
        </p>
      ),
    });
  } else {
    questions.push({
      q: `Where do I start with ${item.name}?`,
      a: (
        <p>
          Start from the{' '}
          <a href={item.homepage} target="_blank" rel="noopener noreferrer">
            project website
          </a>
          {item.documentation ? (
            <>
              {' '}
              and its{' '}
              <a
                href={item.documentation}
                target="_blank"
                rel="noopener noreferrer"
              >
                documentation
              </a>
            </>
          ) : null}
          .
          {item.endpoint
            ? ` It also publishes an MCP endpoint at ${item.endpoint}.`
            : ''}
        </p>
      ),
    });
  }
  if (known(plan.pricingAnswer))
    questions.push({ q: 'Is it free?', a: <p>{plan.pricingAnswer}</p> });
  return (
    <div className="connect-guide">
      {item.setup && (
        <div className="connect-qa">
          <h3>From the publisher</h3>
          <pre className="setup-code">{item.setup}</pre>
        </div>
      )}
      {questions.map(({ q, a }) => (
        <div className="connect-qa" key={q}>
          <h3>{q}</h3>
          {a}
        </div>
      ))}
    </div>
  );
}
