'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react';
import ToolCard from '@/components/tool-card';
import {
  CornerBrackets,
  checkerLabels,
  emitSubmitState,
  useMediaQuery,
} from '@/components/design-interactions';
import HudSelect from '@/components/hud-select';
import {
  categories,
  emptyListing,
  listingSchema,
  type ListingInput,
} from '@/lib/listing';
import { api } from '@/lib/client-api';
import {
  mergeSuggestions,
  fieldNames,
  type ImportField,
  type ImportResult,
} from '@/lib/project-import';
type Check = {
  id: string;
  label: string;
  status: string;
  detail: string;
  remedy?: string;
  helpUrl?: string;
};
type Audit = {
  id: string;
  eligible: boolean;
  checked_at: string;
  revision: number;
  report: {
    publication?: { status: string; summary?: string };
    checks?: Check[];
    readme?: { checks?: Check[] };
    errors?: string[];
  };
};
type Saved = {
  id: string;
  revision: number;
  state: string;
  slug: string | null;
  payload: ListingInput;
};
const phases = [
  ['Project', 'Name, type, description'],
  ['Connection', 'Links, manifest, transport'],
  ['Pre-flight', 'Publication checker'],
  ['Publish', 'Review and go live'],
] as const;
const phaseKeys = ['PROJECT', 'CONNECTION', 'PRE-FLIGHT', 'PUBLISH'];
const projectKeys: (keyof ListingInput)[] = [
  'kind',
  'name',
  'summary',
  'description',
  'category',
  'tags',
];
const transports = [
  ['stdio', 'stdio'],
  ['sse', 'sse'],
  ['streamable-http', 'streamable-http'],
  ['multiple', 'multiple'],
  ['not-applicable', 'not applicable'],
  ['unknown', 'not specified'],
] as const;
const expectedDetails = [
  '/agentic.json',
  'agentic 1.0',
  'homepage origin',
  '/agentic.txt',
  'README.md',
];
const CHECKING = 'Checking JSON, TXT and README';
const kindLabel = (kind: string) =>
  kind === 'server'
    ? 'MCP server'
    : kind === 'client'
      ? 'MCP client'
      : 'Agentic product';
