// ─── Types ────────────────────────────────────────────────────────────────────

// Segment is now defined in @/lib/segments — imported for use within this file and re-exported
import type { Segment } from '@/lib/segments'
export type { Segment }
export { SEGMENT_META } from '@/lib/segments'

export type TxType  = 'earn' | 'redeem' | 'adjust' | 'expire'

export interface Branch {
  id: string; name: string; location: string; color: string; accent: string
}

export interface Customer {
  id: string; name: string; phone: string; lineId: string | null
  birthday: string | null; notes: string | null
  points: number; spending: number; visits: number
  segment: string; branchId: string; lastVisit: string; joinedAt: string
}

export interface MenuItem { name: string; qty: number; price: number }

export interface Purchase {
  id: string; customerId: string; branchId: string
  date: string; amount: number; items: MenuItem[]
  pointsEarned: number; staffNote: string | null
}

export interface PointsTx {
  id: string; customerId: string; branchId: string
  purchaseId: string | null; type: TxType
  points: number; balanceAfter: number; note: string; date: string
}

export interface MonthlyStat { month: string; bakery: number; brunch: number; cafe: number }

// ─── Branches ─────────────────────────────────────────────────────────────────

export const BRANCHES: Branch[] = [
  { id: 'b1', name: 'Namwan bakehouse (Meungthong HQ)',                      location: 'Muengthongthani, Nonthaburi',           color: '#FF2B00', accent: '#FFF3EF' },
  { id: 'b2', name: 'Namwan bakehouse (Bang khae-Petch kasem)',               location: 'Bang Khae, Petchkasem Road, Bangkok',  color: '#D42300', accent: '#FFE4DA' },
  { id: 'b3', name: 'NamwanBake Before Brunch (Kanchanapisek - Suan phak)', location: 'Kanchanapisek Road, Suan Phak, Bangkok', color: '#A81C00', accent: '#FFBFAA' },
]

// ─── Customers ────────────────────────────────────────────────────────────────

export const CUSTOMERS: Customer[] = [
  { id:'c01', name:'Somchai Jaidee',   phone:'081-234-5678', lineId:'line_somchai',  birthday:'1990-03-15',
    notes:'Nut allergy, prefers sourdough', points:540, spending:18500, visits:42, segment:'vip',
    branchId:'b1', lastVisit:'2025-05-06', joinedAt:'2023-01-12' },
  { id:'c02', name:'Malee Srisuwan',   phone:'082-345-6789', lineId:'line_malee',    birthday:'1988-07-22',
    notes:'Regular brunch table for 2',     points:104, spending:5200,  visits:18, segment:'returning',
    branchId:'b2', lastVisit:'2025-04-30', joinedAt:'2023-06-05' },
  { id:'c03', name:'Preecha Tongsuk',  phone:'083-456-7890', lineId:null,            birthday:'1995-11-05',
    notes:null,                             points:16,  spending:420,   visits:2,  segment:'new',
    branchId:'b3', lastVisit:'2025-05-07', joinedAt:'2025-04-20' },
  { id:'c04', name:'Naphat Wongwai',   phone:'084-567-8901', lineId:'line_naphat',   birthday:'1992-01-30',
    notes:'Interested in loyalty card',     points:0,   spending:3100,  visits:9,  segment:'inactive',
    branchId:'b1', lastVisit:'2025-01-05', joinedAt:'2023-11-08' },
  { id:'c05', name:'Usa Pattana',      phone:'085-678-9012', lineId:null,            birthday:'1985-05-18',
    notes:'Corporate billing - TechCo Ltd', points:312, spending:12800, visits:31, segment:'vip',
    branchId:'b1', lastVisit:'2025-05-04', joinedAt:'2022-09-14' },
  { id:'c06', name:'Wanida Khampha',   phone:'086-789-0123', lineId:'line_wanida',   birthday:'1993-09-10',
    notes:null,                             points:188, spending:6700,  visits:22, segment:'returning',
    branchId:'b2', lastVisit:'2025-04-26', joinedAt:'2023-03-17' },
  { id:'c07', name:'Anan Buranasiri',  phone:'087-890-1234', lineId:null,            birthday:'1998-12-25',
    notes:null,                             points:7,   spending:180,   visits:1,  segment:'new',
    branchId:'b3', lastVisit:'2025-05-05', joinedAt:'2025-04-28' },
  { id:'c08', name:'Siriporn Narkpet', phone:'088-901-2345', lineId:'line_siriporn', birthday:'1987-04-14',
    notes:'Birthday promo sent',            points:0,   spending:1800,  visits:6,  segment:'inactive',
    branchId:'b2', lastVisit:'2024-11-20', joinedAt:'2024-01-03' },
  { id:'c09', name:'Kritsana Chaikul', phone:'089-012-3456', lineId:'line_kritsana', birthday:'1991-08-08',
    notes:'Top spender, personal menu req', points:780, spending:22000, visits:58, segment:'vip',
    branchId:'b2', lastVisit:'2025-05-07', joinedAt:'2022-05-21' },
  { id:'c10', name:'Panida Sakulrat',  phone:'080-123-4567', lineId:null,            birthday:'1996-02-28',
    notes:null,                             points:88,  spending:4300,  visits:14, segment:'returning',
    branchId:'b3', lastVisit:'2025-04-18', joinedAt:'2023-08-30' },
  { id:'c11', name:'Thana Pimchan',    phone:'081-111-2222', lineId:'line_thana',    birthday:'1989-06-03',
    notes:'Vegan preferences',              points:224, spending:8100,  visits:26, segment:'returning',
    branchId:'b1', lastVisit:'2025-05-01', joinedAt:'2022-12-10' },
  { id:'c12', name:'Oraluck Chaiyot',  phone:'082-222-3333', lineId:null,            birthday:'1994-10-17',
    notes:null,                             points:456, spending:15600, visits:38, segment:'vip',
    branchId:'b3', lastVisit:'2025-05-06', joinedAt:'2022-07-08' },
]

