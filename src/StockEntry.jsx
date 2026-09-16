import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function StockEntry({ station, profile }) {
  const [fuelTypes, setFuelTypes] = useState([])
  const [values, setValues] = useState({})
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
      })
  }, [station])

  const handleChange = (fuelTypeId, field, value) => {
    setValues((prev) => ({
      ...prev,
      [fuelTypeId]: { ...prev[fuelTypeId], [field]: value },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    const rows = fuelTypes
      .filter((ft) => values[ft.id]?.dip)
      .map((ft) => ({
        station_id: station.id,
        fuel_type_id: ft.id,
        entry_date: today,
        dip_reading_liters: parseFloat(values[ft.id].dip),
        delivery_liters: parseFloat(values[ft.id]?.delivery) || 0,
        delivery_invoice_amount: parseFloat(values[ft.id]?.invoice) || 0,
        entered_by: profile.id,
      }))

    if (rows.length === 0) {
      setSaving(false)
      setMessage('Enter at least a dip reading to save.')
      return
    }

    const { error } = await supabase
      .from('stock_entries')
      .upsert(rows, { onConflict: 'fuel_type_id,entry_date' })

    setSaving(false)

    if (error) {
      console.error(error)
      setMessage('Failed to save stock entry.')
      return
    }
    setMessage('Stock entry saved!')
  }

  return (
    <div className="border-t pt-4 space-y-4">
      <p className="text-sm font-medium">Stock / tank check</p>

      {fuelTypes.map((ft) => (
        <div key={ft.id} className="bg-gray-50 rounded-xl p-4">
          <p className="text-sm font-medium mb-2">{ft.fuel_name} tank</p>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              placeholder="Dip (L)"
              className="border rounded-lg px-2 py-1 text-sm"
              value={values[ft.id]?.dip || ''}
              onChange={(e) => handleChange(ft.id, 'dip', e.target.value)}
            />
            <input
              type="number"
              placeholder="Delivery (L)"
              className="border rounded-lg px-2 py-1 text-sm"
              value={values[ft.id]?.delivery || ''}
              onChange={(e) => handleChange(ft.id, 'delivery', e.target.value)}
            />
            <input
              type="number"
              placeholder="Invoice (₹)"
              className="border rounded-lg px-2 py-1 text-sm"
              value={values[ft.id]?.invoice || ''}
              onChange={(e) => handleChange(ft.id, 'invoice', e.target.value)}
            />
          </div>
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-gray-700 text-white rounded-lg py-2 text-sm font-medium"
      >
        {saving ? 'Saving...' : 'Save stock entry'}
      </button>

      {message && (
        <p className={`text-sm ${message.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </div>
  )
}

export default StockEntry