console.log("works?");

// chrome.runtime.onInstalled.addListener((details) => {
//   sendMessage({
//     action: "onInstalled",
//     details,
//   });
// });

// chrome.runtime.onUpdateAvailable.addListener((details) => {
//   sendMessage({
//     action: "onUpdateAvailable",
//     details,
//   });
// });

// function sendMessage(message) {
//   backgroundResolve.then(() => {
//     chrome.runtime.sendMessage({
//       target: "offscreen",
//       ...message,
//     });
//   });
// }
