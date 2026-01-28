export const getJobStartDate = (job) => {
  if (!job || typeof job !== 'object') return null

  const toDate = (value) => {
    if (!value) return null
    if (value instanceof Date) return value
    if (typeof value === 'number') {
      const d = new Date(value)
      return Number.isNaN(d.getTime()) ? null : d
    }
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) return null
      const parsed = new Date(trimmed)
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }
    if (typeof value.toDate === 'function') {
      try {
        const d = value.toDate()
        return Number.isNaN(d.getTime()) ? null : d
      } catch {
        return null
      }
    }
    return null
  }

  const direct = toDate(job.startAt) || toDate(job.startDate) || toDate(job.jobDate) || toDate(job.data)
  if (direct) return direct

  const dateRaw =
    (typeof job.data === 'string' ? job.data : null) ||
    (typeof job.date === 'string' ? job.date : null) ||
    (typeof job.jobDate === 'string' ? job.jobDate : null)
  if (!dateRaw) return null

  const parseDate = (value) => {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
    if (slash) {
      const [, dd, mm, yyyy] = slash
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    }
    return null
  }

  const isoDate = parseDate(dateRaw)
  if (!isoDate) return null

  const timeRaw =
    (typeof job.oraInizio === 'string' ? job.oraInizio : null) ||
    (typeof job.startTime === 'string' ? job.startTime : null) ||
    (typeof job.jobStartTime === 'string' ? job.jobStartTime : null) ||
    (typeof job.time === 'string' ? job.time : null)

  const normalizedTime = (() => {
    if (!timeRaw) return '23:59'
    const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timeRaw.trim())
    if (!match) return '23:59'
    const hour = match[1].padStart(2, '0')
    const minute = match[2].padStart(2, '0')
    const second = match[3] ? match[3].padStart(2, '0') : '00'
    return `${hour}:${minute}:${second}`
  })()

  const composed = new Date(`${isoDate}T${normalizedTime}`)
  return Number.isNaN(composed.getTime()) ? null : composed
}

export const isJobPast = (job, now = new Date()) => {
  const start = getJobStartDate(job)
  if (!start) return false
  return start.getTime() < now.getTime()
}
