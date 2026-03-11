function xhrRequest(url, mimeType, callback) {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  if (mimeType) xhr.setRequestHeader("Accept", mimeType);
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) callback(null, xhr);
    else callback(xhr, null);
  };
  xhr.onerror = () => { callback(xhr, null); };
  xhr.send();
}
module.exports = xhrRequest;
