import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import StockEntry from './StockEntry'

function FatherEntry({ station, profile }) {
  const [fuelTypes, setFuelTypes] = useState([])
  const [values, setValues] = useState({})
  const [expenses, setExpenses] = useState({ category: 'staff_salary', amount: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (!station) return
    supabase
      .from('fuel_types')
      .select('*')
      .eq('station_id', station.id)
      .then(({ data, error }) => {
        if (error) return console.error(error)
        setFuelTypes(data)

        const defaults = {}
        data.forEach((ft) => {
          defaults[ft.id] = {
            liters: '',
            margin: ft.commission_per_liter?.toString() || '',
          }
        })
        setValues(defaults)
      })
  }, [station])

  const handleChange = (fuelTypeId, field, value) => {
    setValues((prev) => ({
      ...prev,
      [fuelTypeId]: { ...prev[fuelTypeId], [field]: value },
    }))
  }

  const calcProfit = (fuelTypeId) => {
    const v = values[fuelTypeId]
    if (!v || !v.liters || !v.margin) return 0
    return parseFloat(v.liters) * parseFloat(v.margin)
  }

  const totalProfit = fuelTypes.reduce((sum, ft) => sum + calcProfit(ft.id), 0)

  const handleSaveSales = async () => {
    setSaving(true)
    setMessage('')

    const rows = fuelTypes
      .filter((ft) => values[ft.id]?.liters && values[ft.id]?.margin)
      .map((ft) => ({
        station_id: station.id,
        fuel_type_id: ft.id,
        entry_date: today,
        liters_sold: parseFloat(values[ft.id].liters),
        margin_per_liter: parseFloat(values[ft.id].margin),
        entered_by: profile.id,
      }))

    const { error } = await supabase
      .from('daily_fuel_summary')
      .upsert(rows, { onConflict: 'fuel_type_id,entry_date' })

    setSaving(false)

    if (error) {
      console.error(error)
      setMessage('Failed to save sales.')
      return
    }
    setMessage('Sales saved successfully!')
  }

  const handleSaveExpense = async () => {
    if (!expenses.amount) return
    setSaving(true)
    setMessage('')

    const { error } = await supabase.from('expenses').insert({
      station_id: station.id,
      entry_date: today,
      category: expenses.category,
      amount: parseFloat(expenses.amount),
      notes: expenses.notes,
      entered_by: profile.id,
    })

    setSaving(false)

    if (error) {
      console.error(error)
      setMessage('Failed to save expense.')
      return
    }
    setMessage('Expense added!')
    setExpenses({ category: 'staff_salary', amount: '', notes: '' })
  }

  return (
    <div className="space-y-6">
      <div className="bg-green-50 rounded-xl p-4">
        <p className="text-xs text-green-700">Today's profit</p>
        <p className="text-2xl font-semibold text-green-700">₹{totalProfit.toFixed(2)}</p>
      </div>

      {fuelTypes.map((ft) => (
        <div key={ft.id} className="bg-gray-50 rounded-xl p-4">
          <p className="text-sm font-medium mb-2">{ft.fuel_name}</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              type="number"
              placeholder="Liters sold"
              className="border rounded-lg px-3 py-2 text-sm"
              value={values[ft.id]?.liters || ''}
              onChange={(e) => handleChange(ft.id, 'liters', e.target.value)}
            />
            <input
              type="number"
              placeholder="Margin per L (₹)"
              className="border rounded-lg px-3 py-2 text-sm"
              value={values[ft.id]?.margin || ''}
              onChange={(e) => handleChange(ft.id, 'margin', e.target.value)}
            />
          </div>
          <p className="text-xs text-gray-600">Profit: ₹{calcProfit(ft.id).toFixed(2)}</p>
        </div>
      ))}

      <button
        onClick={handleSaveSales}
        disabled={saving}
        className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium"
      >
        {saving ? 'Saving...' : "Save today's sales"}
      </button>

      <div className="border-t pt-4">
        <p className="text-sm font-medium mb-2">Add expense</p>
        <div className="space-y-2">
          <select
            className="border rounded-lg px-3 py-2 text-sm w-full"
            value={expenses.category}
            onChange={(e) => setExpenses({ ...expenses, category: e.target.value })}
          >
            <option value="staff_salary">Staff salary</option>
            <option value="electricity">Electricity</option>
            <option value="maintenance">Maintenance</option>
            <option value="transport">Transport</option>
            <option value="other">Other</option>
          </select>
          <input
            type="number"
            placeholder="Amount (₹)"
            className="border rounded-lg px-3 py-2 text-sm w-full"
            value={expenses.amount}
            onChange={(e) => setExpenses({ ...expenses, amount: e.target.value })}
          />
          <input
            type="text"
            placeholder="Notes (optional)"
            className="border rounded-lg px-3 py-2 text-sm w-full"
            value={expenses.notes}
            onChange={(e) => setExpenses({ ...expenses, notes: e.target.value })}
          />
          <button
            onClick={handleSaveExpense}
            disabled={saving}
            className="w-full bg-gray-700 text-white rounded-lg py-2 text-sm font-medium"
          >
            Add expense
          </button>
        </div>
      </div>

      {message && (
        <p className={`text-sm ${message.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}

      <StockEntry station={station} profile={profile} />
    </div>
  )
}

export default FatherEntry