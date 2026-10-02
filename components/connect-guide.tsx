import type { PublicListing } from '@/lib/listing';
import { connectPlan } from '@/lib/connect';
/** "How to connect" for a listing, generated from stored facts only. Each
 *  question is unique to the listing because it embeds that listing's
 *  endpoint, package or documentation. */
export default function ConnectGuide({ item }: { item: PublicListing }) {
  const plan = connectPlan(item);
  const mainFile = item.fileUrl || item.skillFile || '';
  const fileLink = mainFile ? (
    <a href={mainFile} target="_blank" rel="noopener noreferrer">
      {mainFile.replace(/^https?:\/\//, '')}
    </a>
  ) : null;
  const agentsAnswer = item.platforms.length
    ? `The publisher lists ${item.platforms.join(', ')}.`
    : 'The publisher has not listed the agents it was written for.';
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
  } else if (item.kind === 'skill') {
    questions.push({
      q: `How do I install ${item.name}?`,
      a: (
        <p>
          {item.setup ? 'The publisher’s install steps are shown above. ' : ''}
          A skill is a folder with a SKILL.md file. Copy that folder into your
          agent’s skills directory and the agent loads it when a task matches
          the skill’s description: Claude Code reads{' '}
          <code>.claude/skills/</code> in the project and{' '}
          <code>~/.claude/skills/</code>; other agents that support the Agent
          Skills format document their own location.
          {fileLink ? <> The file itself is at {fileLink}.</> : null}
        </p>
      ),
    });
    questions.push({
      q: `Which agents can use ${item.name}?`,
      a: (
        <p>
          {agentsAnswer}
          {item.allowedTools ? (
            <>
              {' '}
              Tools its SKILL.md pre-approves: <code>{item.allowedTools}</code>.
            </>
          ) : null}
        </p>
      ),
    });
  } else if (item.kind === 'plugin') {
    questions.push({
      q: `How do I install ${item.name}?`,
      a: (
        <p>
          {item.setup ? 'The publisher’s install steps are shown above. ' : ''}
          Plugins are installed by the agent host. In Claude Code, add the
          publisher’s marketplace and run{' '}
          <code>/plugin install name@marketplace</code>; other hosts document
          their own plugin or extension command.
          {fileLink ? <> The manifest is at {fileLink}.</> : null}
        </p>
      ),
    });
    questions.push({
      q: `Which hosts can use ${item.name}?`,
      a: (
        <p>
          {agentsAnswer}
          {item.allowedTools ? (
            <>
              {' '}
              Tools it pre-approves: <code>{item.allowedTools}</code>.
            </>
          ) : null}
        </p>
      ),
    });
  } else if (item.kind === 'rules') {
    questions.push({
      q: `How do I use ${item.name}?`,
      a: (
        <p>
          {item.setup ? 'The publisher’s steps are shown above. ' : ''}
          Copy the file into the place your agent reads: <code>
            CLAUDE.md
          </code>{' '}
          or <code>AGENTS.md</code> at the repository root,{' '}
          <code>.cursorrules</code> or <code>.cursor/rules/</code> for Cursor,{' '}
          <code>.github/copilot-instructions.md</code> for GitHub Copilot. Then
          edit it for your project.
          {fileLink ? <> The file is at {fileLink}.</> : null}
        </p>
      ),
    });
    questions.push({
      q: `Which agents read ${item.name}?`,
      a: <p>{agentsAnswer}</p>,
    });
  } else if (item.kind === 'eval') {
    questions.push({
      q: `How do I run ${item.name}?`,
      a: (
        <p>
          {item.setup ? 'The publisher’s steps are shown above. ' : ''}
          Follow the publisher’s{' '}
          <a href={docs} target="_blank" rel="noopener noreferrer">
            documentation
          </a>{' '}
          to get the data and run the harness against your agent or model.
          {fileLink ? <> The data or results are at {fileLink}.</> : null}
        </p>
      ),
    });
    questions.push({
      q: `What does ${item.name} measure?`,
      a: (
        <p>
          {item.capabilities.length
            ? item.capabilities.join('; ') + '.'
            : item.summary}
        </p>
      ),
    });
  } else {
    if (plan.agent)
      questions.push({
        q: `How do other agents or clients connect to ${item.name}?`,
        a: (
          <div className="snippet-list">
            <p>
              {plan.agent.protocol === 'a2a'
                ? 'It publishes an A2A agent card. Fetch the card to discover its skills and task endpoint, then send tasks with any A2A client:'
                : plan.agent.protocol === 'acp'
                  ? 'It speaks ACP. Connect to the endpoint below with an ACP client:'
                  : plan.agent.protocol === 'openai'
                    ? 'It is reachable through the OpenAI Agents or Responses API at the endpoint below:'
                    : 'It exposes an agent endpoint; the publisher documents the protocol:'}
            </p>
            <div className="snippet">
              <span className="label">
                {plan.agent.protocol === 'a2a' ? 'Agent card' : 'Endpoint'} ·{' '}
                {plan.agent.label}
              </span>
              <pre>
                <code>
                  {plan.agent.protocol === 'a2a'
                    ? 'curl ' + plan.agent.url
                    : plan.agent.url}
                </code>
              </pre>
            </div>
            {known(plan.authAnswer) && <p>{plan.authAnswer}</p>}
          </div>
        ),
      });
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
