import './background-glue.js';

localStorage.refresh();

chrome.offscreen.createDocument({
  url: "offscreen.html",
  reasons: ["DOM_PARSER", "LOCAL_STORAGE", "BLOBS"], // or other reasons like 'BLOBS', 'LOCAL_STORAGE'
  justification: "Need DOM access for legacy functionality",
});

import './websql/websql.mjs';
import './libs/buy.js'
import './shared.js'
import './sharedmobile.js'
import './sharedsync.js'
import './language.js'
import './sql.js'
import './trellosync.js'
import './commitsync.js'
import './background.js'