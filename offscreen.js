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

// chrome.declarativeNetRequest.updateDynamicRules({
//   removeRuleIds: [1],
//   addRules: [
//     {
//       id: 1,
//       priority: 1,
//       action: {
//         type: "modifyHeaders",
//         requestHeaders: [{ header: "Referer", operation: "set", value: "https://trello.com/search" }],
//       },
//       condition: {
//         urlFilter: "https://trello.com/1/search",
//         resourceTypes: ["xmlhttprequest"],
//       },
//     },
//   ],
// });
