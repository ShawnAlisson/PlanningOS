// Write-time classification. May call an LLM (optional, best-effort) to help
// tag freeform text, but always resolves to one deterministic tag that gets
// stored on the record. The READ path (gate.ts) never re-classifies and never
// calls an LLM - it only trusts the tag written here.

import { chatCompletion, isLlmConfigured } from '../llm/client';
import type { DataClassification } from './types';

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(\+?\d[\d\s()-]{7,}\d)/;
const NI_NUMBER_RE = /\b[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]\b/i;
const INTERNAL_KEYWORDS = ['confidential', 'internal only', 'officer only', 'do not disclose', 'not for publication'];

function heuristicClassify(text: string): DataClassification {
  if (!text) return 'public';
  if (EMAIL_RE.test(text) || PHONE_RE.test(text) || NI_NUMBER_RE.test(text)) return 'personal';
  const lower = text.toLowerCase();
  if (INTERNAL_KEYWORDS.some((kw) => lower.includes(kw))) return 'internal';
  return 'public';
}

/**
 * Classify a piece of free text at write time. Uses an LLM (if configured) as
 * a second opinion for nuanced cases, but always falls back to - and never
 * downgrades below - the deterministic heuristic result, so a missing/failed
 * LLM call can only make classification MORE conservative, never less safe.
 */
export async function classifyText(text: string | undefined, opts: { context?: string } = {}): Promise<DataClassification> {
  if (!text || !text.trim()) return 'public';

  const heuristic = heuristicClassify(text);
  if (heuristic !== 'public') return heuristic; // already flagged sensitive by a deterministic rule

  if (!isLlmConfigured()) return heuristic;

  try {
    const content = await chatCompletion(
      [
        {
          role: 'system',
          content:
            'Classify the given text for a UK council planning system into exactly one label: public, restricted, internal, or personal. personal = contains identifiable personal data about a named individual. internal = case-officer-only deliberation/opinion not meant for the public register. restricted = sensitive but not personal (e.g. security details). public = fine for the public planning register. Respond with only the single lowercase label.',
        },
        { role: 'user', content: `${opts.context ? `Context: ${opts.context}\n` : ''}Text: ${text}` },
      ],
      { temperature: 0 }
    );

    const label = content.trim().toLowerCase();
    if (label === 'public' || label === 'restricted' || label === 'internal' || label === 'personal') {
      return label;
    }
    return heuristic;
  } catch {
    return heuristic;
  }
}

export async function classifyApplicationFields(app: {
  description?: string;
  applicantContact?: { name?: string; email?: string; phone?: string };
  officerNotes?: string;
}): Promise<Record<'description' | 'applicantContact' | 'officerNotes', DataClassification>> {
  const contactText = app.applicantContact
    ? [app.applicantContact.name, app.applicantContact.email, app.applicantContact.phone].filter(Boolean).join(' ')
    : '';

  const [description, applicantContact, officerNotes] = await Promise.all([
    classifyText(app.description, { context: 'Public planning application description' }),
    contactText ? Promise.resolve<DataClassification>('personal') : Promise.resolve<DataClassification>('public'),
    app.officerNotes
      ? classifyText(app.officerNotes, { context: 'Case officer internal note' }).then((c) => (c === 'public' ? 'internal' : c))
      : Promise.resolve<DataClassification>('public'),
  ]);

  return { description, applicantContact, officerNotes };
}
