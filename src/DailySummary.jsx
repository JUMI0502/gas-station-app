import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function DailySummary({ station }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (!station) return
    setLoading(true)

    Promise.all([
      supabase
        .from('daily_entries')
        .select('*, fuel_types(fuel_name)')
        .eq('station_id', station.id)
        .eq('entry_date', today),
      supabase
        .from('daily_fuel_summary')
        .select('*, fuel_types(fuel_name)')
        .eq('station_id', station.id)
        .eq('entry_date', today),
    ]).then(([nozzleResult, simpleResult]) => {
      setLoading(false)

      if (nozzleResult.error) console.error(nozzleResult.error)
      if (simpleResult.error) console.error(simpleResult.error)

      const totals = {}

      // From nozzle-based entries (e.g. 7 Hills / uncle)
      ;(nozzleResult.data || []).forEach((row) => {
        const fuelName = row.fuel_types.fuel_name
        const liters = row.closing_reading - row.opening_reading
        const revenue = liters * row.rate_per_liter

        if (!totals[fuelName]) totals[fuelName] = { liters: 0, revenue: 0, profit: null }
        totals[fuelName].liters += liters
        totals[fuelName].revenue += revenue
      })

      // From simplified entries (e.g. HP / father) — only used if nozzle data isn't already there for that fuel
      ;(simpleResult.data || []).forEach((row) => {
        const fuelName = row.fuel_types.fuel_name
        const profit = row.liters_sold * row.margin_per_liter

        if (!totals[fuelName]) {
          totals[fuelName] = { liters: row.liters_sold, revenue: null, profit }
        } else {
          totals[fuelName].profit = profit
        }
      })

      setSummary(totals)
    })
  }, [station, today])

  if (loading) {
    return <p className="text-sm text-gray-500">Loading today's summary...</p>
  }

  if (!summary || Object.keys(summary).length === 0) {
    return <p className="text-sm text-gray-500">No sales entered yet today.</p>
  }

  return (
    <div className="space-y-3">
      {Object.entries(summary).map(([fuelName, { liters, revenue, profit }]) => (
        <div key={fuelName} className="bg-gray-50 rounded-xl p-4">
          <p className="text-sm font-medium mb-1">{fuelName}</p>
          <p className="text-lg font-semibold">{liters.toFixed(1)} L</p>
          {revenue !== null && (
            <p className="text-sm text-gray-600">Revenue: ₹{revenue.toFixed(2)}</p>
          )}
          {profit !== null && (
            <p className="text-sm text-gray-600">Profit: ₹{profit.toFixed(2)}</p>
          )}
        </div>
      ))}
    </div>
  )
}

export default DailySummary