// ─── Purchases ────────────────────────────────────────────────────────────────

export const PURCHASES: Purchase[] = [
  { id:'p01', customerId:'c01', branchId:'b1', date:'2025-05-06T10:30:00',
    amount:1050, pointsEarned:42, staffNote:'Weekly sourdough order',
    items:[{name:'Sourdough Loaf',qty:2,price:380},{name:'Croissant',qty:2,price:90},{name:'Latte',qty:1,price:110}] },
  { id:'p02', customerId:'c09', branchId:'b2', date:'2025-05-07T09:15:00',
    amount:1560, pointsEarned:62, staffNote:'Group of 4',
    items:[{name:'Full Breakfast Set',qty:4,price:390}] },
  { id:'p03', customerId:'c05', branchId:'b1', date:'2025-05-04T14:00:00',
    amount:2400, pointsEarned:96, staffNote:'Corporate event cake',
    items:[{name:'Celebration Cake',qty:1,price:1800},{name:'Macaron Box',qty:3,price:200}] },
  { id:'p04', customerId:'c12', branchId:'b3', date:'2025-05-06T11:45:00',
    amount:720, pointsEarned:28, staffNote:null,
    items:[{name:'Flat White',qty:2,price:130},{name:'Banana Bread',qty:2,price:110},{name:'Cheesecake Slice',qty:1,price:180}] },
  { id:'p05', customerId:'c02', branchId:'b2', date:'2025-04-30T10:00:00',
    amount:890, pointsEarned:35, staffNote:'Table 4',
    items:[{name:'Eggs Benedict',qty:2,price:320},{name:'Fresh Juice',qty:2,price:125}] },
  { id:'p06', customerId:'c11', branchId:'b1', date:'2025-05-01T08:30:00',
    amount:580, pointsEarned:23, staffNote:null,
    items:[{name:'Pain au Chocolat',qty:3,price:95},{name:'Almond Milk Latte',qty:2,price:125},{name:'Granola Bowl',qty:1,price:165}] },
  { id:'p07', customerId:'c03', branchId:'b3', date:'2025-05-07T15:20:00',
    amount:420, pointsEarned:16, staffNote:null,
    items:[{name:'Cappuccino',qty:2,price:120},{name:'Avocado Toast',qty:1,price:180}] },
  { id:'p08', customerId:'c06', branchId:'b2', date:'2025-04-26T12:10:00',
    amount:760, pointsEarned:30, staffNote:null,
    items:[{name:'Brunch Platter',qty:2,price:380}] },
  { id:'p09', customerId:'c10', branchId:'b3', date:'2025-04-18T10:50:00',
    amount:440, pointsEarned:17, staffNote:null,
    items:[{name:'Iced Matcha Latte',qty:2,price:140},{name:'Mango Tart',qty:1,price:160}] },
  { id:'p10', customerId:'c01', branchId:'b3', date:'2025-04-22T16:00:00',
    amount:680, pointsEarned:27, staffNote:null,
    items:[{name:'Flat White',qty:2,price:130},{name:'Banana Bread',qty:1,price:110},{name:'Cheesecake',qty:1,price:180}] },
]

