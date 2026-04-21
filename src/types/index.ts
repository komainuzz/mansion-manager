export interface Room {
  id: string
  building_name: string
  room_number: string | null
  postal_code: string | null
  nearest_station: string | null
  nearest_station_transport: string
  nearest_station_minutes: number | null
  address: string | null
  contract_start: string | null
  contract_end: string | null
  management_company: string | null
  management_company_contact: string | null
  key_location: string | null
  mailbox_code: string | null
  has_parking: boolean
  parking_fee: number
  has_wifi: boolean
  wifi_detail: string | null
  electricity: string | null
  water_heater: string | null
  gas: string | null
  water_heater_model: string | null
  features: string | null
  current_price: number
  price_long: number
  price_campaign: number
  utility_electricity_estimate: number
  utility_water_estimate: number
  initial_costs: Record<string, number>
  monthly_costs: Record<string, number>
  created_at: string
}

export interface Reservation {
  id: string
  room_id: string
  guest_name: string
  check_in: string
  check_in_time: string
  check_out: string
  check_out_time: string
  is_extension: boolean
  room_fee: number
  cleaning_fee: number
  cleaning_cost: number
  checklist: ChecklistItem[]
  memo: string | null
  created_at: string
  room?: Room
}

export interface UtilityCost {
  id: string
  room_id: string
  year_month: string
  electricity: number | null
  water: number | null
  memo: string | null
  created_at: string
  updated_at: string
}

export interface ChecklistItem {
  label: string
  checked: boolean
}

export interface Cleaning {
  id: string
  room_id: string
  scheduled_date: string
  start_time: string | null
  end_time: string | null
  memo: string | null
  created_at: string
}

export interface MonthlySummary {
  yearMonth: string
  revenue: number
  fixedCost: number
  utilityCost: number
  cleaningCost: number
  costs: number
  profit: number
  occupiedDays: number
  totalRoomDays: number
  occupancyRate: number
  isForecast: boolean
}
