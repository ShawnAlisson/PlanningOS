'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronRight,
  FileText,
  Info,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';

type SiteFact = {
  conservationZone: boolean;
  floodZone: 'Zone 1' | 'Zone 2' | 'Zone 3';
  highwaysProximity: boolean;
  neighbourImpactLevel: 'low' | 'medium' | 'high';
};

type AddressSuggestion = {
  label: string;
  area: string;
  note: string;
  seed: SiteFact;
};

const ADDRESS_SUGGESTIONS: AddressSuggestion[] = [
  {
    label: '24 Kingswood Road, London SE22 8NG',
    area: 'South London',
    note: 'Typical householder extension case with light flood and highways pressure.',
    seed: { conservationZone: false, floodZone: 'Zone 1', highwaysProximity: false, neighbourImpactLevel: 'low' },
  },
  {
    label: '12 Regency Gate, Bath BA1 5HG',
    area: 'Bath',
    note: 'Heritage-sensitive context with stronger design scrutiny.',
    seed: { conservationZone: true, floodZone: 'Zone 1', highwaysProximity: true, neighbourImpactLevel: 'medium' },
  },
  {
    label: '8 Riverside Court, Maidenhead SL6 1AP',
    area: 'River corridor',
    note: 'Higher flood-awareness example with a stronger neighbour impact profile.',
    seed: { conservationZone: false, floodZone: 'Zone 3', highwaysProximity: false, neighbourImpactLevel: 'high' },
  },
  {
    label: '15 Maple Avenue, Bristol BS2 9XF',
    area: 'Bristol',
    note: 'Good baseline demo site for a simple extension submission.',
    seed: { conservationZone: false, floodZone: 'Zone 1', highwaysProximity: false, neighbourImpactLevel: 'low' },
  },
  {
    label: '44 North Parade, York YO30 7DR',
    area: 'York',
    note: 'A compact urban plot with a tighter neighbour context.',
    seed: { conservationZone: true, floodZone: 'Zone 1', highwaysProximity: true, neighbourImpactLevel: 'medium' },
  },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export default function UploadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(1);
  const [addressQuery, setAddressQuery] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<AddressSuggestion | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [advancedFactsOpen, setAdvancedFactsOpen] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const [conservationZone, setConservationZone] = useState(false);
  const [floodZone, setFloodZone] = useState<SiteFact['floodZone']>('Zone 1');
  const [highwaysProximity, setHighwaysProximity] = useState(false);
  const [neighbourImpactLevel, setNeighbourImpactLevel] = useState<SiteFact['neighbourImpactLevel']>('low');

  const addressMatches = useMemo(() => {
    const query = normalize(addressQuery);

    if (!query) return ADDRESS_SUGGESTIONS.slice(0, 4);

    const exactMatches = ADDRESS_SUGGESTIONS.filter((item) => normalize(item.label).includes(query));
    if (exactMatches.length > 0) return exactMatches;

    const tokenMatches = ADDRESS_SUGGESTIONS.filter((item) => {
      const haystack = normalize(`${item.label} ${item.area} ${item.note}`);
      return query.split(' ').every((token) => haystack.includes(token));
    });

    if (tokenMatches.length > 0) return tokenMatches;

    return [];
  }, [addressQuery]);

  const selectedFacts = useMemo<SiteFact>(() => {
    if (selectedAddress) return selectedAddress.seed;
    return {
      conservationZone,
      floodZone,
      highwaysProximity,
      neighbourImpactLevel,
    };
  }, [selectedAddress, conservationZone, floodZone, highwaysProximity, neighbourImpactLevel]);

  const progress = selectedAddress ? (description ? 3 : 2) : addressQuery ? 1 : 0;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])]);
  };

  const selectAddress = (suggestion: AddressSuggestion) => {
    setSelectedAddress(suggestion);
    setAddressQuery(suggestion.label);
    setFloodZone(suggestion.seed.floodZone);
    setConservationZone(suggestion.seed.conservationZone);
    setHighwaysProximity(suggestion.seed.highwaysProximity);
    setNeighbourImpactLevel(suggestion.seed.neighbourImpactLevel);
    setStage(2);

    if (!titleTouched && !title) {
      setTitle(`Planning review for ${suggestion.label}`);
    }
  };

  const useTypedAddress = () => {
    const trimmed = addressQuery.trim();
    if (!trimmed) return;

    const fallback: AddressSuggestion = {
      label: trimmed,
      area: 'Entered by user',
      note: 'Custom address provided without a curated suggestion match.',
      seed: { conservationZone, floodZone, highwaysProximity, neighbourImpactLevel },
    };

    selectAddress(fallback);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAddress) {
      alert('Please choose or confirm an address first.');
      setStage(1);
      return;
    }

    const finalTitle = title.trim() || `Planning review for ${selectedAddress.label}`;
    const finalDescription =
      description.trim() ||
      'Address-first planning submission. Review requested with automatic UK planning constraint derivation.';

    setLoading(true);

    try {
      const form = new FormData();
      const extractedData = advancedFactsOpen
        ? {
            propertyType: 'Semi-detached',
            extensionType: 'rear',
            proposedHeight: 3.2,
            proposedVolume: 35,
            conservationZone,
            floodZone,
            highwaysProximity,
            neighbourImpactLevel,
          }
        : undefined;

      form.append(
        'metadata',
        JSON.stringify({
          title: finalTitle,
          address: selectedAddress.label,
          description: finalDescription,
          sourceMode: 'manual',
          sourceNote: advancedFactsOpen
            ? 'Address-first submission with user-confirmed site facts.'
            : 'Address-first submission. Site constraints will be auto-derived from the selected location and uploaded documents.',
          extractedData,
        })
      );

      files.forEach((file) => form.append('files', file));

      const res = await fetch('/api/applications/upload', {
        method: 'POST',
        body: form,
      });

      if (!res.ok) throw new Error('Failed to create application');

      const data = await res.json();
      router.push(`/processing/${data.id}`);
    } catch (error) {
      console.error(error);
      alert('Could not start the planning audit.');
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              <Sparkles className="h-3.5 w-3.5" />
              Address-first planning review
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Start with the site address, then add the plan</h1>
              <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                Pick a postcode or exact address, then attach your DWG/PDF or enter the minimum project details you know. The system will auto-derive flood,
                highways, heritage, and neighbour signals unless you choose to confirm them yourself.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p className="font-medium text-slate-900">What happens next</p>
            <p className="mt-1 max-w-xs">
              We create the application, run the specialist agents in parallel, and take you straight to a live processing screen.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
        {[
          { label: '1. Find site', active: stage >= 1 },
          { label: '2. Add context', active: stage >= 2 },
          { label: '3. Upload evidence', active: stage >= 3 },
        ].map((item, index) => (
          <div
            key={item.label}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${
              item.active ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-slate-500 shadow-sm">
              {index + 1}
            </span>
            {item.label}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
        <div className="space-y-6">
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">1. Find the site</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Enter a postcode, partial address, or exact site location. We’ll show a short list so the user can choose the right property before
                  uploading documents.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Postcode or address</label>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={addressQuery}
                  onChange={(e) => {
                    setAddressQuery(e.target.value);
                    setSelectedAddress(null);
                  }}
                  placeholder="e.g. SW1A 1AA, 24 Kingswood Road, London"
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Suggested matches</p>
                <p className="text-xs text-slate-400">{addressMatches.length > 0 ? `${addressMatches.length} option(s)` : 'Type to search'}</p>
              </div>

              <div className="mt-3 grid gap-3">
                {addressMatches.length > 0 ? (
                  addressMatches.map((match) => {
                    const active = selectedAddress?.label === match.label;
                    return (
                      <button
                        key={match.label}
                        type="button"
                        onClick={() => selectAddress(match)}
                        className={`rounded-2xl border p-4 text-left transition-all ${
                          active
                            ? 'border-sky-300 bg-sky-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-medium text-slate-900">{match.label}</p>
                            <p className="text-sm text-slate-600">{match.note}</p>
                            <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-400">{match.area}</p>
                          </div>
                          <ChevronRight className={`mt-0.5 h-4 w-4 ${active ? 'text-sky-600' : 'text-slate-300'}`} />
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    No close match yet. You can still confirm the typed address and continue.
                  </div>
                )}
              </div>

              {addressQuery.trim() && addressMatches.length === 0 && (
                <button
                  type="button"
                  onClick={useTypedAddress}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100"
                >
                  Use typed address
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </section>

          <section className={`rounded-[1.75rem] border p-6 shadow-sm ${selectedAddress ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50'}`}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">2. Add the project summary</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Keep this short. The address and attached plans will do most of the heavy lifting for the agents.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Title</label>
                <input
                  value={title}
                  onChange={(e) => {
                    setTitleTouched(true);
                    setTitle(e.target.value);
                  }}
                  placeholder="e.g. Rear extension and rooflight"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-300"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Short description</label>
                <textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the proposal in a sentence or two. You can keep it simple."
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-300"
                />
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">3. Upload evidence</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  DWG, PDF, JPG, and PNG files are accepted. If you only have an address for now, you can still submit and add files later.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
              <input
                type="file"
                multiple
                accept=".dwg,.pdf,.png,.jpg,.jpeg"
                onChange={handleFileUpload}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <div className="relative">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <FileText className="h-5 w-5 text-slate-500" />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-900">Drop files here or click to browse</p>
                <p className="mt-1 text-xs text-slate-500">Optional, but useful for plan image extraction and audit evidence.</p>
              </div>
            </div>

            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    <span className="max-w-[70%] truncate font-medium text-slate-800">{file.name}</span>
                    <span className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6">
              <button
                type="button"
                onClick={() => setAdvancedFactsOpen((value) => !value)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Info className="h-4 w-4" />
                {advancedFactsOpen ? 'Hide' : 'Add'} optional site facts
              </button>

              {advancedFactsOpen && (
                <div className="mt-4 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Flood risk zone</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Zone 1', 'Zone 2', 'Zone 3'] as const).map((zone) => (
                        <button
                          key={zone}
                          type="button"
                          onClick={() => setFloodZone(zone)}
                          className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                            floodZone === zone
                              ? 'border-sky-300 bg-sky-50 text-sky-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200'
                          }`}
                        >
                          {zone}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setConservationZone((value) => !value)}
                      className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                        conservationZone ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-900">Conservation area</p>
                      <p className="mt-1 text-xs text-slate-500">{conservationZone ? 'Marked as sensitive' : 'Not marked'}</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setHighwaysProximity((value) => !value)}
                      className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                        highwaysProximity ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-900">Close to highway</p>
                      <p className="mt-1 text-xs text-slate-500">{highwaysProximity ? 'Marked as near a main road' : 'Not marked'}</p>
                    </button>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Neighbour impact</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['low', 'medium', 'high'] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setNeighbourImpactLevel(level)}
                          className={`rounded-xl border px-3 py-2 text-xs font-medium uppercase transition-colors ${
                            neighbourImpactLevel === level
                              ? 'border-sky-300 bg-sky-50 text-sky-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <button
            type="submit"
            disabled={loading || !selectedAddress}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting analysis...
              </>
            ) : (
              <>
                Start multi-agent audit
                <Check className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Live summary</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Selected address</p>
                <p className="mt-1 font-medium text-slate-900">{selectedAddress?.label || 'None selected yet'}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Auto-derived site context</p>
                <ul className="mt-2 space-y-1 text-slate-600">
                  <li>Flood: {selectedFacts.floodZone}</li>
                  <li>Highways: {selectedFacts.highwaysProximity ? 'Potential proximity flag' : 'No immediate proximity flag'}</li>
                  <li>Heritage: {selectedFacts.conservationZone ? 'Potential conservation sensitivity' : 'No conservation flag'}</li>
                  <li>Neighbours: {selectedFacts.neighbourImpactLevel}</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Notes</p>
                <p className="mt-1 leading-relaxed text-slate-600">
                  Real UK planning references are built in, but live council, flood, and highways APIs are not connected yet. That keeps this MVP fast and
                  hackathon-friendly while still being explainable.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Recommended path</p>
            <ol className="mt-4 space-y-3 text-sm text-slate-600">
              <li>1. Enter a postcode or site address and choose the correct match.</li>
              <li>2. Add a short proposal summary if you have one.</li>
              <li>3. Upload your DWG, PDF, or image files, then start the audit.</li>
            </ol>
          </div>
        </aside>
      </form>
    </div>
  );
}
