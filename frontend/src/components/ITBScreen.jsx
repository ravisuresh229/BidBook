import { useMemo, useState, useEffect } from 'react';
import { Wifi } from 'lucide-react';
import { calculateConfidence, formatPhone } from '../utils/confidence';

export default function ITBScreen({ proposals, onReset }) {
  const [selectedSubcontractors, setSelectedSubcontractors] = useState(new Set());
  const [collapsedSections, setCollapsedSections] = useState(new Set());
  const [highlightedRows, setHighlightedRows] = useState(new Set()); // Rows with missing email to highlight
  const [invitedRows, setInvitedRows] = useState(new Set()); // Rows that have been invited
  const [toast, setToast] = useState(null); // Toast notification state
  const [editedEmails, setEditedEmails] = useState({}); // Track edited emails by index
  
  // Group proposals by master_format_division (normalized trade field)
  const groupedByDivision = useMemo(() => {
    const groups = {};
    
    proposals.forEach((proposal, index) => {
      // Use the normalized trade field as master_format_division
      const division = proposal.trade?.value || 'Uncategorized';
      if (!groups[division]) {
        groups[division] = [];
      }
      groups[division].push({ ...proposal, _index: index });
    });
    
    return groups;
  }, [proposals]);

  const totalSubcontractors = proposals.length;
  const selectedCount = selectedSubcontractors.size;

  // Initialize all selected by default
  useEffect(() => {
    const allIndices = new Set(proposals.map((_, index) => index));
    setSelectedSubcontractors(allIndices);
  }, [proposals]);

  const toggleSelection = (index) => {
    setSelectedSubcontractors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleDivisionSelection = (division) => {
    const divisionProposals = groupedByDivision[division] || [];
    const divisionIndices = divisionProposals.map(p => p._index);
    const allSelected = divisionIndices.every(idx => selectedSubcontractors.has(idx));
    
    setSelectedSubcontractors(prev => {
      const newSet = new Set(prev);
      if (allSelected) {
        divisionIndices.forEach(idx => newSet.delete(idx));
      } else {
        divisionIndices.forEach(idx => newSet.add(idx));
      }
      return newSet;
    });
  };

  const toggleSectionCollapse = (division) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(division)) {
        newSet.delete(division);
      } else {
        newSet.add(division);
      }
      return newSet;
    });
  };

  const handleEmailChange = (index, value) => {
    setEditedEmails(prev => ({
      ...prev,
      [index]: value
    }));
    
    // Remove from highlighted rows if email is now valid
    if (value && value.trim() !== '') {
      setHighlightedRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  };

  // Calculate counts for button text
  const selectedWithEmail = useMemo(() => {
    return Array.from(selectedSubcontractors).filter(idx => {
      const email = editedEmails[idx] || proposals[idx]?.email?.value;
      return email && email.trim() !== '';
    }).length;
  }, [selectedSubcontractors, editedEmails, proposals]);

  const selectedWithoutEmail = useMemo(() => {
    return selectedCount - selectedWithEmail;
  }, [selectedCount, selectedWithEmail]);

  const handleSendInvitations = () => {
    // Get all selected proposals with their data
    const selectedProposals = Array.from(selectedSubcontractors).map(idx => {
      const proposal = proposals[idx];
      // Use edited email if available, otherwise use original
      const email = editedEmails[idx] || proposal.email?.value;
      return {
        index: idx,
        company_name: proposal.company_name?.value,
        contact_name: proposal.contact_name?.value,
        email: email,
        phone: proposal.phone?.value,
        trade: proposal.trade?.value
      };
    });

    // Filter into ready-to-send (with email) and missing-info (without email)
    const readyToSend = selectedProposals.filter(p => p.email && p.email.trim() !== '');
    const missingInfo = selectedProposals.filter(p => !p.email || p.email.trim() === '');

    // Action 1: Handle ready-to-send
    if (readyToSend.length > 0) {
      const companyNames = readyToSend.map(p => p.company_name || 'Unknown').slice(0, 3);
      const moreCount = readyToSend.length > 3 ? ` and ${readyToSend.length - 3} more` : '';
      
      // Mark as invited
      setInvitedRows(prev => {
        const newSet = new Set(prev);
        readyToSend.forEach(p => newSet.add(p.index));
        return newSet;
      });

      // Show success toast
      setToast({
        type: 'success',
        message: `Invites sent to ${readyToSend.length} subcontractor${readyToSend.length !== 1 ? 's' : ''} (${companyNames.join(', ')}${moreCount}).`
      });

      // Auto-dismiss after 5 seconds
      setTimeout(() => setToast(null), 5000);
    }

    // Action 2: Handle missing info
    if (missingInfo.length > 0) {
      const companyNames = missingInfo.map(p => p.company_name || 'Unknown');
      
      // Highlight missing email rows in red
      setHighlightedRows(prev => {
        const newSet = new Set(prev);
        missingInfo.forEach(p => newSet.add(p.index));
        return newSet;
      });

      // Show warning toast
      setToast({
        type: 'warning',
        message: `Could not invite ${missingInfo.length} subcontractor${missingInfo.length !== 1 ? 's' : ''} (${companyNames.join(', ')}). Missing email addresses.`
      });

      // Auto-dismiss after 7 seconds
      setTimeout(() => setToast(null), 7000);

      // Generate call list for missing contacts
      const callList = missingInfo
        .filter(p => p.phone)
        .map(p => `${p.company_name} (Phone: ${p.phone})`)
        .join(', ');
      
      if (callList) {
        console.log('Generated Call List for:', callList);
      }
    }
  };

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

  const getDivisionIcon = (division) => {
    const divisionLower = division.toLowerCase();
    if (divisionLower.includes('communications') || divisionLower.includes('low voltage')) {
      return <Wifi className="w-5 h-5" />;
    } else if (divisionLower.includes('electrical') || divisionLower.includes('electric')) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    } else if (divisionLower.includes('plumb')) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    } else if (divisionLower.includes('concrete')) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      );
    } else if (divisionLower.includes('earthwork') || divisionLower.includes('sitework')) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    } else if (divisionLower.includes('hvac')) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    // Default icon
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    );
  };

  if (proposals.length === 0) {
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
          <p className="mt-4 text-slate-500 font-medium">No proposals to display.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Bid Leveling Dashboard</h1>
          <p className="text-slate-600">
            {totalSubcontractors} subcontractor{totalSubcontractors !== 1 ? 's' : ''} across {Object.keys(groupedByDivision).length} division{Object.keys(groupedByDivision).length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleSendInvitations}
            disabled={selectedCount === 0}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>Send Invitations</span>
            {selectedWithEmail > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-blue-700 rounded-full text-xs font-semibold">
                {selectedWithEmail}
              </span>
            )}
          </button>
          {selectedWithoutEmail > 0 && (
            <span className="text-xs text-amber-600 font-medium">
              {selectedWithoutEmail} selected without email
            </span>
          )}
        </div>
      </div>

      {/* Division Groups */}
      <div className="space-y-4">
        {Object.entries(groupedByDivision)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([division, divisionProposals]) => {
            const divisionIndices = divisionProposals.map(p => p._index);
            const allSelected = divisionIndices.every(idx => selectedSubcontractors.has(idx));
            const someSelected = divisionIndices.some(idx => selectedSubcontractors.has(idx));
            const isCollapsed = collapsedSections.has(division);
            
            return (
              <div key={division} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                {/* Division Header - Gray Background */}
                <div className="bg-slate-50 border-b border-slate-200">
                  <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <button
                        onClick={() => toggleSectionCollapse(division)}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <svg 
                          className={`w-5 h-5 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600">
                          {getDivisionIcon(division)}
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-slate-900">{division}</h2>
                          <p className="text-sm text-slate-600">
                            {divisionProposals.length} subcontractor{divisionProposals.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => toggleDivisionSelection(division)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                      {someSelected && !allSelected && (
                        <span className="text-xs text-slate-500">
                          {divisionIndices.filter(idx => selectedSubcontractors.has(idx)).length} selected
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subcontractor Rows - White Background */}
                {!isCollapsed && (
                  <div className="divide-y divide-slate-100">
                    {divisionProposals.map((proposal) => {
                      const isSelected = selectedSubcontractors.has(proposal._index);
                      const isHighlighted = highlightedRows.has(proposal._index);
                      const isInvited = invitedRows.has(proposal._index);
                      const currentEmail = editedEmails[proposal._index] || proposal.email?.value || '';
                      const hasEmail = currentEmail && currentEmail.trim() !== '';
                      
                      return (
                        <div
                          key={proposal._index}
                          className={`px-6 py-4 hover:bg-slate-50 transition-colors ${
                            isSelected ? 'bg-blue-50/50' : 'bg-white'
                          } ${isHighlighted ? 'ring-2 ring-red-300 bg-red-50/30' : ''}`}
                        >
                          <div className="flex items-center gap-4">
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelection(proposal._index)}
                              className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                            />
                            
                            {/* Company & Contact Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1">
                                <h3 className="text-base font-semibold text-slate-900 truncate">
                                  {proposal.company_name?.value || 'Unnamed Company'}
                                </h3>
                                {getConfidenceBadge(proposal)}
                                {isInvited && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Invited
                                  </span>
                                )}
                              </div>
                              {proposal.contact_name?.value && (
                                <p className="text-sm text-slate-600 truncate">
                                  {proposal.contact_name.value}
                                </p>
                              )}
                            </div>

                            {/* Contact Details */}
                            <div className="hidden md:flex items-center gap-6 text-sm">
                              {/* Email - Show input if missing or highlighted, otherwise show display */}
                              {hasEmail && !isHighlighted ? (
                                <div className="flex items-center gap-1.5 text-slate-600">
                                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  <span className="truncate max-w-[200px]">{currentEmail}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 min-w-[200px]">
                                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  <input
                                    type="email"
                                    value={currentEmail}
                                    onChange={(e) => handleEmailChange(proposal._index, e.target.value)}
                                    placeholder="Enter email address"
                                    className={`px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                      isHighlighted 
                                        ? 'border-red-400 bg-red-50 focus:ring-red-500 focus:border-red-500 animate-pulse' 
                                        : 'border-slate-300 bg-white focus:border-blue-500'
                                    }`}
                                  />
                                </div>
                              )}
                              {proposal.phone?.value && (
                                <div className="flex items-center gap-1.5 text-slate-600">
                                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  <span>{formatPhone(proposal.phone.value)}</span>
                                </div>
                              )}
                              {!proposal.phone?.value && (
                                <div className="text-xs text-slate-400 italic">
                                  No Phone
                                </div>
                              )}
                              {proposal.website?.value && (
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                  </svg>
                                  <a
                                    href={proposal.website.value.startsWith('http') ? proposal.website.value : `https://${proposal.website.value}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:text-blue-700 hover:underline truncate max-w-[150px]"
                                  >
                                    {proposal.website.value}
                                  </a>
                                </div>
                              )}
                            </div>

                            {/* Mobile View - Email Input & Contact Info */}
                            <div className="md:hidden flex flex-col gap-2 w-full mt-2">
                              {hasEmail && !isHighlighted ? (
                                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  <span className="truncate">{currentEmail}</span>
                                </div>
                              ) : (
                                <input
                                  type="email"
                                  value={currentEmail}
                                  onChange={(e) => handleEmailChange(proposal._index, e.target.value)}
                                  placeholder="Enter email address"
                                  className={`w-full px-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    isHighlighted 
                                      ? 'border-red-400 bg-red-50 focus:ring-red-500 focus:border-red-500 animate-pulse' 
                                      : 'border-slate-300 bg-white focus:border-blue-500'
                                  }`}
                                />
                              )}
                              {proposal.phone?.value && (
                                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  <span>{formatPhone(proposal.phone.value)}</span>
                                </div>
                              )}
                              {proposal.website?.value && (
                                <div className="flex items-center gap-1.5 text-sm">
                                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                  </svg>
                                  <a
                                    href={proposal.website.value.startsWith('http') ? proposal.website.value : `https://${proposal.website.value}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-700 hover:underline"
                                  >
                                    {proposal.website.value}
                                  </a>
                                </div>
                              )}
                              <div className="text-xs text-slate-400">
                                {proposal.source_file}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Footer Actions */}
      <div className="mt-8 flex items-center justify-between pt-6 border-t border-slate-200">
        <div className="text-sm text-slate-600">
          {selectedCount} of {totalSubcontractors} subcontractor{totalSubcontractors !== 1 ? 's' : ''} selected
        </div>
        <button
          onClick={onReset}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
        >
          Start Over
        </button>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div
            className={`px-6 py-4 rounded-lg shadow-lg border-2 flex items-center gap-3 min-w-[400px] max-w-[600px] ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {toast.type === 'success' ? (
              <svg className="w-6 h-6 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
