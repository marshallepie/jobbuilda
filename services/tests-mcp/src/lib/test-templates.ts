/**
 * BS 7671:2018+A3:2024 Test Templates
 * Provides pre-populated test schedules based on work type and premises
 */

export interface MeasurementTemplate {
  measurementType: string;
  measurementName: string;
  unit: string;
  perCircuit: boolean;
  required: boolean;
}

export interface InspectionItem {
  category: string;
  item: string;
  result?: 'pass' | 'fail' | 'n/a' | 'limitation';
  notes?: string;
}

export interface TestTemplate {
  certificateType: 'eic' | 'minor_works' | 'eicr' | 'pat';
  requiredMeasurements: MeasurementTemplate[];
  inspectionItems: InspectionItem[];
  defaultInspectorName?: string;
  defaultInspectorRegistration?: string;
}

/**
 * Schedule of Inspections for Electrical Installation Certificate (EIC)
 * Based on BS 7671:2018+A3:2024 Appendix 6
 */
const SCHEDULE_OF_INSPECTIONS_EIC: InspectionItem[] = [
  // Part 1: External Condition and Rating of Incoming Supply
  { category: '1. External Condition', item: 'Service cable and terminations', result: undefined },
  { category: '1. External Condition', item: 'Supply earthing arrangements', result: undefined },
  { category: '1. External Condition', item: 'Earthing conductor', result: undefined },
  { category: '1. External Condition', item: 'Main equipotential bonding conductors', result: undefined },

  // Part 2: Parallel or Switched Alternative Sources of Supply
  { category: '2. Alternative Supplies', item: 'Presence of alternative sources', result: undefined },
  { category: '2. Alternative Supplies', item: 'Adequacy of arrangements', result: undefined },

  // Part 3: Distributor Facility
  { category: '3. Distributor Facility', item: 'Type', result: undefined },
  { category: '3. Distributor Facility', item: 'Condition', result: undefined },

  // Part 4: Main Switch or Circuit Breaker
  { category: '4. Main Switch', item: 'Accessibility', result: undefined },
  { category: '4. Main Switch', item: 'Correct identification', result: undefined },
  { category: '4. Main Switch', item: 'Correct rating', result: undefined },
  { category: '4. Main Switch', item: 'Operation', result: undefined },
  { category: '4. Main Switch', item: 'RCD operation (if applicable)', result: undefined },

  // Part 5: Earthing Arrangements
  { category: '5. Earthing', item: 'Main earthing terminal', result: undefined },
  { category: '5. Earthing', item: 'Earthing conductor - material', result: undefined },
  { category: '5. Earthing', item: 'Earthing conductor - CSA', result: undefined },
  { category: '5. Earthing', item: 'Earthing conductor - continuity', result: undefined },
  { category: '5. Earthing', item: 'Main equipotential bonding - water', result: undefined },
  { category: '5. Earthing', item: 'Main equipotential bonding - gas', result: undefined },
  { category: '5. Earthing', item: 'Main equipotential bonding - oil', result: undefined },
  { category: '5. Earthing', item: 'Main equipotential bonding - structural steel', result: undefined },
  { category: '5. Earthing', item: 'Main equipotential bonding - other services', result: undefined },
  { category: '5. Earthing', item: 'Connection of bonding conductors', result: undefined },

  // Part 6: Consumer Unit / Distribution Board
  { category: '6. Consumer Unit', item: 'Type and compliance with standards', result: undefined },
  { category: '6. Consumer Unit', item: 'Correct identification and labelling', result: undefined },
  { category: '6. Consumer Unit', item: 'Condition', result: undefined },
  { category: '6. Consumer Unit', item: 'Suitability for external influences', result: undefined },
  { category: '6. Consumer Unit', item: 'Security of fixing', result: undefined },

  // Part 7: Circuits
  { category: '7. Circuits', item: 'Identification of circuits', result: undefined },
  { category: '7. Circuits', item: 'Adequacy of conductors for current', result: undefined },
  { category: '7. Circuits', item: 'Conductor CSA (cable sizing)', result: undefined },
  { category: '7. Circuits', item: 'Selection and erection to minimize spread of fire', result: undefined },
  { category: '7. Circuits', item: 'Cables routed in prescribed zones', result: undefined },
  { category: '7. Circuits', item: 'Cables adequately supported', result: undefined },
  { category: '7. Circuits', item: 'Protection against mechanical damage', result: undefined },
  { category: '7. Circuits', item: 'RCD protection for cables in walls (≤50mm depth)', result: undefined },
  { category: '7. Circuits', item: 'Cables buried without earthed armour/sheath', result: undefined },
  { category: '7. Circuits', item: 'Connections of conductors', result: undefined },
  { category: '7. Circuits', item: 'Terminations', result: undefined },

  // Part 8: Protective Devices
  { category: '8. Protective Devices', item: 'Type and rating suitable for fault current', result: undefined },
  { category: '8. Protective Devices', item: 'Coordination between protective devices', result: undefined },
  { category: '8. Protective Devices', item: 'Isolating and switching devices', result: undefined },
  { category: '8. Protective Devices', item: 'RCDs rated and installed correctly', result: undefined },
  { category: '8. Protective Devices', item: 'Presence of fire barriers, sealing', result: undefined },

  // Part 9: Current Using Equipment
  { category: '9. Equipment', item: 'Suitability for external influences', result: undefined },
  { category: '9. Equipment', item: 'Correct erection', result: undefined },
  { category: '9. Equipment', item: 'Suitability of accessories', result: undefined },
  { category: '9. Equipment', item: 'Connection of single-pole devices in phase only', result: undefined },
  { category: '9. Equipment', item: 'Presence of undervoltage protection', result: undefined },

  // Part 10: Special Locations
  { category: '10. Special Locations', item: 'Bathroom zones compliance (701)', result: 'n/a' },
  { category: '10. Special Locations', item: 'Swimming pool zones (702)', result: 'n/a' },
  { category: '10. Special Locations', item: 'Hot air saunas (703)', result: 'n/a' },
  { category: '10. Special Locations', item: 'Agricultural/horticultural (705)', result: 'n/a' },
  { category: '10. Special Locations', item: 'Caravan/motor caravan (721)', result: 'n/a' },

  // Part 11: Notices and Labelling
  { category: '11. Notices', item: 'Danger notices posted', result: undefined },
  { category: '11. Notices', item: 'Periodic inspection notice', result: undefined },
  { category: '11. Notices', item: 'RCD quarterly test notice', result: undefined },
  { category: '11. Notices', item: 'Earthing and bonding label', result: undefined },
  { category: '11. Notices', item: 'Voltage and frequency label', result: undefined },
  { category: '11. Notices', item: 'Non-standard color identification', result: undefined },
];

