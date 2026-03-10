function xhrRequest(url, mimeType, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  if (mimeType) xhr.setRequestHeader("Accept", mimeType);
  xhr.onload = function() {
    if (xhr.status >= 200 && xhr.status < 300) callback(null, xhr);
    else callback(xhr, null);
  };
  xhr.onerror = function() { callback(xhr, null); };
  xhr.send();
}
module.exports = xhrRequest;
