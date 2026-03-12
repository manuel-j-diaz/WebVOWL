/**
 * Fetch-based HTTP helpers.
 * Always resolve — never reject on HTTP errors, only on network failures (caught internally).
 * Returns { ok, status, responseText }.
 */

function fetchGet(url, mimeType) {
  const headers = {};
  if (mimeType) headers["Accept"] = mimeType;
  return fetch(url, { headers })
    .then((response) => response.text().then((text) => ({
      ok: response.ok, status: response.status, responseText: text
    })))
    .catch(() => ({ ok: false, status: 0, responseText: "" }));
}

function fetchPost(url, body) {
  return fetch(url, { method: "POST", body })
    .then((response) => response.text().then((text) => ({
      ok: response.ok, status: response.status, responseText: text
    })))
    .catch(() => ({ ok: false, status: 0, responseText: "" }));
}

module.exports = { fetchGet, fetchPost };
