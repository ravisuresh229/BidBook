import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, AlertCircle, Check, Wifi } from 'lucide-react';
import { calculateConfidence, formatPhone } from '../utils/confidence';

export default function ReviewTable({ proposals, extractionMetadata = {}, onConfirm, onBack }) {
  const [editedProposals, setEditedProposals] = useState([]);
  const [selectedProposals, setSelectedProposals] = useState(new Set());
  const [expandedTrades, setExpandedTrades] = useState(new Set());

  useEffect(() => {
    // Initialize edited proposals from props
    setEditedProposals(proposals.map(proposal => ({ ...proposal })));
    // Initialize all selected by default
    setSelectedProposals(new Set(proposals.map((_, index) => index)));
    // Initialize all trades expanded
    const trades = new Set(proposals.map(p => p.trade?.value || 'Uncategorized'));
    setExpandedTrades(trades);
  }, [proposals]);

  // Group proposals by trade (master_format_division)
  const groupedByTrade = useMemo(() => {
    const groups = {};
    editedProposals.forEach((proposal, index) => {
      const trade = proposal.trade?.value || 'Uncategorized';
      if (!groups[trade]) {
        groups[trade] = [];
      }
      groups[trade].push({ ...proposal, _index: index });
    });
    return groups;
  }, [editedProposals]);

  // Unified confidence badge component (using single source of truth)
  const getConfidenceBadge = (proposal) => {
    const confidence = calculateConfidence(proposal);
    
    if (confidence === 'High') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          High
        </span>
      );
    } else if (confidence === 'Medium') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Review
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Missing Data
        </span>
      );
    }
  };

  // Get trade color for border
  const getTradeColor = (trade) => {
    const tradeLower = (trade || '').toLowerCase();
    if (tradeLower.includes('communications') || tradeLower.includes('low voltage')) {
      return 'border-indigo-500';
    } else if (tradeLower.includes('electrical') || tradeLower.includes('electric')) {
      return 'border-blue-500';
    } else if (tradeLower.includes('concrete')) {
      return 'border-gray-500';
    } else if (tradeLower.includes('plumb')) {
      return 'border-cyan-500';
    } else if (tradeLower.includes('earthwork') || tradeLower.includes('sitework')) {
      return 'border-amber-600';
    } else if (tradeLower.includes('hvac')) {
      return 'border-purple-500';
    } else if (tradeLower.includes('general')) {
      return 'border-slate-500';
    }
    return 'border-slate-400';
  };

  const handleFieldChange = (proposalIndex, fieldName, value) => {
    setEditedProposals(prev => {
      const updated = [...prev];
      updated[proposalIndex] = {
        ...updated[proposalIndex],
        [fieldName]: {
          value: value,
          confidence: 'high' // User-verified
        }
      };
      return updated;
    });
  };

  // Trade options for dropdown
  const tradeOptions = [
    'Concrete',
    'Electrical',
    'Plumbing',
    'Earthwork',
    'Communications',
    'HVAC',
    'Roofing',
    'Drywall',
    'Masonry',
    'Steel',
    'Other'
  ];

  const toggleSelection = (index) => {
    setSelectedProposals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleTradeExpansion = (trade) => {
    setExpandedTrades(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trade)) {
        newSet.delete(trade);
      } else {
        newSet.add(trade);
      }
      return newSet;
    });
  };

  const toggleTradeSelection = (trade) => {
    const tradeProposals = groupedByTrade[trade] || [];
    const tradeIndices = tradeProposals.map(p => p._index);
    const allSelected = tradeIndices.every(idx => selectedProposals.has(idx));
    
    setSelectedProposals(prev => {
      const newSet = new Set(prev);
      if (allSelected) {
        tradeIndices.forEach(idx => newSet.delete(idx));
      } else {
        tradeIndices.forEach(idx => newSet.add(idx));
      }
      return newSet;
    });
  };

  const selectedCount = selectedProposals.size;

  if (editedProposals.length === 0) {
    return (
      <div className="w-full max-w-7xl mx-auto px-6 py-8">
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-4 text-slate-500 font-medium">No proposals to review.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-8 pb-24">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Bid Leveling Board</h2>
        <p className="text-slate-600">
          Review and select subcontractors by trade
        </p>
      </div>

      {/* Trade Accordions */}
      <div className="space-y-4">
        {Object.entries(groupedByTrade)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([trade, tradeProposals]) => {
            const isExpanded = expandedTrades.has(trade);
            const tradeIndices = tradeProposals.map(p => p._index);
            const allSelected = tradeIndices.every(idx => selectedProposals.has(idx));
            const tradeColor = getTradeColor(trade);
            
            return (
              <div key={trade} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                {/* Accordion Header */}
                <div 
                  className={`bg-slate-50 border-l-4 ${tradeColor} px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors`}
                  onClick={() => toggleTradeExpansion(trade)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="w-5 h-5 text-slate-600" />
                      </motion.div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{trade}</h3>
                        <p className="text-sm text-slate-600 mt-0.5">
                          {tradeProposals.length} Bid{tradeProposals.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTradeSelection(trade);
                      }}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                </div>

                {/* Accordion Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-slate-100">
                        {tradeProposals.map((proposal) => {
                          const isSelected = selectedProposals.has(proposal._index);
                          const hasEmail = proposal.email?.value && proposal.email.value.trim() !== '';
                          const hasPhone = proposal.phone?.value && proposal.phone.value.trim() !== '';
                          
                          return (
                            <div
                              key={proposal._index}
                              className={`px-6 py-4 hover:bg-slate-50 transition-colors ${
                                isSelected ? 'bg-blue-50/30' : 'bg-white'
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                {/* Checkbox */}
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelection(proposal._index)}
                                  className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                                />

                                {/* Company Name & Contact Name (Editable) */}
                                <div className="flex-1 min-w-0 space-y-1.5">
                                  <input
                                    type="text"
                                    placeholder="Enter company name..."
                                    value={proposal.company_name?.value || ''}
                                    onChange={(e) => handleFieldChange(proposal._index, 'company_name', e.target.value)}
                                    className="w-full px-3 py-1.5 text-base font-bold text-slate-900 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:border-slate-300 transition-colors"
                                  />
                                  <input
                                    type="text"
                                    placeholder="Add contact name..."
                                    value={proposal.contact_name?.value || ''}
                                    onChange={(e) => handleFieldChange(proposal._index, 'contact_name', e.target.value)}
                                    className="w-full px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:border-slate-300 transition-colors"
                                  />
                                </div>

                                {/* Trade Dropdown */}
                                <div className="hidden md:block min-w-[140px]">
                                  <select
                                    value={proposal.trade?.value || ''}
                                    onChange={(e) => handleFieldChange(proposal._index, 'trade', e.target.value)}
                                    className="w-full px-3 py-1.5 text-sm text-slate-700 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:border-slate-300 transition-colors cursor-pointer"
                                  >
                                    <option value="">Select trade...</option>
                                    {tradeOptions.map(trade => (
                                      <option key={trade} value={trade}>{trade}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Email Field (Always Editable with Validation) */}
                                <div className="hidden lg:block min-w-[200px]">
                                  <input
                                    type="email"
                                    placeholder="Enter email..."
                                    value={proposal.email?.value || ''}
                                    onChange={(e) => {
                                      const email = e.target.value;
                                      handleFieldChange(proposal._index, 'email', email);
                                    }}
                                    onBlur={(e) => {
                                      const email = e.target.value.trim();
                                      // Validate on blur - must have @ if not empty
                                      if (email && !email.includes('@')) {
                                        // Reset to previous value if invalid
                                        const prevValue = proposal.email?.value || '';
                                        if (prevValue !== email) {
                                          handleFieldChange(proposal._index, 'email', prevValue);
                                        }
                                      }
                                    }}
                                    className={`w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:border-slate-300 transition-colors ${
                                      hasEmail 
                                        ? 'border-slate-200' 
                                        : 'border-2 border-red-300 bg-red-50/50 animate-pulse'
                                    }`}
                                  />
                                </div>

                                {/* Phone (Editable with Validation) */}
                                <div className="hidden xl:block min-w-[140px]">
                                  <input
                                    type="tel"
                                    placeholder="Enter phone..."
                                    value={proposal.phone?.value || ''}
                                    onChange={(e) => {
                                      const phone = e.target.value;
                                      // Allow typing, but restrict to max 10 digits
                                      const digitsOnly = phone.replace(/\D/g, '');
                                      if (digitsOnly.length <= 10) {
                                        handleFieldChange(proposal._index, 'phone', phone);
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const phone = e.target.value.trim();
                                      // Validate on blur - must have 10 digits if not empty
                                      const digitsOnly = phone.replace(/\D/g, '');
                                      if (phone && digitsOnly.length !== 10) {
                                        // Reset to previous value if invalid
                                        const prevValue = proposal.phone?.value || '';
                                        if (prevValue !== phone) {
                                          handleFieldChange(proposal._index, 'phone', prevValue);
                                        }
                                      }
                                    }}
                                    className="w-full px-3 py-1.5 text-sm text-slate-700 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:border-slate-300 transition-colors"
                                  />
                                </div>

                                {/* Website (clickable link if present, blank if missing) */}
                                <div className="hidden xl:block min-w-[150px]">
                                  {proposal.website?.value && (
                                    <a
                                      href={proposal.website.value.startsWith('http') ? proposal.website.value : `https://${proposal.website.value}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                      </svg>
                                      <span className="truncate max-w-[120px]">{proposal.website.value}</span>
                                    </a>
                                  )}
                                </div>

                                {/* Confidence Score Badge */}
                                <div className="flex-shrink-0">
                                  {getConfidenceBadge(proposal)}
                                </div>
                              </div>

                              {/* Mobile: Show editable fields below */}
                              <div className="md:hidden mt-3 space-y-2 pl-9">
                                {/* Trade Dropdown (Mobile) */}
                                <select
                                  value={proposal.trade?.value || ''}
                                  onChange={(e) => handleFieldChange(proposal._index, 'trade', e.target.value)}
                                  className="w-full px-3 py-1.5 text-sm text-slate-700 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                >
                                  <option value="">Select trade...</option>
                                  {tradeOptions.map(trade => (
                                    <option key={trade} value={trade}>{trade}</option>
                                  ))}
                                </select>
                                
                                {/* Email (Mobile - Always Editable with Validation) */}
                                <input
                                  type="email"
                                  placeholder="Enter email..."
                                  value={proposal.email?.value || ''}
                                  onChange={(e) => {
                                    const email = e.target.value;
                                    // Only allow update if email is empty or contains @
                                    if (!email || email.includes('@')) {
                                      handleFieldChange(proposal._index, 'email', email);
                                    }
                                  }}
                                  className={`w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white ${
                                    hasEmail 
                                      ? 'border-slate-200' 
                                      : 'border-2 border-red-300 bg-red-50/50 animate-pulse'
                                  }`}
                                />
                                
                                {/* Phone (Mobile - Editable with Validation) */}
                                <input
                                  type="tel"
                                  placeholder="Enter phone..."
                                  value={proposal.phone?.value || ''}
                                  onChange={(e) => {
                                    const phone = e.target.value;
                                    // Only allow update if phone is empty or has 10 digits
                                    const digitsOnly = phone.replace(/\D/g, '');
                                    if (!phone || digitsOnly.length <= 10) {
                                      handleFieldChange(proposal._index, 'phone', phone);
                                    }
                                  }}
                                  className="w-full px-3 py-1.5 text-sm text-slate-700 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                />
                                
                                {/* Website (Read-only link) */}
                                {proposal.website?.value && (
                                  <a
                                    href={proposal.website.value.startsWith('http') ? proposal.website.value : `https://${proposal.website.value}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                    </svg>
                                    <span>{proposal.website.value}</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
      </div>

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 shadow-lg z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
              >
                Back
              </button>
              <div className="text-sm font-medium text-slate-700">
                Selected: <span className="font-bold text-slate-900">{selectedCount}</span> Subcontractor{selectedCount !== 1 ? 's' : ''}
              </div>
            </div>
            <button
              onClick={() => {
                const selectedProposalsList = editedProposals.filter((_, index) => selectedProposals.has(index));
                onConfirm(selectedProposalsList);
              }}
              disabled={selectedCount === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 hover:shadow-lg transition-all disabled:bg-slate-300 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              Generate ITB Package
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
