/**
 * Unified confidence calculation function (Single Source of Truth)
 * 
 * Logic:
 * - Base = 1.0
 * - Missing Email = -0.5
 * - Missing Phone = -0.1
 * - Missing Contact Name = -0.2
 * 
 * Returns: 'High' (>0.8), 'Medium' (0.5-0.8), 'Low' (<0.5)
 */
export function calculateConfidence(subcontractor) {
  let score = 1.0;
  
  // Missing Email = -0.5
  const hasEmail = subcontractor.email?.value && subcontractor.email.value.trim() !== '';
  if (!hasEmail) {
    score -= 0.5;
  }
  
  // Missing Phone = -0.1
  const hasPhone = subcontractor.phone?.value && subcontractor.phone.value.trim() !== '';
  if (!hasPhone) {
    score -= 0.1;
  }
  
  // Missing Contact Name = -0.2
  const hasContactName = subcontractor.contact_name?.value && subcontractor.contact_name.value.trim() !== '';
  if (!hasContactName) {
    score -= 0.2;
  }
  
  // Clamp score between 0 and 1
  score = Math.max(0, Math.min(1, score));
  
  // Return category
  if (score > 0.8) {
    return 'High';
  } else if (score >= 0.5) {
    return 'Medium';
  } else {
    return 'Low';
  }
}

/**
 * Format phone number to (XXX) XXX-XXXX format
 */
export function formatPhone(phone) {
  if (!phone) return null;
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Format as (XXX) XXX-XXXX if we have 10 digits
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  // If not 10 digits, return original (might be international or formatted differently)
  return phone;
}
