// All 77 Thai provinces grouped by region.
// Bangkok & Metropolitan listed first so it appears at the top of selectors.
// Within each region, high-priority urban provinces are sorted first.

export interface Region {
  id:        string
  label:     string
  emoji:     string
  provinces: string[]
}

// Provinces that always surface at the top of their region list
const PRIORITY: Set<string> = new Set([
  'Bangkok',
  'Nonthaburi',
  'Pathum Thani',
  'Samut Prakan',
  'Nakhon Pathom',
  'Samut Sakhon',
  'Chonburi',
  'Phuket',
  'Chiang Mai',
])

function sorted(provinces: string[]): string[] {
  return [
    ...provinces.filter(p => PRIORITY.has(p)),
    ...provinces.filter(p => !PRIORITY.has(p)).sort((a, b) => a.localeCompare(b, 'th')),
  ]
}

export const REGIONS: Region[] = [
  {
    id:    'bangkok_metro',
    label: 'Bangkok & Metropolitan',
    emoji: '🏙️',
    provinces: sorted([
      'Bangkok',
      'Nonthaburi',
      'Pathum Thani',
      'Samut Prakan',
      'Nakhon Pathom',
      'Samut Sakhon',
    ]),
  },
  {
    id:    'central',
    label: 'Central',
    emoji: '🌾',
    provinces: sorted([
      'Ang Thong',
      'Ayutthaya',
      'Chai Nat',
      'Lop Buri',
      'Nakhon Nayok',
      'Nakhon Sawan',
      'Phichit',
      'Phitsanulok',
      'Saraburi',
      'Sing Buri',
      'Suphan Buri',
      'Uthai Thani',
    ]),
  },
  {
    id:    'eastern',
    label: 'Eastern',
    emoji: '🌊',
    provinces: sorted([
      'Chachoengsao',
      'Chanthaburi',
      'Chonburi',
      'Prachin Buri',
      'Rayong',
      'Sa Kaeo',
      'Trat',
    ]),
  },
  {
    id:    'northern',
    label: 'Northern',
    emoji: '⛰️',
    provinces: sorted([
      'Chiang Mai',
      'Chiang Rai',
      'Kamphaeng Phet',
      'Lampang',
      'Lamphun',
      'Mae Hong Son',
      'Nan',
      'Phayao',
      'Phetchabun',
      'Phrae',
      'Sukhothai',
      'Tak',
      'Uttaradit',
    ]),
  },
  {
    id:    'northeastern',
    label: 'Northeastern',
    emoji: '🌿',
    provinces: sorted([
      'Amnat Charoen',
      'Bueng Kan',
      'Buri Ram',
      'Chaiyaphum',
      'Kalasin',
      'Khon Kaen',
      'Loei',
      'Maha Sarakham',
      'Mukdahan',
      'Nakhon Phanom',
      'Nakhon Ratchasima',
      'Nong Bua Lam Phu',
      'Nong Khai',
      'Roi Et',
      'Sakon Nakhon',
      'Si Sa Ket',
      'Surin',
      'Ubon Ratchathani',
      'Udon Thani',
      'Yasothon',
    ]),
  },
  {
    id:    'western',
    label: 'Western',
    emoji: '🌄',
    provinces: sorted([
      'Kanchanaburi',
      'Phetchaburi',
      'Prachuap Khiri Khan',
      'Ratchaburi',
      'Samut Songkhram',
    ]),
  },
  {
    id:    'southern',
    label: 'Southern',
    emoji: '🏖️',
    provinces: sorted([
      'Chumphon',
      'Krabi',
      'Nakhon Si Thammarat',
      'Narathiwat',
      'Pattani',
      'Phang Nga',
      'Phatthalung',
      'Phuket',
      'Ranong',
      'Satun',
      'Songkhla',
      'Surat Thani',
      'Trang',
      'Yala',
    ]),
  },
  {
    id:        'international',
    label:     'International / Other',
    emoji:     '✈️',
    provinces: ['International', 'Other'],
  },
]

// Flat map of province → region id for reverse lookup
export const PROVINCE_REGION: Record<string, string> = Object.fromEntries(
  REGIONS.flatMap(r => r.provinces.map(p => [p, r.id])),
)

// All provinces flat (for search-across-all future use)
export const ALL_PROVINCES: string[] = REGIONS.flatMap(r => r.provinces)
