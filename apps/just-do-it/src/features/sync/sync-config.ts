// Like the Clerk key, the API URL is a build-time constant: Vite inlines every
// `VITE_` variable, so whether this build can talk to a server is fixed when it
// is bundled. Adding the variable to Vercel after a deploy does not reach that
// deploy — see SETUP.md.
const rawApiUrl = import.meta.env.VITE_API_URL;

// Trailing slashes are stripped so that callers can always join with a leading
// slash and not think about it.
export const apiUrl = typeof rawApiUrl === 'string' ? rawApiUrl.trim().replace(/\/+$/, '') : '';

export const isApiConfigured = apiUrl.length > 0;
