const configuredApiBaseUrl = import.meta.env.VITE_API_URL;

export function apiUrl(path, apiBaseUrl = configuredApiBaseUrl) {
  return apiBaseUrl ? `${apiBaseUrl.replace(/\/$/, '')}${path}` : path;
}
