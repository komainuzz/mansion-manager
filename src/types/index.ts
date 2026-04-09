export interface Room {
  id: string
  name: string
  nearest_station: string | null
  address: string | null
  contract_start: string | null
  key_location: string | null
  features: string | null
  current_price: number
  initial_costs: Record<string, number>
  monthly_costs: Record<string, number>
  created_at: string
}

export interface Reservation {
  id: string
  room_id: string
  guest_name: string
  check_in: string
  check_out: string
  room_fee: number
  cleaning_fee: number
  cleaning_cost: number
  checklist: ChecklistItem[]
  memo: string | null
  created_at: string
  room?: Room
}

export interface ChecklistItem {
  label: string
  checked: boolean
}

export interface MonthlySummary {
  yearMonth: string   // "YYYY-MM"
  revenue: number
  costs: number
  profit: number
  occupancyRate: number
  isForecast: boolean
}
