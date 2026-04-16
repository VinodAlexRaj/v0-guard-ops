export interface SiteFormErrors {
  siteCode?: string
  name?: string
  latitude?: string
  longitude?: string
  radius?: string
}

export const validateSiteCode = (code: string): boolean => {
  return /^[A-Z]{5}[0-9]{2}$/.test(code)
}

export const validateSiteForm = (values: {
  name: string
  siteCode: string
  latitude: string
  longitude: string
  radius: string
}): SiteFormErrors => {
  const errors: SiteFormErrors = {}

  if (!values.name.trim()) {
    errors.name = 'Site name is required'
  }

  if (!validateSiteCode(values.siteCode)) {
    errors.siteCode = 'Format: 5 letters + 2 digits (e.g. KLSNT01)'
  }

  // If any geofence field is provided, validate all
  const hasGeo = values.latitude || values.longitude
  if (hasGeo) {
    const lat = parseFloat(values.latitude)
    const lon = parseFloat(values.longitude)
    const radius = parseInt(values.radius)

    if (isNaN(lat)) {
      errors.latitude = 'Enter a valid latitude'
    }
    if (isNaN(lon)) {
      errors.longitude = 'Enter a valid longitude'
    }
    if (isNaN(radius) || radius < 10 || radius > 500) {
      errors.radius = 'Radius must be between 10–500 metres'
    }
  }

  return errors
}

export const getErrorMessage = (error: any): string => {
  if (error.code === '23505') {
    return 'Site code already exists'
  }
  if (error.message) {
    return error.message
  }
  return 'An error occurred'
}