/**
 * Schedule of Inspections for Minor Works Certificate
 * Simplified checklist for minor alterations
 */
const SCHEDULE_OF_INSPECTIONS_MINOR_WORKS: InspectionItem[] = [
  { category: 'Earthing', item: 'Continuity of protective conductors', result: undefined },
  { category: 'Earthing', item: 'Earthing arrangement adequate', result: undefined },
  { category: 'Circuit', item: 'Correct cable size for circuit', result: undefined },
  { category: 'Circuit', item: 'Cable adequately protected from damage', result: undefined },
  { category: 'Circuit', item: 'Cables routed in safe zones', result: undefined },
  { category: 'Circuit', item: 'RCD protection where required', result: undefined },
  { category: 'Protection', item: 'Protective device correct type and rating', result: undefined },
  { category: 'Protection', item: 'Single-pole devices in phase conductor only', result: undefined },
  { category: 'Equipment', item: 'Suitability for location', result: undefined },
  { category: 'Equipment', item: 'Correct erection and terminations', result: undefined },
  { category: 'Notices', item: 'Circuit identification provided', result: undefined },
];

/**
 * Schedule of Inspections for EICR
 * Comprehensive condition assessment per BS 7671
 */
const SCHEDULE_OF_INSPECTIONS_EICR: InspectionItem[] = [
  // Similar to EIC but focused on condition assessment
  { category: '1. External Condition', item: 'Service cable condition', result: undefined },
  { category: '1. External Condition', item: 'Supply earthing condition', result: undefined },
  { category: '1. External Condition', item: 'Earthing conductor condition', result: undefined },
  { category: '1. External Condition', item: 'Main bonding condition', result: undefined },

  { category: '2. Consumer Unit', item: 'Overall condition', result: undefined },
  { category: '2. Consumer Unit', item: 'Suitable for continued service', result: undefined },
  { category: '2. Consumer Unit', item: 'Correct labelling present', result: undefined },
  { category: '2. Consumer Unit', item: 'RCDs operating correctly', result: undefined },

  { category: '3. Circuits', item: 'Conductor condition', result: undefined },
  { category: '3. Circuits', item: 'Adequate support and protection', result: undefined },
  { category: '3. Circuits', item: 'No unauthorized DIY work', result: undefined },
  { category: '3. Circuits', item: 'Socket outlets condition', result: undefined },
  { category: '3. Circuits', item: 'Lighting points condition', result: undefined },

  { category: '4. Bonding', item: 'Supplementary bonding (if required)', result: undefined },
  { category: '4. Bonding', item: 'Bonding connections condition', result: undefined },

  { category: '5. Observations', item: 'C1 - Danger present', result: undefined },
  { category: '5. Observations', item: 'C2 - Potentially dangerous', result: undefined },
  { category: '5. Observations', item: 'C3 - Improvement recommended', result: undefined },
  { category: '5. Observations', item: 'FI - Further investigation required', result: undefined },
];

/**
 * Required measurements for Electrical Installation Certificate (EIC)
 */
