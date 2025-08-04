chrome.declarativeNetRequest.updateDynamicRules({
  removeRuleIds: [1],
  addRules: [
    {
      id: 1,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [{ header: "Referer", operation: "set", value: "https://trello.com/search" }],
      },
      condition: {
        urlFilter: "https://trello.com/1/search",
      },
    },
  ],
});

chrome.declarativeNetRequest.updateDynamicRules({
  removeRuleIds: [2],
  addRules: [
    {
      id: 2,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [{ header: "Referer", operation: "set", value: "https://trello.com/" }],
      },
      condition: {
        urlFilter: "https://trello.com/1/cards/*",
      },
    },
  ],
});

// XMLHttpRequest polyfill using fetch for Service Workers
(function () {
  "use strict";

  // Don't override if XMLHttpRequest already exists
  if (typeof globalThis.XMLHttpRequest !== "undefined") {
    return;
  }

  // Ready states
  const UNSENT = 0;
  const OPENED = 1;
  const HEADERS_RECEIVED = 2;
  const LOADING = 3;
  const DONE = 4;

  globalThis.XMLHttpRequest = function XMLHttpRequest() {
    // Private properties
    this._method = null;
    this._url = null;
    this._async = true;
    this._user = null;
    this._password = null;
    this._requestHeaders = {};
    this._responseHeaders = {};
    this._requestBody = null;
    this._abortController = null;
    this._fetchPromise = null;

    // Public properties
    this.readyState = UNSENT;
    this.response = null;
    this.responseText = "";
    this.responseType = "";
    this.responseURL = "";
    this.responseXML = null;
    this.status = 0;
    this.statusText = "";
    this.timeout = 0;
    this.upload = {};
    this.withCredentials = false;

    // Event handlers
    this.onabort = null;
    this.onerror = null;
    this.onload = null;
    this.onloadend = null;
    this.onloadstart = null;
    this.onprogress = null;
    this.onreadystatechange = null;
    this.ontimeout = null;
  };

  // Constants
  XMLHttpRequest.UNSENT = UNSENT;
  XMLHttpRequest.OPENED = OPENED;
  XMLHttpRequest.HEADERS_RECEIVED = HEADERS_RECEIVED;
  XMLHttpRequest.LOADING = LOADING;
  XMLHttpRequest.DONE = DONE;

  XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
    this._method = method.toUpperCase();
    this._url = url;
    this._async = async !== false;
    this._user = user || null;
    this._password = password || null;

    this.readyState = OPENED;
    this._fireEvent("readystatechange");
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (this.readyState !== OPENED) {
      throw new Error("InvalidStateError: setRequestHeader can only be called when state is OPENED");
    }

    const lowerName = name.toLowerCase();
    if (this._requestHeaders[lowerName]) {
      this._requestHeaders[lowerName] += ", " + value;
    } else {
      this._requestHeaders[lowerName] = value;
    }
  };

  XMLHttpRequest.prototype.getResponseHeader = function (name) {
    if (this.readyState < HEADERS_RECEIVED) {
      return null;
    }
    return this._responseHeaders[name.toLowerCase()] || null;
  };

  XMLHttpRequest.prototype.getAllResponseHeaders = function () {
    if (this.readyState < HEADERS_RECEIVED) {
      return "";
    }

    let headers = "";
    for (const name in this._responseHeaders) {
      headers += name + ": " + this._responseHeaders[name] + "\r\n";
    }
    return headers;
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (this.readyState !== OPENED) {
      throw new Error("InvalidStateError: send can only be called when state is OPENED");
    }

    this._requestBody = body || null;
    this._abortController = new AbortController();

    // Prepare fetch options
    const fetchOptions = {
      method: this._method,
      headers: this._requestHeaders,
      body: this._requestBody,
      signal: this._abortController.signal,
      credentials: this.withCredentials ? "include" : "same-origin",
    };

    // Add basic auth if provided
    if (this._user !== null) {
      const credentials = btoa(this._user + ":" + (this._password || ""));
      fetchOptions.headers["authorization"] = "Basic " + credentials;
    }

    // Fire loadstart event
    this._fireEvent("loadstart");

    // Handle timeout
    let timeoutId = null;
    if (this.timeout > 0) {
      timeoutId = setTimeout(() => {
        this._abortController.abort();
        this._fireEvent("timeout");
        this._fireEvent("loadend");
      }, this.timeout);
    }

    // Perform fetch
    this._fetchPromise = fetch(this._url, fetchOptions)
      .then((response) => {
        if (timeoutId) clearTimeout(timeoutId);

        this.status = response.status;
        this.statusText = response.statusText;
        this.responseURL = response.url;

        // Extract response headers
        this._responseHeaders = {};
        response.headers.forEach((value, name) => {
          this._responseHeaders[name.toLowerCase()] = value;
        });

        this.readyState = HEADERS_RECEIVED;
        this._fireEvent("readystatechange");

        this.readyState = LOADING;
        this._fireEvent("readystatechange");

        // Handle different response types
        if (this.responseType === "" || this.responseType === "text") {
          return response.text();
        } else if (this.responseType === "json") {
          return response.json();
        } else if (this.responseType === "blob") {
          return response.blob();
        } else if (this.responseType === "arraybuffer") {
          return response.arrayBuffer();
        } else {
          return response.text();
        }
      })
      .then((data) => {
        if (timeoutId) clearTimeout(timeoutId);

        // Set response data based on type
        if (this.responseType === "" || this.responseType === "text") {
          this.responseText = data;
          this.response = data;
        } else {
          this.response = data;
          this.responseText = typeof data === "string" ? data : "";
        }

        this.readyState = DONE;
        this._fireEvent("readystatechange");
        this._fireEvent("load");
        this._fireEvent("loadend");
      })
      .catch((error) => {
        if (timeoutId) clearTimeout(timeoutId);

        this.readyState = DONE;

        if (error.name === "AbortError") {
          this._fireEvent("abort");
        } else {
          this._fireEvent("error");
        }

        this._fireEvent("loadend");
      });
  };

  XMLHttpRequest.prototype.abort = function () {
    if (this._abortController) {
      this._abortController.abort();
    }

    if (this.readyState > UNSENT && this.readyState < DONE) {
      this.readyState = DONE;
      this._fireEvent("readystatechange");
      this._fireEvent("abort");
      this._fireEvent("loadend");
    }
  };

  XMLHttpRequest.prototype.overrideMimeType = function (mimetype) {
    // Basic implementation - just store it
    this._overriddenMimeType = mimetype;
  };

  // Event firing helper
  XMLHttpRequest.prototype._fireEvent = function (type) {
    const event = { type: type, target: this };

    // Call the specific event handler
    const handler = this["on" + type];
    if (typeof handler === "function") {
      try {
        handler.call(this, event);
      } catch (e) {
        // Ignore handler errors in service worker context
        console.error("XHR event handler error:", e);
      }
    }

    // Note: addEventListener/removeEventListener not implemented
    // as they're rarely used in service worker XHR polyfills
  };

  // Add event listener methods for completeness
  XMLHttpRequest.prototype.addEventListener = function (type, listener, options) {
    // Basic implementation - just set the handler
    this["on" + type] = listener;
  };

  XMLHttpRequest.prototype.removeEventListener = function (type, listener, options) {
    if (this["on" + type] === listener) {
      this["on" + type] = null;
    }
  };

  XMLHttpRequest.prototype.dispatchEvent = function (event) {
    this._fireEvent(event.type);
    return true;
  };

  // Make XMLHttpRequest available globally
  self.XMLHttpRequest = XMLHttpRequest;
})();