// ─── Points Transactions ──────────────────────────────────────────────────────

export const POINTS_TXS: PointsTx[] = [
  { id:'pt01',customerId:'c01',branchId:'b1',purchaseId:'p01',type:'earn',  points:42, balanceAfter:540, note:'Purchase earn',           date:'2025-05-06T10:30:00' },
  { id:'pt02',customerId:'c09',branchId:'b2',purchaseId:'p02',type:'earn',  points:62, balanceAfter:780, note:'Purchase earn',           date:'2025-05-07T09:15:00' },
  { id:'pt03',customerId:'c01',branchId:'b1',purchaseId:null, type:'redeem',points:-100,balanceAfter:440,note:'Redeemed: 1 free coffee', date:'2025-04-15T11:00:00' },
  { id:'pt04',customerId:'c09',branchId:'b2',purchaseId:null, type:'adjust',points:50, balanceAfter:718, note:'Birthday bonus',          date:'2025-04-08T00:00:00' },
  { id:'pt05',customerId:'c04',branchId:'b1',purchaseId:null, type:'expire',points:-84,balanceAfter:0,  note:'Expired after 180 days',  date:'2025-03-01T00:00:00' },
  { id:'pt06',customerId:'c05',branchId:'b1',purchaseId:'p03',type:'earn',  points:96, balanceAfter:312, note:'Purchase earn',           date:'2025-05-04T14:00:00' },
  { id:'pt07',customerId:'c12',branchId:'b3',purchaseId:'p04',type:'earn',  points:28, balanceAfter:456, note:'Purchase earn',           date:'2025-05-06T11:45:00' },
  { id:'pt08',customerId:'c02',branchId:'b2',purchaseId:'p05',type:'earn',  points:35, balanceAfter:104, note:'Purchase earn',           date:'2025-04-30T10:00:00' },
]

// ─── Monthly Sales (last 6 months) ────────────────────────────────────────────

export const MONTHLY_SALES: MonthlyStat[] = [
  { month:'Dec', bakery:82000,  brunch:61000,  cafe:44000  },
  { month:'Jan', bakery:95000,  brunch:72000,  cafe:51000  },
  { month:'Feb', bakery:88000,  brunch:68000,  cafe:57000  },
  { month:'Mar', bakery:110000, brunch:79000,  cafe:63000  },
  { month:'Apr', bakery:124000, brunch:91000,  cafe:71000  },
  { month:'May', bakery:98000,  brunch:74000,  cafe:58000  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const TX_META: Record<TxType, { label: string; color: string; bg: string }> = {
  earn:   { label:'Earn',   color:'text-green-700', bg:'bg-green-50  border border-green-200'  },
  redeem: { label:'Redeem', color:'text-blue-700',  bg:'bg-blue-50   border border-blue-200'   },
  adjust: { label:'Adjust', color:'text-amber-700', bg:'bg-amber-50  border border-amber-200'  },
  expire: { label:'Expire', color:'text-red-700',   bg:'bg-red-50    border border-red-200'    },
}

export function fmt(n: number) {
  return new Intl.NumberFormat('th-TH').format(n)
}
export function thb(n: number) {
  return `฿${fmt(n)}`
}
export function pts(n: number) {
  return `${fmt(Math.abs(n))} pts`
}
