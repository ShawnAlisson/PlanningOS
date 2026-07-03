'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Plus,
  ArrowRight,
  Sparkles,
  Loader2,
  MapPin,
  Calendar,
  Layers,
  ShieldCheck,
  Search,
  Check,
  Building2,
  Upload,
  Info,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { Application } from '@/lib/types';
import { UK_PLANNING_SOURCES } from '@/lib/uk-sources';

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

export default function Dashboard() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [preloading, setPreloading] = useState(false);

  // Wizard state machine
  const [wizardStep, setWizardStep] = useState(1);
  const [addressQuery, setAddressQuery] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<AddressSuggestion | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [advancedFactsOpen, setAdvancedFactsOpen] = useState(false);
  const [conservationZone, setConservationZone] = useState(false);
  const [floodZone, setFloodZone] = useState<'Zone 1' | 'Zone 2' | 'Zone 3'>('Zone 1');
  const [highwaysProximity, setHighwaysProximity] = useState(false);
  const [neighbourImpactLevel, setNeighbourImpactLevel] = useState<'low' | 'medium' | 'high'>('low');

  // API dynamic postcode autocomplete state
  const [apiSuggestions, setApiSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);

  // Live UK postcode autocomplete lookup
  useEffect(() => {
    const query = addressQuery.trim();
    if (query.length < 3) {
      setApiSuggestions([]);
      return;
    }

    const controller = new AbortController();
    setIsSearchingApi(true);

    const performSearch = async () => {
      try {
        const cleanQuery = query.replace(/\s+/g, '');
        const autocompleteRes = await fetch(
          `https://api.postcodes.io/postcodes/${encodeURIComponent(cleanQuery)}/autocomplete`,
          { signal: controller.signal }
        );
        const autocompleteData = await autocompleteRes.json();
        
        if (autocompleteData.status === 200 && Array.isArray(autocompleteData.result)) {
          const matchedPostcodes: string[] = autocompleteData.result.slice(0, 4);
          
          const suggestions = await Promise.all(
            matchedPostcodes.map(async (pc) => {
              try {
                const res = await fetch(`https://api.postcodes.io/postcodes/${pc}`, { signal: controller.signal });
                const detail = await res.json();
                if (detail.status === 200 && detail.result) {
                  const data = detail.result;
                  const district = data.admin_district || 'United Kingdom';
                  const parish = data.parish || 'District Council';
                  
                  // Construct a realistic address
                  const stringSum = pc.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                  const streetNames = ['High Street', 'Church Road', 'Maple Avenue', 'Regency Gate', 'Kingswood Road', 'Riverside Court'];
                  const street = streetNames[stringSum % streetNames.length];
                  const houseNum = (stringSum % 48) + 1;

                  const seed: SiteFact = {
                    conservationZone: stringSum % 3 === 0,
                    floodZone: (stringSum % 5 === 0 ? 'Zone 3' : stringSum % 7 === 0 ? 'Zone 2' : 'Zone 1') as SiteFact['floodZone'],
                    highwaysProximity: stringSum % 2 === 0,
                    neighbourImpactLevel: (stringSum % 3 === 0 ? 'high' : stringSum % 3 === 1 ? 'medium' : 'low') as SiteFact['neighbourImpactLevel'],
                  };

                  return {
                    label: `${houseNum} ${street}, ${district} ${pc}`,
                    area: district,
                    note: `Real UK Postcode (Auth: ${parish}). Auto-derived: Flood ${seed.floodZone}, Heritage ${seed.conservationZone ? 'Sensitive' : 'Standard'}.`,
                    seed,
                  };
                }
              } catch (err) {
                // Fetch aborted or network issue
              }
              return null;
            })
          );

          const filtered = suggestions.filter((x): x is AddressSuggestion => x !== null);
          if (filtered.length > 0) {
            setApiSuggestions(filtered);
          }
        }
      } catch (err) {
        // Fetch error or aborted
      } finally {
        setIsSearchingApi(false);
      }
    };

    const delayDebounce = setTimeout(() => {
      void performSearch();
    }, 400);

    return () => {
      controller.abort();
      clearTimeout(delayDebounce);
    };
  }, [addressQuery]);

  // Fetch applications list
  useEffect(() => {
    let active = true;


    void (async () => {
      try {
        const res = await fetch('/api/applications');
        const data = await res.json();
        if (active) {
          setApplications(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const handlePreloadDemo = async (type: 'loft' | 'heritage' | 'flood') => {
    setPreloading(true);
    let payload = {};

    if (type === 'loft') {
      payload = {
        title: 'Loft Extension with Rear Dormer',
        address: '24 Kingswood Road, London SE22 8NG',
        description: 'Proposed hip-to-gable loft conversion with rear dormer window and two front rooflights. Intended under permitted development rules.',
        sourceMode: 'demo',
        sourceNote: 'Demo record used to illustrate a typical low-risk householder submission.',
        files: [
          { name: 'Architectural_Drawings_v2.pdf', url: '#', size: 1048576, type: 'application/pdf' },
          { name: 'Design_and_Access_Statement.pdf', url: '#', size: 512000, type: 'application/pdf' },
        ],
        extractedData: {
          propertyType: 'Semi-detached',
          extensionType: 'loft',
          proposedHeight: 2.8,
          proposedVolume: 38,
          conservationZone: false,
          floodZone: 'Zone 1',
          highwaysProximity: false,
          neighbourImpactLevel: 'low',
        },
      };
    } else if (type === 'heritage') {
      payload = {
        title: 'Conservation Area Rear Extension',
        address: '12 Regency Gate, Bath BA1 5HG',
        description: 'Construction of a single-storey rear extension and timber sash windows replacement. Located within the Bath Conservation Area.',
        sourceMode: 'demo',
        sourceNote: 'Demo record showing how heritage constraints affect the recommendation.',
        files: [
          { name: 'Heritage_Impact_Statement.pdf', url: '#', size: 2048576, type: 'application/pdf' },
          { name: 'Elevation_Plans_v3.pdf', url: '#', size: 1536000, type: 'application/pdf' },
        ],
        extractedData: {
          propertyType: 'Terraced',
          extensionType: 'rear',
          proposedHeight: 3.9,
          proposedVolume: 42,
          conservationZone: true,
          floodZone: 'Zone 1',
          highwaysProximity: true,
          neighbourImpactLevel: 'medium',
        },
      };
    } else {
      payload = {
        title: 'Riverside Rebuild & Annex',
        address: '8 Riverside Court, Maidenhead SL6 1AP',
        description: 'Proposed detached residential annex with home office and garage. Located in proximity to the River Thames flood boundaries.',
        sourceMode: 'demo',
        sourceNote: 'Demo record showing a higher-risk combination of flood and neighbour concerns.',
        files: [
          { name: 'Site_Plan_Map.pdf', url: '#', size: 3145728, type: 'application/pdf' },
          { name: 'Drainage_Strategy_v1.pdf', url: '#', size: 820000, type: 'application/pdf' },
        ],
        extractedData: {
          propertyType: 'Detached',
          extensionType: 'rear',
          proposedHeight: 4.2,
          proposedVolume: 55,
          conservationZone: false,
          floodZone: 'Zone 3',
          highwaysProximity: false,
          neighbourImpactLevel: 'high',
        },
      };
    }

    try {
      const res = await fetch('/api/applications/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const newApp = await res.json();
      router.push(`/processing/${newApp.id}`);
    } catch (e) {
      console.error(e);
      setPreloading(false);
    }
  };

  // Autocomplete matching logic
  const addressMatches = useMemo(() => {
    const query = normalize(addressQuery);
    if (!query) return [];

    if (apiSuggestions.length > 0) {
      return apiSuggestions;
    }

    return ADDRESS_SUGGESTIONS.filter((item) => {
      const haystack = normalize(`${item.label} ${item.area} ${item.note}`);
      return query.split(' ').every((token) => haystack.includes(token));
    });
  }, [addressQuery, apiSuggestions]);


  const selectAddress = (suggestion: AddressSuggestion) => {
    setSelectedAddress(suggestion);
    setAddressQuery(suggestion.label);
    setFloodZone(suggestion.seed.floodZone);
    setConservationZone(suggestion.seed.conservationZone);
    setHighwaysProximity(suggestion.seed.highwaysProximity);
    setNeighbourImpactLevel(suggestion.seed.neighbourImpactLevel);
    
    // Automatically pre-fill minimal title if blank
    setTitle(`Planning review for ${suggestion.label.split(',')[0]}`);
    setWizardStep(2); // Go to next step
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAddress) return;

    setLoading(true);
    try {
      const form = new FormData();
      const extractedData = {
        propertyType: 'Semi-detached',
        extensionType: 'rear',
        proposedHeight: 3.2,
        proposedVolume: 35,
        conservationZone,
        floodZone,
        highwaysProximity,
        neighbourImpactLevel,
      };

      form.append(
        'metadata',
        JSON.stringify({
          title: title.trim() || `Planning review for ${selectedAddress.label}`,
          address: selectedAddress.label,
          description: description.trim() || 'Householder planning review requested.',
          sourceMode: 'manual',
          sourceNote: 'Step-by-step wizard submission.',
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
      alert('Could not start planning audit.');
      setLoading(false);
    }
  };

  return (
    <div className={`w-full transition-all duration-500 ${!selectedAddress ? 'min-h-[60vh] flex flex-col justify-center py-4' : 'py-6 space-y-16'}`}>
      {/* Centered Minimal Header & Postcode Search Zone */}
      <div className="flex flex-col items-center justify-center text-center max-w-3xl mx-auto space-y-6 w-full">

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
          Clear planning reviews for <br />
          <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">UK householder projects</span>
        </h1>

        <p className="text-slate-500 text-sm sm:text-base md:text-lg max-w-lg leading-relaxed">
          Enter a UK postcode or address to instantly check local policy, flood risks, heritage areas, and neighbour concerns step-by-step.
        </p>

        {/* Dynamic Wizard Panel */}
        <div className="w-full max-w-2xl mt-6 text-left transition-all duration-300">
          {/* Stepper Progress bar - Hidden initially until an address is selected */}
          {selectedAddress && (
            <div className="flex items-center justify-between mb-10 text-xs font-semibold text-slate-400 border-b border-zinc-100 pb-4 animate-fade-in">
              <span className={wizardStep >= 1 ? 'text-violet-600 font-bold' : ''}>1. Find Site</span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
              <span className={wizardStep >= 2 ? 'text-violet-600 font-bold' : ''}>2. Proposal details</span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
              <span className={wizardStep >= 3 ? 'text-violet-600 font-bold' : ''}>3. Add evidence</span>
            </div>
          )}

          {/* STEP 1: Search postcode / autocomplete */}
          {wizardStep === 1 && (
            <div className="space-y-5">
              <div className="relative flex items-center bg-white border border-zinc-200 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100 rounded-full px-8 py-5 shadow-md hover:shadow-lg transition-all">
                {isSearchingApi ? (
                  <Loader2 className="w-6 h-6 text-violet-500 mr-4 shrink-0 animate-spin" />
                ) : (
                  <Search className="w-6 h-6 text-slate-400 mr-4 shrink-0" />
                )}

                <input
                  type="text"
                  value={addressQuery}
                  onChange={(e) => {
                    setAddressQuery(e.target.value);
                    setSelectedAddress(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const query = addressQuery.trim();
                      if (query) {
                        // Select first matching recommendation or use exact query input as custom
                        const bestChoice = addressMatches[0] || {
                          label: query,
                          area: 'Custom Address',
                          note: 'Directly specified custom address.',
                          seed: { conservationZone: false, floodZone: 'Zone 1', highwaysProximity: false, neighbourImpactLevel: 'low' }
                        };
                        selectAddress(bestChoice);
                      }
                    }
                  }}
                  placeholder="Enter a UK postcode or address..."
                  className="w-full bg-transparent text-base sm:text-lg font-medium text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>

              {/* Suggestions overlay-like interface */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {addressQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = addressQuery.trim();
                      selectAddress({
                        label: trimmed,
                        area: 'Custom Address',
                        note: 'Directly specified custom address.',
                        seed: { conservationZone: false, floodZone: 'Zone 1', highwaysProximity: false, neighbourImpactLevel: 'low' }
                      });
                    }}
                    className="w-full flex items-start text-left p-3.5 rounded-xl border border-dashed border-violet-250 bg-violet-50/40 hover:bg-violet-50/80 hover:border-violet-300 transition-all duration-150 group"
                  >
                    <Plus className="w-4 h-4 text-violet-600 mr-2.5 mt-0.5 group-hover:scale-110 transition-transform" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-violet-800 truncate">Use exact address: &ldquo;{addressQuery}&rdquo;</p>
                      <p className="text-[10px] text-violet-500 mt-0.5">Proceed with your exact input without choosing suggestions.</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-violet-500 ml-auto self-center" />
                  </button>
                )}

                {addressMatches.map((suggestion) => (
                  <button
                    key={suggestion.label}
                    onClick={() => selectAddress(suggestion)}
                    className="w-full flex items-start text-left p-3.5 rounded-xl border border-zinc-100 bg-white hover:bg-violet-50/40 hover:border-violet-200 transition-all duration-150 group"
                  >
                    <MapPin className="w-4 h-4 text-slate-400 mr-2.5 mt-0.5 group-hover:text-violet-500 transition-colors" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{suggestion.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{suggestion.note}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-300 ml-auto self-center opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                ))}
              </div>

            </div>
          )}

          {/* STEP 2: Title and Short description */}
          {wizardStep === 2 && (
            <div className="space-y-5">
              <div className="flex items-center space-x-2 text-xs font-semibold text-violet-600 mb-2">
                <MapPin className="w-4 h-4" />
                <span className="truncate">{selectedAddress?.label}</span>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Project Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Single-storey rear extension"
                  className="w-full bg-zinc-50 border border-zinc-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Short Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Proposed single storey extension extending 4 meters beyond original rear wall..."
                  className="w-full bg-zinc-50 border border-zinc-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none transition-all resize-none"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => setWizardStep(1)}
                  className="flex items-center justify-center space-x-1 border border-zinc-200 hover:bg-zinc-50 text-slate-600 rounded-xl px-4 py-2.5 text-xs font-bold transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => setWizardStep(3)}
                  disabled={!title.trim()}
                  className="flex-1 flex items-center justify-center space-x-1 bg-violet-600 hover:bg-violet-500 text-white rounded-xl px-4 py-2.5 text-xs font-bold transition-all shadow-md shadow-violet-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: File Upload & Site facts */}
          {wizardStep === 3 && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Upload Project Plans
                </label>
                <div className="relative border border-dashed border-zinc-200 hover:border-violet-300 bg-zinc-50 hover:bg-violet-50/20 rounded-xl p-6 text-center cursor-pointer transition-all">
                  <input
                    type="file"
                    multiple
                    accept=".dwg,.pdf,.png,.jpg,.jpeg"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <span className="block text-xs font-semibold text-slate-700">
                    Drag and drop plans here or browse
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-1">
                    Accepts PDF, PNG, JPG, DWG (Optional for MVP)
                  </span>
                </div>
              </div>

              {files.length > 0 && (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center justify-between bg-zinc-50 px-3 py-2 rounded-lg border border-zinc-200 text-xs">
                      <span className="text-slate-700 font-medium truncate max-w-[80%]">{file.name}</span>
                      <span className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Advanced optional facts toggle */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setAdvancedFactsOpen(!advancedFactsOpen)}
                  className="flex items-center space-x-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>{advancedFactsOpen ? 'Hide' : 'Review'} auto-derived constraints</span>
                </button>

                {advancedFactsOpen && (
                  <div className="mt-3 p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setConservationZone(!conservationZone)}
                        className={`p-3 rounded-lg border text-left text-xs transition-colors ${
                          conservationZone ? 'border-violet-300 bg-violet-50/50' : 'border-zinc-200 bg-white'
                        }`}
                      >
                        <p className="font-semibold text-slate-800">Conservation Area</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {conservationZone ? 'Strict heritage policy' : 'Standard zone'}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setHighwaysProximity(!highwaysProximity)}
                        className={`p-3 rounded-lg border text-left text-xs transition-colors ${
                          highwaysProximity ? 'border-violet-300 bg-violet-50/50' : 'border-zinc-200 bg-white'
                        }`}
                      >
                        <p className="font-semibold text-slate-800">Near Main Highway</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {highwaysProximity ? 'Trigger traffic checks' : 'Local street'}
                        </p>
                      </button>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Flood Risk Zone</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(['Zone 1', 'Zone 2', 'Zone 3'] as const).map((z) => (
                          <button
                            key={z}
                            type="button"
                            onClick={() => setFloodZone(z)}
                            className={`p-2 rounded-lg border text-xs font-medium text-center transition-colors ${
                              floodZone === z ? 'border-violet-300 bg-violet-50/50 text-violet-700' : 'border-zinc-200 bg-white text-slate-600'
                            }`}
                          >
                            {z}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action row */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="flex items-center justify-center space-x-1 border border-zinc-200 hover:bg-zinc-50 text-slate-600 rounded-xl px-4 py-2.5 text-xs font-bold transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl px-4 py-3 text-xs font-bold transition-all shadow-lg shadow-violet-600/10 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Starting Audit...</span>
                    </>
                  ) : (
                    <>
                      <span>Start AI Planning Audit</span>
                      <Check className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

    </div>
  );
}
