/// <reference path="intellisense.js" />

var g_bLoaded = false; //needed because DOMContentLoaded gets called again when we modify the page

document.addEventListener("DOMContentLoaded", function () {
  loadBurndown();
});

function loadBurndown() {
  var iParams = window.location.href.indexOf("?");
  if (iParams < 0) return;
  var strParams = window.location.href.substring(iParams);
  var url = chrome.runtime.getURL("dashboard.html") + strParams;
  window.location.replace(url);
}
