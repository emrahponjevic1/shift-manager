// Client API module for communicating with the SQLite backend

const BASE_URL = '/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(url, config);
  if (!response.ok) {
    let errorMsg = 'Došlo je do greške u komunikaciji sa serverom';
    try {
      const errData = await response.json();
      if (errData && errData.error) errorMsg = errData.error;
    } catch {}
    throw new Error(errorMsg);
  }
  return response.json();
}

export const api = {
  // Bootstrap data
  getBootstrap: (params = {}) => {
    const query = params && params.fresh ? '?fresh=true' : '';
    return request(`/bootstrap${query}`);
  },

  // Save & Reset to Saved State
  saveCurrentState: () => request('/save', { method: 'POST' }),
  revertToSaved: () => request('/reset-to-saved', { method: 'POST' }),
  getSaveStatus: () => request('/save-status'),

  // Locations
  addLocation: (data) => request('/locations', { method: 'POST', body: JSON.stringify(data) }),
  updateLocation: (id, data) => request(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLocation: (id) => request(`/locations/${id}`, { method: 'DELETE' }),

  // Workers
  addWorker: (data) => request('/workers', { method: 'POST', body: JSON.stringify(data) }),
  updateWorker: (id, data) => request(`/workers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWorker: (id) => request(`/workers/${id}`, { method: 'DELETE' }),

  // Weeks
  addWeek: (data) => request('/weeks', { method: 'POST', body: JSON.stringify(data) }),
  updateWeek: (id, data) => request(`/weeks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWeek: (id) => request(`/weeks/${id}`, { method: 'DELETE' }),

  // Shifts
  addShift: (data) => request('/shifts', { method: 'POST', body: JSON.stringify(data) }),
  updateShift: (id, data) => request(`/shifts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteShift: (id) => request(`/shifts/${id}`, { method: 'DELETE' }),
  copyDayShifts: (data) => request('/shifts/copy-day', { method: 'POST', body: JSON.stringify(data) }),

  // Statuses (Absence, Sick, Free)
  setWorkerStatus: (data) => request('/statuses', { method: 'POST', body: JSON.stringify(data) }),
  clearWorkerSick: (data) => request('/statuses/clear-sick', { method: 'POST', body: JSON.stringify(data) }),

  // Reset & Backup
  revertPrevious: () => request('/revert-previous', { method: 'POST' }),
  saveCheckpoint: () => request('/checkpoint', { method: 'POST' }),
  resetToCrisis: () => request('/reset-crisis', { method: 'POST' }),
  importBackup: (data) => request('/backup/import', { method: 'POST', body: JSON.stringify(data) }),
  getExportUrl: () => `${BASE_URL}/backup/export`
};

