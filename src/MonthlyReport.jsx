import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function MonthlyReport({ station }) {
  const [loading, setLoading] = useState(true)
  const [fuelTotals, setFuelTotals] = useState({})
  const [expenseTotals, setExpenseTotals] = useState({})
  const [stockTotals, setStockTotals] = useState({})
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)) // "YYYY-MM"

  useEffect(() => {
    if (!station) return
    setLoading(true)

    const startDate = `${month}-01`
    const endDate = new Date(
      new Date(startDate).getFullYear(),
      new Date(startDate).getMonth() + 1,
      0
    ).toISOString().split('T')[0]

    Promise.all([
      supabase
        .from('daily_entries')
        .select('*, fuel_types(fuel_name)')
        .eq('station_id', station.id)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate),
      supabase
        .from('daily_fuel_summary')
        .select('*, fuel_types(fuel_name)')
        .eq('station_id', station.id)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate),
      supabase
        .from('expenses')
        .select('*')
        .eq('station_id', station.id)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate),
      supabase
        .from('stock_entries')
        .select('*, fuel_types(fuel_name)')
        .eq('station_id', station.id)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate),
    ]).then(([nozzleResult, simpleResult, expenseResult, stockResult]) => {
      setLoading(false)

      const fuels = {}

      ;(nozzleResult.data || []).forEach((row) => {
        const name = row.fuel_types.fuel_name
        const liters = row.closing_reading - row.opening_reading
        const revenue = liters * row.rate_per_liter
        if (!fuels[name]) fuels[name] = { liters: 0, revenue: 0, profit: 0 }
        fuels[name].liters += liters
        fuels[name].revenue += revenue
      })

      ;(simpleResult.data || []).forEach((row) => {
        const name = row.fuel_types.fuel_name
        const profit = row.liters_sold * row.margin_per_liter
        if (!fuels[name]) fuels[name] = { liters: 0, revenue: 0, profit: 0 }
        fuels[name].liters += row.liters_sold
        fuels[name].profit += profit
      })

      setFuelTotals(fuels)

      const expenseCats = {}
      let expenseTotal = 0
      ;(expenseResult.data || []).forEach((row) => {
        expenseCats[row.category] = (expenseCats[row.category] || 0) + row.amount
        expenseTotal += row.amount
      })
      setExpenseTotals({ byCategory: expenseCats, total: expenseTotal })

      const stock = {}
      ;(stockResult.data || []).forEach((row) => {
        const name = row.fuel_types.fuel_name
        if (!stock[name]) stock[name] = { delivered: 0, deliveries: 0 }
        stock[name].delivered += row.delivery_liters || 0
        if (row.delivery_liters > 0) stock[name].deliveries += 1
      })
      setStockTotals(stock)
    })
  }, [station, month])

  const totalRevenue = Object.values(fuelTotals).reduce((s, f) => s + f.revenue, 0)
  const totalProfitFromMargin = Object.values(fuelTotals).reduce((s, f) => s + f.profit, 0)
  const netProfit = totalRevenue > 0
    ? totalRevenue - (expenseTotals.total || 0)
    : totalProfitFromMargin - (expenseTotals.total || 0)

  const categoryLabels = {
    staff_salary: 'Staff salary',
    electricity: 'Electricity',
    maintenance: 'Maintenance',
    transport: 'Transport',
    other: 'Other',
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading monthly report...</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm font-medium">Monthly report</p>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border rounded-lg px-2 py-1 text-sm"
        />
      </div>

      <div className="bg-green-50 rounded-xl p-4">
        <p className="text-xs text-green-700">Net profit this month</p>
        <p className="text-2xl font-semibold text-green-700">₹{netProfit.toFixed(2)}</p>
      </div>

      {Object.keys(fuelTotals).length === 0 ? (
        <p className="text-sm text-gray-500">No sales recorded this month.</p>
      ) : (
        Object.entries(fuelTotals).map(([name, { liters, revenue, profit }]) => (
          <div key={name} className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm font-medium mb-1">{name}</p>
            <p className="text-lg font-semibold">{liters.toFixed(1)} L</p>
            {revenue > 0 && <p className="text-sm text-gray-600">Revenue: ₹{revenue.toFixed(2)}</p>}
            {profit > 0 && <p className="text-sm text-gray-600">Profit: ₹{profit.toFixed(2)}</p>}
          </div>
        ))
      )}

      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium">Expenses</p>
          <span className="text-sm text-gray-600">₹{(expenseTotals.total || 0).toFixed(2)} total</span>
        </div>
        {expenseTotals.byCategory && Object.keys(expenseTotals.byCategory).length > 0 ? (
          <div className="bg-gray-50 rounded-xl divide-y">
            {Object.entries(expenseTotals.byCategory).map(([cat, amount]) => (
              <div key={cat} className="flex justify-between px-4 py-2 text-sm">
                <span className="text-gray-600">{categoryLabels[cat] || cat}</span>
                <span>₹{amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No expenses recorded this month.</p>
        )}
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Stock loaded this month</p>
        {Object.keys(stockTotals).length === 0 ? (
          <p className="text-sm text-gray-500">No deliveries recorded this month.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(stockTotals).map(([name, { delivered, deliveries }]) => (
              <div key={name} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">{name}</p>
                <p className="text-sm font-semibold">{delivered.toFixed(0)} L</p>
                <p className="text-xs text-gray-500">{deliveries} deliveries</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MonthlyReport