const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
const utc = () => new Date().toISOString().slice(11, 19);
/** ⌘/Ctrl+Enter advances the flow, matching the footer hint. */
function ContinueShortcut({ action }: { action: () => void }) {
  const latest = useRef(action);
  useEffect(() => {
    latest.current = action;
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        latest.current();
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);
  return null;
}
export default function SubmissionForm({
  id,
  email,
  initialPlan = 'agentic',
}: {
  id?: string;
  email: string;
  initialPlan?: 'agentic' | 'payment';
}) {
  const [step, setStep] = useState(1),
    [listing, setListing] = useState<ListingInput>({ ...emptyListing }),
    [saved, setSaved] = useState<Saved | null>(null),
    [savedAt, setSavedAt] = useState(''),
    [sourceType, setSourceType] = useState<
      'homepage' | 'repository' | 'endpoint'
    >('homepage'),
    [url, setUrl] = useState(''),
    [path, setPath] = useState<'agentic' | 'payment'>(initialPlan),
    [audit, setAudit] = useState<Audit | null>(null),
    [paid, setPaid] = useState<string | null>(null),
    [checkoutOpen, setCheckoutOpen] = useState(false),
    [busy, setBusy] = useState(id ? 'Loading your listing' : ''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [fields, setFields] = useState<Record<string, string[]>>({}),
    [consent, setConsent] = useState(false),
    [published, setPublished] = useState<string | null>(null),
    [tagDraft, setTagDraft] = useState(''),
    [reveal, setReveal] = useState(0),
    [scan, setScan] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const touched = useRef<ImportField[]>([]);
  const [imported, setImported] = useState<ImportResult | null>(null);
  const [preserved, setPreserved] = useState<ImportField[]>([]);
  const busyRef = useRef(false);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const dirty = Boolean(
    saved && JSON.stringify(saved.payload) !== JSON.stringify(listing),
  );
  useEffect(() => {
    if (previousStep.current !== step) {
      stepHeading.current?.focus();
      window.scrollTo({ top: 0 });
    }
    previousStep.current = step;
  }, [step]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    emitSubmitState({
      step: phaseKeys[step - 1],
      saved: saved ? (dirty ? 'dirty' : 'saved') : 'new',
      at: savedAt,
    });
  }, [step, saved, dirty, savedAt]);
  useEffect(() => {
    if (!id) return;
    let active = true;
    void api('/api/submissions/' + id, undefined, 'GET')
      .then((data) => {
        if (!active) return;
        setListing(data.submission.payload);
        touched.current = Object.keys(data.submission.payload) as ImportField[];
        setSaved(data.submission);
        setSavedAt(utc());
        setAudit(data.audit);
        setPaid(
          data.payments.find((p: { state: string }) => p.state === 'paid')
            ?.id ?? null,
        );
        setCheckoutOpen(
          data.payments.some(
            (p: { state: string }) =>
              p.state === 'open' || p.state === 'creating',
          ),
        );
        if (
          data.submission.state === 'published' &&
          data.submission.slug &&
          data.currentRevisionPublished
        ) {
          setPublished(data.submission.slug);
        }
        if (data.submission.state === 'suspended')
          setError('This listing is suspended. Contact support to restore it.');
        else if (data.submission.state === 'withdrawn')
          setNotice(
            'This listing is unpublished. Review it and publish again to make it visible.',
          );
        if (data.payments.some((p: { state: string }) => p.state === 'paid'))
          setPath('payment');
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy('');
      });
    return () => {
      active = false;
    };
  }, [id]);
  function update<K extends keyof ListingInput>(
    key: K,
    value: ListingInput[K],
  ) {
    if (!touched.current.includes(key)) touched.current.push(key);
    setListing((p) => ({ ...p, [key]: value }));
    setAudit(null);
    setConsent(false);
    setFields((p) => ({ ...p, [key]: [] }));
  }
  async function run(task: () => Promise<void>, label: string) {
    if (busyRef.current || busy) return;
    busyRef.current = true;
    setError('');
    setNotice('');
    setBusy(label);
    try {
      await task();
    } catch (e) {
      const err = e as Error & { fields?: Record<string, string[]> };
      setError(err.message);
      if (err.fields) setFields(err.fields);
    } finally {
      setBusy('');
      busyRef.current = false;
    }
  }
  const normalized = () => ({
    ...listing,
    tags: listing.tags.map((v) => v.trim()).filter(Boolean),
    platforms: listing.platforms.map((v) => v.trim()).filter(Boolean),
    capabilities: listing.capabilities.map((v) => v.trim()).filter(Boolean),
  });
  async function save() {
    const parsed = listingSchema.safeParse(normalized());
    if (!parsed.success) {
      setFields(z.flattenError(parsed.error).fieldErrors);
      throw new Error('Check the highlighted fields before continuing.');
    }
    if (saved && !dirty) return saved;
    const data = await api('/api/submissions', {
      id: saved?.id ?? null,
      revision: saved?.revision ?? null,
      listing: parsed.data,
    });
    setSaved(data.submission);
    setSavedAt(utc());
    setListing(data.submission.payload);
    setAudit(null);
    window.history.replaceState(
      null,
      '',
      '/submit?id=' +
        data.submission.id +
        (path === 'payment' ? '&plan=paid' : ''),
    );
    return data.submission as Saved;
  }
  async function checkFiles() {
    const current = await save();
    const data = await api('/api/submissions/audit', {
      id: current.id,
      revision: current.revision,
    });
    setAudit(data.audit);
    if (data.audit.eligible)
      setNotice(
        'Your Agentic Protocol files qualify this listing for free publication.',
      );
  }
  function projectStepValid() {
    const parsed = listingSchema.safeParse(normalized());
    if (parsed.success) return true;
    const errors = z.flattenError(parsed.error).fieldErrors as Record<
      string,
      string[] | undefined
    >;
    const own = Object.fromEntries(
      projectKeys
        .filter((key) => errors[key]?.length)
        .map((key) => [key, errors[key]!]),
    );
    if (!Object.keys(own).length) return true;
    setFields(own);
    setError('Complete the highlighted fields before continuing.');
    return false;
  }
  const eligible = Boolean(
    audit?.eligible &&
    !dirty &&
    audit.revision === saved?.revision &&
    now - Date.parse(audit.checked_at) < 15 * 60000,
  );
  const checks: Check[] = [
    ...(audit?.report.checks ?? []),
    ...(audit?.report.readme?.checks ?? []),
  ].filter(
    (check, index, all) => all.findIndex((c) => c.id === check.id) === index,
  );
  const running = busy === CHECKING;
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', true);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setScan((s) => (s + 1) % 5), 450);
    return () => clearInterval(timer);
  }, [running]);
  // A new audit restarts the sequential reveal of its rows.
  const [revealedAudit, setRevealedAudit] = useState<Audit | null>(audit);
  if (revealedAudit !== audit) {
    setRevealedAudit(audit);
    setReveal(0);
  }
  const total = checks.length;
  useEffect(() => {
    if (!audit || reducedMotion) return;
    const timer = setInterval(
      () =>
        setReveal((r) => {
          if (r + 1 >= total) clearInterval(timer);
          return Math.min(total, r + 1);
        }),
      260,
    );
    return () => clearInterval(timer);
  }, [audit, total, reducedMotion]);
  const shown = reducedMotion ? total : reveal;
  const detected = (key: ImportField) =>
    Boolean(imported?.evidence.some((e) => e.field === key) && listing[key]);
  const errorsFor = (key: string) =>
    fields[key]?.length ? (
      <small className="field-error" role="alert">
        {fields[key].join(' ')}
      </small>
    ) : null;
  function textField(
    key: keyof ListingInput,
    label: string,
    options: {
      hint?: string;
      placeholder?: string;
      code?: boolean;
      full?: boolean;
      extra?: string;
    } = {},
  ) {
    const inputId = 'field-' + key;
    return (
      <div className={'field' + (options.full ? ' full' : '')} key={key}>
        <label htmlFor={inputId} className="input-label">
          {label}
          {options.extra && <b> · {options.extra}</b>}
        </label>
        <div
          className={
            'input-shell' +
            (options.code ? ' code' : '') +
            (fields[key]?.length ? ' invalid' : '')
          }
        >
          <i aria-hidden="true">&gt;</i>
          <input
            id={inputId}
            value={String(listing[key])}
            onChange={(e) => update(key, e.target.value as never)}
            aria-invalid={Boolean(fields[key]?.length)}
            placeholder={options.placeholder}
          />
          {detected(key) && <span className="detected">DETECTED</span>}
        </div>
        {options.hint && <small>{options.hint}</small>}
        {errorsFor(key)}
      </div>
    );
  }
  function selectField(
    key: keyof ListingInput,
    label: string,
    values: readonly (readonly [string, string])[],
    hint?: string,
  ) {
    const inputId = 'field-' + key;
    return (
      <div className="field">
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
        <HudSelect
          id={inputId}
          value={String(listing[key])}
          onValueChange={(value) => update(key, value as never)}
          options={values}
        />
        {hint && <small>{hint}</small>}
      </div>
    );
  }
  function addTag(raw: string) {
    const value = raw.trim().replace(/,+$/, '').trim();
    if (!value) return;
    if (listing.tags.length >= 8 || listing.tags.includes(value)) {
      setTagDraft('');
      return;
    }
    update('tags', [...listing.tags, value]);
    setTagDraft('');
  }
  const slug = saved?.slug || slugify(listing.name);
  const cleared = path === 'agentic' ? eligible : true;
  const status = published
    ? 'published'
    : step === 4 && cleared
      ? 'ready'
      : running
        ? 'checking'
        : eligible
          ? 'checked'
          : 'draft';
  const preflightRows = audit
    ? checks.map((c, i) => ({
        key: c.id,
        label: c.label,
        detail: c.detail,
        state: i < shown ? c.status : i === shown ? 'run' : 'wait',
      }))
    : checkerLabels.map((label, i) => ({
        key: label,
        label,
        detail: expectedDetails[i],
        state: running ? (i === scan ? 'run' : 'wait') : 'wait',
      }));
  const revealed = audit ? shown >= checks.length : false;
  const anyFail = checks.some((c) => c.status === 'fail');
  const barTone = !audit
    ? 'run'
    : revealed
      ? eligible
        ? 'pass'
        : anyFail
          ? 'fail'
          : 'run'
      : 'run';
  const barFilled = !audit
    ? running
      ? Math.round(((scan + 1) / 5) * 40)
      : 0
    : Math.round((Math.min(shown, checks.length) / (checks.length || 1)) * 40);
  const resultText = !audit
    ? running
      ? 'checking…'
      : 'not run'
    : !revealed
      ? `checking ${Math.min(shown + 1, checks.length)}/${checks.length}`
      : eligible
        ? 'PASS · ready to publish'
        : audit.report.publication?.status === 'partial'
          ? 'PARTIAL · fixes needed'
          : 'FAIL · fixes needed';
  const resultTone =
    !audit || !revealed ? 'run' : eligible ? 'pass' : anyFail ? 'fail' : 'run';
  const publishLabel =
    path === 'payment' && !paid
      ? 'Pay US$49.99 & publish →'
      : 'Publish listing →';
  const nextLabel =
    step === 3
      ? path === 'agentic' && !eligible
        ? running
          ? 'Checking…'
          : audit
            ? 'Run checker again →'
            : 'Run checker →'
        : 'Continue →'
      : step === 4
        ? publishLabel
        : 'Continue →';
  const nextDisabled =
    Boolean(busy) ||
    (step === 2 && checkoutOpen) ||
    (step === 3 && path === 'agentic' && !eligible && checkoutOpen) ||
    (step === 4 && (!consent || (path === 'agentic' && !eligible)));
  function next() {
    if (nextDisabled) return;
    if (step === 1) {
      setError('');
      if (projectStepValid()) setStep(2);
    } else if (step === 2) {
      void run(async () => {
        await save();
        setStep(3);
      }, 'Saving your listing');
    } else if (step === 3) {
      if (path === 'agentic' && !eligible) void run(checkFiles, CHECKING);
      else
        void run(async () => {
          await save();
          setStep(4);
        }, 'Saving your listing');
    } else {
      void run(
        async () => {
          if (!saved) throw new Error('Save your listing first.');
          if (path === 'payment' && !paid) {
            const result = await api('/api/checkout', {
              id: saved.id,
              revision: saved.revision,
              acceptedTerms: true,
            });
            if (result.url) {
              window.location.assign(result.url);
              return;
            }
            if (result.paid) {
              const publication = await api('/api/submissions/publish', {
                id: saved.id,
                revision: saved.revision,
                method: 'payment',
                evidenceId: result.evidenceId,
                acceptedTerms: true,
              });
              setPublished(publication.slug);
            } else
              setNotice('Payment is being confirmed. Your listing is saved.');
          } else {
            const result = await api('/api/submissions/publish', {
              id: saved.id,
              revision: saved.revision,
              method: path,
              evidenceId: path === 'agentic' ? audit!.id : paid,
              acceptedTerms: true,
            });
            setPublished(result.slug);
          }
        },
        path === 'payment' && !paid
          ? 'Opening secure checkout'
          : 'Publishing your listing',
      );
    }
  }
  if (published)
    return (
      <main className="content-page narrow">
        <div className="confirmation-card glass">
          <CornerBrackets />
          <CheckCircle2 size={44} />
          <h1>{listing.name} is on RUAGENTIC.</h1>
          <p>
            Your listing has a permanent public URL. Check {email} for its
            publication confirmation; delivery may take a few minutes.
          </p>
          <div className="copy-url">
            https://ruagentic.com/tools/{published}
          </div>
          <div className="actions">
            <Link href={'/tools/' + published} className="button primary">
              View your listing →
            </Link>
            <Link href="/dashboard" className="button secondary">
              Your dashboard
            </Link>
            <button
              type="button"
              className="button"
              onClick={() => {
                setPublished(null);
                setStep(1);
              }}
            >
              Edit listing
            </button>
          </div>
        </div>
      </main>
    );
  const locked = Boolean(busy) || checkoutOpen;
  return (
    <main className="submission-page">
      <ContinueShortcut action={next} />
      <h1 className="sr-only">Submit your project</h1>
      <div className="submission-sequence">
        <p className="sequence-label">SEQUENCE</p>
        <ol className="stepper" aria-label="Submission progress">
          {phases.map(([label, sub], itemIndex) => {
            const index = itemIndex + 1;
            const state =
              index === step ? 'current' : index < step ? 'done' : 'todo';
            return (
              <li
                key={label}
                data-state={state}
                aria-current={index === step ? 'step' : undefined}
              >
                <button
                  type="button"
                  disabled={index > step || Boolean(busy) || checkoutOpen}
                  onClick={() => setStep(index)}
                  aria-label={`${label}: ${sub}`}
                >
                  <span aria-hidden="true">
                    {index < step ? '✓' : String(index).padStart(2, '0')}
                  </span>
                  <div>
                    <strong>{label}</strong>
                    <small>{sub}</small>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="sequence-progress">
          PROGRESS <b>{Math.round(((step - 1) / 3) * 100)}%</b>
          <progress
            className="progress-track"
            aria-label="Submission progress"
            max={100}
            value={Math.round(((step - 1) / 3) * 100)}
          />
        </div>
      </div>
      <section className="submission-form" aria-busy={Boolean(busy)}>
        <div className="step-panel" key={step}>
          <h2
            className={'step-kicker' + (step === 3 && !cleared ? ' amber' : '')}
            tabIndex={-1}
            ref={stepHeading}
          >
            STEP {String(step).padStart(2, '0')} / 04
            {step === 3 ? ' · PRE-FLIGHT' : ''}
            {step === 4
              ? cleared
                ? ' · CLEARED FOR PUBLISH'
                : ' · REVIEW'
              : ''}
          </h2>
          {error && (
            <div className="notice error" role="alert">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          {notice && <output className="notice success">{notice}</output>}
          {busy && !running && (
            <output className="busy-status">
              <LoaderCircle size={14} className="spin" />
              {busy.toUpperCase()}…
            </output>
          )}
          {checkoutOpen && step < 4 && (
            <div className="notice warning">
              A checkout is open for this version.{' '}
              <button
                type="button"
                onClick={() =>
                  run(async () => {
                    await api('/api/checkout', { id: saved!.id }, 'DELETE');
                    setCheckoutOpen(false);
                  }, 'Cancelling checkout')
                }
              >
                Cancel checkout to edit
              </button>
            </div>
          )}
          {step === 1 && (
            <>
              <h2 className="step-title">Tell us about the project.</h2>
              <p className="step-lead">
                This becomes the public listing. Agents read it too.
              </p>
              <fieldset disabled={locked}>
                <div className="import-bar">
                  <label htmlFor="import-url" className="input-label">
                    Start from a link <b>· optional</b>
                  </label>
                  <HudSelect
                    id="import-type"
                    label="Link type"
                    value={sourceType}
                    onValueChange={setSourceType}
                    options={[
                      ['repository', 'Repository'],
                      ['homepage', 'Homepage or docs'],
                      ['endpoint', 'Remote MCP endpoint'],
                    ]}
                  />
                  <div className="input-shell code">
                    <i aria-hidden="true">&gt;</i>
                    <input
                      type="url"
                      id="import-url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder={
                        sourceType === 'repository'
                          ? 'https://github.com/owner/project'
                          : sourceType === 'endpoint'
                            ? 'https://api.yoursite.com/mcp'
                            : 'https://yoursite.com'
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="button primary"
                    disabled={locked || !url.trim()}
                    onClick={() =>
                      run(async () => {
                        const result = await api('/api/import', {
                          url,
                          kind: listing.kind,
                          sourceType,
                        });
                        const merged = mergeSuggestions(
                          listing,
                          result.suggestions,
                          touched.current,
                        );
                        setListing(merged.listing);
                        setImported(result);
                        setPreserved(merged.preserved);
                        setAudit(null);
                        setConsent(false);
                        setFields({});
                        setNotice(
                          merged.applied.length +
                            ' fields filled for you. ' +
                            (merged.preserved.length
                              ? merged.preserved.length +
                                ' edited fields kept. '
                              : '') +
                            'Review the suggestions below.',
                        );
                      }, 'Reading your project, docs, and public files')
                    }
                  >
                    Fill for me →
                  </button>
                  <small>
                    Public HTTPS links only. We read public details and fill the
                    fields below; your edits are kept.
                  </small>
                </div>
                {imported && (
                  <details className="import-report">
                    <summary>
                      Imported details · {imported.evidence.length} sourced
                      suggestions
                    </summary>
                    <p>
                      {imported.notice} Importing does not verify ownership,
                      functionality, or eligibility for a free listing.
                    </p>
                    <ul className="import-evidence">
                      {imported.evidence.map((e) => (
                        <li key={e.field}>
                          <strong>{fieldNames[e.field] || e.field}</strong> —{' '}
                          <a
                            href={e.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {e.source} ↗
                          </a>
                        </li>
                      ))}
                      {imported.observations
                        .filter((o) => o.status === 'unavailable')
                        .map((o) => (
                          <li key={o.url}>
                            <a
                              href={o.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {new URL(o.url).pathname}
                            </a>
                            : {o.detail}
                          </li>
                        ))}
                    </ul>
                    {preserved.length > 0 && (
                      <div className="import-alternative">
                        <p>
                          Your edited fields were kept. You can apply an
                          individual suggestion:
                        </p>
                        {preserved.map((key) => (
                          <p key={key}>
                            <strong>{fieldNames[key] || key}:</strong>{' '}
                            {String(imported.suggestions[key]).slice(0, 220)}
                            <button
                              type="button"
                              disabled={locked}
                              onClick={() => {
                                update(key, imported.suggestions[key] as never);
                                setPreserved((p) => p.filter((x) => x !== key));
                              }}
                            >
                              Use suggestion
                            </button>
                          </p>
                        ))}
                      </div>
                    )}
                  </details>
                )}
                <div className="form-grid">
                  {textField('name', 'Project name', {
                    full: true,
                    placeholder: 'Brave Search MCP Server',
                  })}
                  <fieldset className="field">
                    <legend className="sr-only">Type</legend>
                    <span className="input-label" aria-hidden="true">
                      Type
                    </span>
                    <div className="segmented">
                      {(
                        [
                          ['server', 'MCP server'],
                          ['client', 'Client'],
                          ['product', 'Product'],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          aria-pressed={listing.kind === value}
                          onClick={() => update('kind', value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  {selectField(
                    'category',
                    'Category',
                    categories.map((c) => [c, c] as const),
                  )}
                  <div className="field full">
                    <label htmlFor="field-summary" className="input-label">
                      One-line description
                      <b> · {listing.summary.length}/240</b>
                    </label>
                    <div
                      className={
                        'input-shell' +
                        (fields.summary?.length ? ' invalid' : '')
                      }
                    >
                      <input
                        id="field-summary"
                        value={listing.summary}
                        maxLength={240}
                        onChange={(e) => update('summary', e.target.value)}
                        aria-invalid={Boolean(fields.summary?.length)}
                        placeholder="Search the web and retrieve image, video and related results…"
                      />
                      {detected('summary') && (
                        <span className="detected">DETECTED</span>
                      )}
                    </div>
                    <small>20–240 characters.</small>
                    {errorsFor('summary')}
                  </div>
                  <div className="field full">
                    <label htmlFor="field-tags" className="input-label">
                      Tags <b>· up to 8</b>
                    </label>
                    <div className="tag-shell">
                      {listing.tags.map((tag) => (
                        <span className="tag" key={tag}>
                          {tag}
                          <button
                            type="button"
                            aria-label={`Remove tag ${tag}`}
                            onClick={() =>
                              update(
                                'tags',
                                listing.tags.filter((t) => t !== tag),
                              )
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        id="field-tags"
                        value={tagDraft}
                        placeholder={
                          listing.tags.length
                            ? 'add tag…'
                            : 'web-search, brave…'
                        }
                        onChange={(e) => {
                          if (e.target.value.includes(','))
                            addTag(e.target.value);
                          else setTagDraft(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag(tagDraft);
                          } else if (
                            e.key === 'Backspace' &&
                            !tagDraft &&
                            listing.tags.length
                          )
                            update('tags', listing.tags.slice(0, -1));
                        }}
                        onBlur={() => addTag(tagDraft)}
                      />
                    </div>
                    {errorsFor('tags')}
                  </div>
                  <div className="field full">
                    <label htmlFor="field-description" className="input-label">
                      About the project
                    </label>
                    <div
                      className={
                        'input-shell' +
                        (fields.description?.length ? ' invalid' : '')
                      }
                    >
                      <textarea
                        id="field-description"
                        value={listing.description}
                        maxLength={6000}
                        rows={5}
                        onChange={(e) => update('description', e.target.value)}
                        aria-invalid={Boolean(fields.description?.length)}
                        placeholder="Explain its capabilities, who it helps, and a practical use case."
                      />
                    </div>
                    <small>
                      At least 60 characters. Plain text; links have their own
                      fields in the next step.
                    </small>
                    {errorsFor('description')}
                  </div>
                </div>
              </fieldset>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="step-title">How do agents connect?</h2>
              <p className="step-lead">
                Point us at the project and your Agentic Protocol files. Only
                public HTTPS links; keep credentials out.
              </p>
              <fieldset disabled={locked}>
                <div className="form-grid">
                  {textField('homepage', 'Project homepage', {
                    full: true,
                    code: true,
                    placeholder: 'https://yoursite.com',
                    hint: 'A website or repository that identifies this project.',
                  })}
                  {textField('repository', 'Repository URL', {
                    full: true,
                    code: true,
                    placeholder: 'https://github.com/owner/project',
                    hint: 'Optional, unless this server has no remote endpoint.',
                  })}
                  {textField('documentation', 'Documentation URL', {
                    code: true,
                    placeholder: 'https://yoursite.com/docs',
                  })}
                  {textField('endpoint', 'Remote MCP endpoint', {
                    code: true,
                    placeholder: 'https://api.yoursite.com/mcp',
                    hint: 'Optional for local servers and clients. Listings with an endpoint and authentication details get a generated connect guide with client snippets, which ranks for setup searches.',
                  })}
                  {textField('profileUrl', 'Agentic Protocol manifest URL', {
                    code: true,
                    placeholder: 'https://yoursite.com/agentic.json',
                    hint: 'Leave blank to check /agentic.json on your homepage.',
                  })}
                  {textField('readmeUrl', 'Public README URL', {
                    code: true,
                    placeholder: 'https://yoursite.com/README.md',
                    hint: 'Optional raw Markdown URL if the README lives elsewhere.',
                  })}
                  <fieldset className="field full">
                    <legend className="sr-only">Transport</legend>
                    <span className="input-label" aria-hidden="true">
                      Transport
                    </span>
                    <div className="chip-row">
                      {transports.map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          aria-pressed={listing.transport === value}
                          onClick={() => update('transport', value)}
                        >
                          {listing.transport === value ? '✓ ' : ''}
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  {selectField('authentication', 'Authentication', [
                    ['unknown', 'Not specified'],
                    ['none', 'None'],
                    ['api-key', 'API key'],
                    ['oauth', 'OAuth'],
                    ['account', 'Account'],
                    ['other', 'Other'],
                    ['not-applicable', 'Not applicable'],
                  ])}
                  {selectField(
                    'pricing',
                    'Product pricing',
                    [
                      ['unknown', 'Not specified'],
                      ['free', 'Free'],
                      ['freemium', 'Freemium'],
                      ['paid', 'Paid'],
                      ['open-source', 'Open source'],
                      ['contact', 'Contact'],
                    ],
                    'Your product’s price model, separate from the directory fee.',
                  )}
                  {textField('license', 'License', {
                    placeholder: 'MIT',
                    hint: 'Use the project’s published license, if available.',
                  })}
                  <div className="field">
                    <label htmlFor="field-platforms" className="input-label">
                      Supported platforms
                    </label>
                    <div className="input-shell">
                      <i aria-hidden="true">&gt;</i>
                      <input
                        id="field-platforms"
                        value={listing.platforms.join(', ')}
                        onChange={(e) =>
                          update(
                            'platforms',
                            e.target.value.split(',').map((v) => v.trimStart()),
                          )
                        }
                        placeholder="Claude Desktop, Cursor, Linux"
                      />
                    </div>
                    <small>Comma separated. Only documented support.</small>
                    {errorsFor('platforms')}
                  </div>
                  <div className="field full">
                    <label htmlFor="field-capabilities" className="input-label">
                      Capabilities <b>· one per line, up to 20</b>
                    </label>
                    <div className="input-shell">
                      <textarea
                        id="field-capabilities"
                        rows={3}
                        value={listing.capabilities.join('\n')}
                        onChange={(e) =>
                          update('capabilities', e.target.value.split('\n'))
                        }
                        placeholder={'Web search\nImage and video results'}
                      />
                    </div>
                    {errorsFor('capabilities')}
                  </div>
                  <div className="field full">
                    <label htmlFor="field-setup" className="input-label">
                      Setup instructions <b>· optional</b>
                    </label>
                    <div className="input-shell code">
                      <textarea
                        id="field-setup"
                        rows={5}
                        value={listing.setup}
                        onChange={(e) => update('setup', e.target.value)}
                        placeholder={
                          '{\n  "mcpServers": { "brave-search": {\n    "command": "npx", "args": ["-y", "@brave/search-mcp"]\n  } }\n}'
                        }
                      />
                    </div>
                    <small>
                      Configuration or steps for connecting. Use placeholders
                      for credentials.
                    </small>
                    {errorsFor('setup')}
                  </div>
                </div>
              </fieldset>
            </>
          )}
          {step === 3 && (
            <>
              <h2 className="step-title">
                {path === 'payment'
                  ? 'Publish with a one-time listing.'
                  : audit || running
                    ? 'Running the publication checker.'
                    : 'Run the publication checker.'}
              </h2>
              <p className="step-lead">
                {path === 'payment'
                  ? 'No file requirement. You review the listing next, then pay securely with Stripe.'
                  : 'We fetch your manifest, validate the schema and read your README. Nothing is published yet.'}
              </p>
              <fieldset className="plan-toggle">
                <legend className="sr-only">Listing option</legend>
                <button
                  type="button"
                  aria-pressed={path === 'agentic'}
                  disabled={locked}
                  onClick={() => {
                    setPath('agentic');
                    setConsent(false);
                  }}
                >
                  <strong>Free with Agentic Protocol</strong>
                  <span>US$0 · publication checker</span>
                </button>
                <button
                  type="button"
                  className="paid"
                  aria-pressed={path === 'payment'}
                  disabled={locked}
                  onClick={() => {
                    setPath('payment');
                    setConsent(false);
                  }}
                >
                  <strong>One-time listing</strong>
                  <span>
                    {paid
                      ? 'US$49.99 · payment confirmed'
                      : 'US$49.99 · Stripe checkout'}
                  </span>
                </button>
              </fieldset>
              {path === 'agentic' ? (
                <>
                  <div className="preflight-panel glass amber">
                    <CornerBrackets amber diagonal />
                    <ul className="preflight-rows" aria-live="polite">
                      {preflightRows.map((row) => (
                        <li
                          className="preflight-row"
                          data-state={row.state}
                          key={row.key}
                        >
                          <i aria-hidden="true" />
                          <span>{row.label}</span>
                          <span className="detail" title={row.detail}>
                            {row.detail}
                          </span>
                          <b>{row.state.toUpperCase()}</b>
                        </li>
                      ))}
                    </ul>
                    <div className="preflight-bar" aria-hidden="true">
                      {Array.from({ length: 40 }, (_, i) => (
                        <i key={i} data-on={i < barFilled ? barTone : ''} />
                      ))}
                    </div>
                    <div className="preflight-result">
                      <span>RESULT</span>
                      <b data-tone={resultTone}>{resultText}</b>
                    </div>
                  </div>
                  {audit && revealed ? (
                    <>
                      <div className="preflight-log">
                        {checks.map((c) => (
                          <div key={c.id}>
                            &gt; {c.label}{' '}
                            <span
                              className={
                                c.status === 'pass'
                                  ? 'ok'
                                  : c.status === 'fail'
                                    ? 'bad'
                                    : 'warn'
                              }
                            >
                              {c.status}
                            </span>{' '}
                            · {c.detail}
                          </div>
                        ))}
                        {!checks.length && (
                          <div>
                            &gt;{' '}
                            {audit.report.errors?.join(' ') ||
                              'The checker returned no individual checks. Open the Agentic Protocol auditor for the full report.'}
                          </div>
                        )}
                        <div>
                          &gt; checked{' '}
                          {new Date(audit.checked_at).toLocaleString()}
                          {eligible
                            ? ''
                            : ' · recheck after changing your files'}
                          {eligible && (
                            <>
                              {' · '}
                              <button
                                type="button"
                                className="text-link"
                                disabled={locked}
                                onClick={() => run(checkFiles, CHECKING)}
                              >
                                run again
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {checks.some((c) => c.status !== 'pass' && c.remedy) && (
                        <div className="preflight-remedies">
                          {checks
                            .filter((c) => c.status !== 'pass' && c.remedy)
                            .map((c) => (
                              <div key={c.id}>
                                <strong>{c.label}</strong>
                                {c.remedy}{' '}
                                <a
                                  href="https://ruagentic.org/generate/"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Instructions ↗
                                </a>
                              </div>
                            ))}
                        </div>
                      )}
                    </>
                  ) : (
                    !running && (
                      <div className="preflight-log">
                        <div>
                          &gt; 1 ·{' '}
                          <a
                            href="https://ruagentic.org/generate/"
                            target="_blank"
                            rel="noreferrer"
                          >
                            generate agentic.json, agentic.txt and README at
                            ruagentic.org ↗
                          </a>
                        </div>
                        <div>
                          &gt; 2 · publish agentic.json and agentic.txt on your
                          homepage origin
                        </div>
                        <div>
                          &gt; 3 · add the README section with links to both
                          Agentic Protocol sites and your files
                        </div>
                        <div>
                          &gt; the check reads public files; it does not run
                          your tools
                        </div>
                      </div>
                    )
                  )}
                </>
              ) : (
                <div className="notice">
                  {paid
                    ? 'Your completed payment covers updates to this same project.'
                    : 'You will review the listing next, then complete secure payment with Stripe. No recurring directory subscription.'}
                </div>
              )}
            </>
          )}
          {step === 4 && (
            <>
              <h2 className="step-title">Review and publish.</h2>
              <p className="step-lead">
                {path === 'agentic'
                  ? eligible
                    ? 'Checker passed. Your listing is free with Agentic Protocol files.'
                    : 'The publication checker must pass before a free listing goes live.'
                  : paid
                    ? 'Payment confirmed. Publish when you are ready.'
                    : 'Confirm the details, then complete secure payment with Stripe to go live.'}
              </p>
              <div className="review-tiles">
                <div className="review-tile">
                  <div className="tile-label">LISTING</div>
                  <strong>{listing.name}</strong>
                  <div>
                    {kindLabel(listing.kind)} · {listing.category}
                  </div>
                  <div>ruagentic.com/tools/{slug || '…'}</div>
                </div>
                <div className="review-tile">
                  <div className="tile-label">PLAN</div>
                  <strong>
                    {path === 'agentic'
                      ? 'Free with Agentic Protocol'
                      : 'One-time listing'}
                  </strong>
                  <div>
                    {path === 'agentic'
                      ? 'US$0 · checker passed'
                      : paid
                        ? 'US$49.99 · payment confirmed'
                        : 'US$49.99 · Stripe checkout'}
                  </div>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      setPath(path === 'agentic' ? 'payment' : 'agentic');
                      setConsent(false);
                      setStep(3);
                    }}
                  >
                    {path === 'agentic'
                      ? 'Switch to one-time listing →'
                      : 'Switch to free with Agentic Protocol →'}
                  </button>
                </div>
                <div className="review-tile" style={{ gridColumn: '1 / -1' }}>
                  <div className="tile-label">SUMMARY</div>
                  <div>{listing.summary}</div>
                  <div className="preserve-lines">{listing.description}</div>
                </div>
                <label className="check-label confirm-row">
                  <input
                    type="checkbox"
                    checked={consent}
                    disabled={Boolean(busy)}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <i aria-hidden="true">✓</i>
                  <span>
                    I confirm the project follows the{' '}
                    <Link href="/guidelines">listing guidelines</Link> and{' '}
                    <Link href="/terms">terms</Link>, the details are accurate,
                    and I have rights to publish it.
                  </span>
                </label>
              </div>
            </>
          )}
        </div>
        <div className="form-footer">
          <button
            type="button"
            className="button ghost"
            disabled={step === 1 || Boolean(busy)}
            aria-disabled={step === 1}
            onClick={() => setStep(Math.max(1, step - 1))}
          >
            ← Back
          </button>
          <div className="form-footer-right">
            <span className="footer-hint" aria-hidden="true">
              ⌘ ⏎
            </span>
            <button
              type="button"
              className="button primary"
              data-busy={running}
              disabled={nextDisabled}
              onClick={next}
            >
              {running && <LoaderCircle size={14} className="spin" />}
              {nextLabel}
            </button>
          </div>
        </div>
      </section>
      <aside className="submission-aside">
        <p className="aside-label">LISTING PREVIEW · LIVE</p>
        <ToolCard
          name={listing.name || 'Your project name'}
          kind={listing.kind}
          summary={
            listing.summary ||
            'Your project description will appear here as you fill in your details.'
          }
          category={listing.category}
          source={saved ? 'SAVED' : 'DRAFT'}
        />
        <p className="agent-view-label">
          AGENT VIEW · /api/v1/listings/{slug || '…'}
        </p>
        <pre
          className="agent-view"
          aria-label="Machine-readable listing preview"
        >
          {'{\n  '}
          <span className="k">&quot;name&quot;</span>: &quot;
          {listing.name || '…'}
          &quot;,{'\n  '}
          <span className="k">&quot;kind&quot;</span>: &quot;{listing.kind}
          &quot;,
          {'\n  '}
          <span className="k">&quot;category&quot;</span>: &quot;
          {listing.category}&quot;,{'\n  '}
          <span className="k">&quot;status&quot;</span>:{' '}
          <span
            className={
              status === 'ready' ||
              status === 'checked' ||
              status === 'published'
                ? 'cyan'
                : 'amber'
            }
          >
            &quot;{status}&quot;
          </span>
          ,{'\n  '}
          <span className="k">&quot;transport&quot;</span>: &quot;
          {listing.transport}&quot;,{'\n  '}
          <span className="k">&quot;listing&quot;</span>: &quot;
          {path === 'agentic' ? 'free' : 'paid'}&quot;{'\n}'}
        </pre>
        <div className="aside-account">
          SIGNED IN · <b>{email}</b>
          <br />
          <Link href="/dashboard">Your dashboard ↗</Link> ·{' '}
          <Link href="/guidelines">Listing guidelines ↗</Link>
        </div>
      </aside>
    </main>
  );
}
