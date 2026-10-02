/** Questions and answers for a listing page, built from stored facts only.
 *  The same text feeds the visible section and the FAQPage structured data,
 *  so what answer engines read is what people see. Pure and unit-tested. */
import { connectPlan } from './connect.ts';
import { kindByValue } from './categories.ts';
import type { PublicListing } from './listing.ts';

export type Faq = { q: string; a: string };
const known = (answer: string) =>
  Boolean(answer) && !/^Not specified|^Not applicable/.test(answer);
// "an MCP server", "an AI agent": the sound decides, not the letter.
const article = (word: string) =>
  /^(?:[aeiou]|MCP\b|AI\b)/i.test(word) ? 'an' : 'a';
const day = (value: string) =>
  new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
const brief = (text: string, max = 320) =>
  text.length > max ? text.slice(0, max).replace(/\s+\S*$/, '') + '…' : text;

export function listingFaq(item: PublicListing): Faq[] {
  const plan = connectPlan(item);
  // "a skill", "an MCP server": lower-case unless it starts with an acronym.
  const singular = (kindByValue(item.kind)?.singular ?? 'listing').replace(
    /^(?!MCP|AI)[A-Z]/,
    (c) => c.toLowerCase(),
  );
  const docs = item.documentation || item.homepage;
  const faq: Faq[] = [];
  faq.push({
    q: `What is ${item.name}?`,
    a: `${item.name} is ${article(singular)} ${singular} in the ${item.category} category${
      item.agenticCheckedAt
        ? ', with Agentic Protocol files checked by the directory'
        : ''
    }. ${item.summary}`,
  });
  const steps = item.setup
    ? ` The publisher's steps: ${brief(item.setup)}`
    : '';
  switch (item.kind) {
    case 'server':
      faq.push({
        q: `How do I connect to ${item.name}?`,
        a:
          (plan.remote || plan.pkg
            ? plan.transportAnswer
            : item.repository
              ? `Install and run it from its source repository, ${item.repository}. The README there covers the install command and any credentials it needs.`
              : `The publisher's documentation at ${docs} covers how it is run.`) +
          (plan.snippets.length
            ? ` The listing page has ready-made snippets for Claude Code, Cursor and Claude Desktop.`
            : '') +
          steps,
      });
      if (known(plan.authAnswer))
        faq.push({
          q: `Does ${item.name} need authentication?`,
          a:
            plan.authAnswer +
            (plan.requiredHeaders.length
              ? ` Required request headers: ${plan.requiredHeaders.join(', ')}.`
              : '') +
            (plan.requiredEnv.length
              ? ` Required environment variables: ${plan.requiredEnv.join(', ')}.`
              : ''),
        });
      break;
    case 'client':
      faq.push({
        q: `How do I connect MCP servers to ${item.name}?`,
        a: `${item.name} connects to MCP servers through its own settings. The publisher's documentation at ${docs} describes where to add a server URL or command.${
          item.transport &&
          item.transport !== 'unknown' &&
          item.transport !== 'not-applicable'
            ? ` Published transport support: ${item.transport}.`
            : ''
        }${steps}`,
      });
      break;
    case 'skill':
      faq.push({
        q: `How do I install ${item.name}?`,
        a: `A skill is a folder with a SKILL.md file. Copy that folder into your agent's skills directory (for Claude Code, .claude/skills/ in the project or ~/.claude/skills/) and the agent loads it when a task matches the skill's description.${
          item.fileUrl || item.skillFile
            ? ` The file is at ${item.fileUrl || item.skillFile}.`
            : ''
        }${steps}`,
      });
      break;
    case 'plugin':
      faq.push({
        q: `How do I install ${item.name}?`,
        a: `Plugins are installed by the agent host. In Claude Code, add the publisher's marketplace and run /plugin install name@marketplace; other hosts document their own plugin or extension command.${
          item.fileUrl ? ` The manifest is at ${item.fileUrl}.` : ''
        }${steps}`,
      });
      break;
    case 'rules':
      faq.push({
        q: `How do I use ${item.name}?`,
        a: `Copy the file into the place your agent reads: CLAUDE.md or AGENTS.md at the repository root, .cursorrules or .cursor/rules/ for Cursor, .github/copilot-instructions.md for GitHub Copilot. Then edit it for your project.${
          item.fileUrl ? ` The file is at ${item.fileUrl}.` : ''
        }${steps}`,
      });
      break;
    case 'eval':
      faq.push({
        q: `How do I run ${item.name}?`,
        a: `Follow the publisher's documentation at ${docs} to get the data and run the harness against your agent or model.${
          item.fileUrl ? ` The data or results are at ${item.fileUrl}.` : ''
        }${steps}`,
      });
      break;
    default:
      faq.push({
        q: `Where do I start with ${item.name}?`,
        a: `Start from the project website, ${item.homepage}${
          item.documentation
            ? `, and its documentation at ${item.documentation}`
            : ''
        }.${
          plan.agent
            ? ` Other agents and clients reach it through its ${plan.agent.label.toLowerCase()} at ${plan.agent.url}.`
            : ''
        }${item.endpoint ? ` It also publishes an MCP endpoint at ${item.endpoint}.` : ''}${steps}`,
      });
  }
  if (known(plan.pricingAnswer))
    faq.push({ q: `Is ${item.name} free?`, a: plan.pricingAnswer });
  if (item.capabilities.length)
    faq.push({
      q: `What can ${item.name} do?`,
      a: `According to the published details: ${item.capabilities.join('; ')}.`,
    });
  if (item.platforms.length)
    faq.push({
      q: `Which agents or platforms work with ${item.name}?`,
      a: `The publisher lists ${item.platforms.join(', ')}.`,
    });
  faq.push({
    q: `Where is ${item.name} published?`,
    a: `Its homepage is ${item.homepage}${
      item.repository ? ` and its source repository is ${item.repository}` : ''
    }. RUAGENTIC read these details from ${item.source} on ${day(item.observedAt)} and did not install or run the project.`,
  });
  return faq;
}
export function faqJsonLd(faq: Faq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
