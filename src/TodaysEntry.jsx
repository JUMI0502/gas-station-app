import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import StockEntry from './StockEntry'

function TodaysEntry({ station, profile }) {
  const [fuelTypes, setFuelTypes] = useState([])
  const [readings, setReadings] = useState({})
  const [payments, setPayments] = useState({ cash: '', upi: '', card: '', credit: '' })
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
        if (error) {
          console.error('Failed to load fuel types:', error)
          return
        }
        setFuelTypes(data)
      })
  }, [station])

  const handleReadingChange = (fuelTypeId, nozzleNumber, field, value) => {
    const key = `${fuelTypeId}-${nozzleNumber}`
    setReadings((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }))
  }

  const calculateLitersAndRevenue = (fuelTypeId, nozzleNumber) => {
    const key = `${fuelTypeId}-${nozzleNumber}`
    const entry = readings[key]
    if (!entry || !entry.opening || !entry.closing || !entry.rate) {
      return { liters: 0, revenue: 0 }
    }
    const liters = parseFloat(entry.closing) - parseFloat(entry.opening)
    const revenue = liters * parseFloat(entry.rate)
    return { liters: liters > 0 ? liters : 0, revenue: revenue > 0 ? revenue : 0 }
  }

  const totalCalculatedRevenue = fuelTypes.reduce((sum, ft) => {
    for (let n = 1; n <= ft.nozzle_count; n++) {
      sum += calculateLitersAndRevenue(ft.id, n).revenue
    }
    return sum
  }, 0)

  const totalPayments =
    (parseFloat(payments.cash) || 0) +
    (parseFloat(payments.upi) || 0) +
    (parseFloat(payments.card) || 0) +
    (parseFloat(payments.credit) || 0)

  const paymentsMatch = Math.abs(totalCalculatedRevenue - totalPayments) < 1

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    const entryRows = []
    for (const ft of fuelTypes) {
      for (let n = 1; n <= ft.nozzle_count; n++) {
        const key = `${ft.id}-${n}`
        const entry = readings[key]
        if (entry && entry.opening && entry.closing && entry.rate) {
          entryRows.push({
            station_id: station.id,
            fuel_type_id: ft.id,
            nozzle_number: n,
            entry_date: today,
            opening_reading: parseFloat(entry.opening),
            closing_reading: parseFloat(entry.closing),
            rate_per_liter: parseFloat(entry.rate),
            entered_by: profile.id,
          })
        }
      }
    }

    const { error: entriesError } = await supabase
      .from('daily_entries')
      .upsert(entryRows, { onConflict: 'fuel_type_id,nozzle_number,entry_date' })

    const { error: paymentsError } = await supabase
      .from('daily_payments')
      .upsert(
        {
          station_id: station.id,
          entry_date: today,
          cash: parseFloat(payments.cash) || 0,
          upi: parseFloat(payments.upi) || 0,
          card: parseFloat(payments.card) || 0,
          credit: parseFloat(payments.credit) || 0,
          entered_by: profile.id,
        },
        { onConflict: 'station_id,entry_date' }
      )

    setSaving(false)

    if (entriesError || paymentsError) {
      const err = entriesError || paymentsError
      console.error(err)
      if (err.code === '42501' || err.message?.includes('policy')) {
        setMessage("You don't have permission to edit this station.")
      } else {
        setMessage('Failed to save. Please try again.')
      }
      return
    }

    setMessage('Saved successfully!')
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
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500">Today's revenue</p>
          <p className="text-xl font-semibold">₹{totalCalculatedRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500">Payment match</p>
          <p className={`text-xl font-semibold ${paymentsMatch ? 'text-green-600' : 'text-red-600'}`}>
            {paymentsMatch ? 'Matched' : 'Mismatch'}
          </p>
        </div>
      </div>

      {fuelTypes.map((ft) => (
        <div key={ft.id}>
          <p className="text-sm font-medium mb-2">{ft.fuel_name}</p>
          <div className="space-y-2">
            {Array.from({ length: ft.nozzle_count }, (_, i) => i + 1).map((n) => {
              const { liters, revenue } = calculateLitersAndRevenue(ft.id, n)
              return (
                <div key={n} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-2">Nozzle {n}</p>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <input
                      type="number"
                      placeholder="Opening"
                      className="border rounded-lg px-2 py-1 text-sm"
                      onChange={(e) => handleReadingChange(ft.id, n, 'opening', e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Closing"
                      className="border rounded-lg px-2 py-1 text-sm"
                      onChange={(e) => handleReadingChange(ft.id, n, 'closing', e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Rate/L"
                      className="border rounded-lg px-2 py-1 text-sm"
                      onChange={(e) => handleReadingChange(ft.id, n, 'rate', e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-gray-600">
                    {liters.toFixed(1)} L · ₹{revenue.toFixed(2)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div>
        <p className="text-sm font-medium mb-2">Payment collected</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Cash"
            className="border rounded-lg px-3 py-2 text-sm"
            value={payments.cash}
            onChange={(e) => setPayments({ ...payments, cash: e.target.value })}
          />
          <input
            type="number"
            placeholder="UPI"
            className="border rounded-lg px-3 py-2 text-sm"
            value={payments.upi}
            onChange={(e) => setPayments({ ...payments, upi: e.target.value })}
          />
          <input
            type="number"
            placeholder="Card"
            className="border rounded-lg px-3 py-2 text-sm"
            value={payments.card}
            onChange={(e) => setPayments({ ...payments, card: e.target.value })}
          />
          <input
            type="number"
            placeholder="Credit"
            className="border rounded-lg px-3 py-2 text-sm"
            value={payments.credit}
            onChange={(e) => setPayments({ ...payments, credit: e.target.value })}
          />
        </div>
      </div>

      {message && (
        <p className={`text-sm ${message.includes('Failed') || message.includes("don't have permission") ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium"
      >
        {saving ? 'Saving...' : "Save today's entry"}
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

      <StockEntry station={station} profile={profile} />
    </div>
  )
}

export default TodaysEntry