const MEASUREMENTS_EIC: MeasurementTemplate[] = [
  {
    measurementType: 'continuity',
    measurementName: 'Continuity of protective conductors (R1+R2)',
    unit: 'Ω',
    perCircuit: true,
    required: true
  },
  {
    measurementType: 'insulation',
    measurementName: 'Insulation resistance (Line-Earth)',
    unit: 'MΩ',
    perCircuit: true,
    required: true
  },
  {
    measurementType: 'insulation',
    measurementName: 'Insulation resistance (Line-Neutral)',
    unit: 'MΩ',
    perCircuit: true,
    required: true
  },
  {
    measurementType: 'insulation',
    measurementName: 'Insulation resistance (Neutral-Earth)',
    unit: 'MΩ',
    perCircuit: true,
    required: true
  },
  {
    measurementType: 'earth_loop',
    measurementName: 'Earth fault loop impedance (Zs)',
    unit: 'Ω',
    perCircuit: true,
    required: true
  },
  {
    measurementType: 'polarity',
    measurementName: 'Polarity check',
    unit: 'pass/fail',
    perCircuit: true,
    required: true
  },
  {
    measurementType: 'rcd_trip_time',
    measurementName: 'RCD trip time at 1x (30mA)',
    unit: 'ms',
    perCircuit: false,
    required: false
  },
  {
    measurementType: 'rcd_trip_time',
    measurementName: 'RCD trip time at 5x (150mA)',
    unit: 'ms',
    perCircuit: false,
    required: false
  },
  {
    measurementType: 'voltage',
    measurementName: 'Supply voltage',
    unit: 'V',
    perCircuit: false,
    required: true
  },
  {
    measurementType: 'functional',
    measurementName: 'Functional test of switchgear',
    unit: 'pass/fail',
    perCircuit: false,
    required: true
  }
];

/**
 * Required measurements for Minor Works Certificate
 */
const MEASUREMENTS_MINOR_WORKS: MeasurementTemplate[] = [
  {
    measurementType: 'continuity',
    measurementName: 'Continuity of protective conductors (R1+R2)',
    unit: 'Ω',
    perCircuit: true,
    required: true
  },
  {
    measurementType: 'insulation',
    measurementName: 'Insulation resistance',
    unit: 'MΩ',
    perCircuit: true,
    required: true
  },
  {
    measurementType: 'polarity',
    measurementName: 'Polarity check',
    unit: 'pass/fail',
    perCircuit: true,
    required: true
  },
  {
    measurementType: 'earth_loop',
    measurementName: 'Earth fault loop impedance (Zs)',
    unit: 'Ω',
    perCircuit: true,
    required: true
  },
  {
    measurementType: 'rcd_trip_time',
    measurementName: 'RCD trip time (if installed)',
    unit: 'ms',
    perCircuit: false,
    required: false
  }
];

/**
 * Required measurements for EICR
 */
const MEASUREMENTS_EICR: MeasurementTemplate[] = [
  {
    measurementType: 'continuity',
    measurementName: 'Continuity of protective conductors',
    unit: 'Ω',
    perCircuit: true,
    required: true
  },
  {
    measurementType: 'insulation',
    measurementName: 'Insulation resistance',
    unit: 'MΩ',
    perCircuit: true,
    required: true
  },
  {
    measurementType: 'polarity',
    measurementName: 'Polarity',
    unit: 'pass/fail',
    perCircuit: true,
    required: true
  },
  {
    measurementType: 'earth_loop',
    measurementName: 'Earth fault loop impedance (Zs)',
    unit: 'Ω',
    perCircuit: true,
    required: true
  },
  {
    measurementType: 'rcd_trip_time',
    measurementName: 'RCD trip time at 1x',
    unit: 'ms',
    perCircuit: false,
    required: true
  },
  {
    measurementType: 'rcd_trip_time',
    measurementName: 'RCD trip time at 5x',
    unit: 'ms',
    perCircuit: false,
    required: true
  }
];

/**
 * Get test template based on work type and premises type
 */
export function getTestTemplate(
  workType: string,
  premisesType: string = 'domestic'
): TestTemplate {
  if (workType === 'new_circuit') {
    return {
      certificateType: 'eic',
      requiredMeasurements: MEASUREMENTS_EIC,
      inspectionItems: SCHEDULE_OF_INSPECTIONS_EIC
    };
  } else if (workType === 'minor_works') {
    return {
      certificateType: 'minor_works',
      requiredMeasurements: MEASUREMENTS_MINOR_WORKS,
      inspectionItems: SCHEDULE_OF_INSPECTIONS_MINOR_WORKS
    };
  } else if (workType === 'inspection_only') {
    return {
      certificateType: 'eicr',
      requiredMeasurements: MEASUREMENTS_EICR,
      inspectionItems: SCHEDULE_OF_INSPECTIONS_EICR
    };
  } else {
    // Default to EIC for unknown work types
    return {
      certificateType: 'eic',
      requiredMeasurements: MEASUREMENTS_EIC,
      inspectionItems: SCHEDULE_OF_INSPECTIONS_EIC
    };
  }
}

/**
 * Get certificate type from work type
 */
export function getCertificateType(workType: string): 'eic' | 'minor_works' | 'eicr' {
  if (workType === 'new_circuit') return 'eic';
  if (workType === 'minor_works') return 'minor_works';
  if (workType === 'inspection_only') return 'eicr';
  return 'eic'; // default
}
