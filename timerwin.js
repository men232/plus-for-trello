/// <reference path="intellisense.js" />

var g_bLoaded = false;
var g_bSentLoadedMsg = false;

function sendOnceLoadedMessage() {
    if (g_bSentLoadedMsg)
        return;
    g_bSentLoadedMsg = true;
    var params = getUrlParams();
    var idCard = params.idCard;
    var bClearAndMinimize = (params.minimized != "0");
    sendExtensionMessage({ method: "timerWindowLoaded", idCard: idCard, bClearAndMinimize: bClearAndMinimize }, function (response) { });
}

var g_msStartWindow=0; //uninitialized
var g_bReadyForRestore = false;
const DELAY_START=300;

window.addEventListener("click", function (event) {
    handleRestoreWindow(true);
});

window.addEventListener("load", function (event) {
    g_msStartWindow= Date.now();

    var params = getUrlParams();
    var idCard = params.idCard;
    
    //try to wait until the window is fully painted, Windows needs it so its minimized preview shows the content.
    //this method isnt perfect. I also tried changing an img src and detect its onload but that also didnt always work,
    //so the current approach is to wait extra
        setTimeout(function () {
            sendOnceLoadedMessage();
            setTimeout(function () {
                g_bReadyForRestore=true;
            }, 100);
        }, DELAY_START);
});



function handleRestoreWindow(bClicked) {
    var params = getUrlParams();
    var idCard = params.idCard;
    sendOnceLoadedMessage();
    var bLoadCard = true;
    //workarround temporarily for Mac, https://bugs.chromium.org/p/chromium/issues/detail?id=928735
    if (navigator.userAgent.indexOf("Mac OS")!= -1 && !bClicked)
        bLoadCard = false;
    if (bLoadCard)
        sendExtensionMessage({ method: "timerWindowRestored", idCard: idCard }, function (response) {
    });
}


function checkNeedHandleRestoreWindow() {
    if (!g_bReadyForRestore || g_msStartWindow==0 || document.visibilityState != "visible")
        return;
    if (Date.now()-g_msStartWindow<DELAY_START)
        return;
    g_msStartWindow= Date.now();
    handleRestoreWindow();
}

window.onfocus = function () {
    checkNeedHandleRestoreWindow();
};

document.addEventListener('DOMContentLoaded', function () {
    if (g_bLoaded)
        return;
    g_bLoaded = true;

    var params = getUrlParams();
    var idCard = params.idCard;
    var hash = getCardTimerSyncHash(idCard);

    $("#cardText").text(params.nameCard);//.prop("title", params.nameCard);
    $("#boardText").text(params.nameBoard);

    function update() {
        getCardTimerData(hash, function (objTimer) {
            var stored = objTimer.stored;

            if (stored === undefined || stored.msStart == null || stored.msEnd != null) {
                document.title = "00:00m";
                sendOnceLoadedMessage();
                window.close();
            }
            else {
                document.title = getTimerElemText(stored.msStart, Date.now(), false, true);
                checkNeedHandleRestoreWindow();
            }
        });
    }

    update();
    setInterval(update, 1000); //review this could be re-done with timeouts with minute-step as now the windows is always minimized
});

