var in_tab_domain = document.getElementById("in_tab_domain");
var suffListData;

/* 
Return second level domain from given URL
*/
function getSecondLvlDomain(domain) {
    publicSuffixList.parse(suffListData, punycode.toASCII);
    var tmpDomain = publicSuffixList.getDomain(domain);
    var sld = tmpDomain.substr(0, tmpDomain.indexOf("."));
    return sld;
}

/* 
Get current tab URL, call getSecondLvlDomain and write value to HTML input
*/
function getCurrentTabDomain(tabs) {
    var urlWithoutProtocol = tabs[0].url.replace(/(^\w+:|^)\/\//, '');
    var domain = urlWithoutProtocol.match(/[\w.-]+/)[0];
    var sld = getSecondLvlDomain(domain);
    in_tab_domain.value = sld;
}

function onError(err) {
    console.error(err);
}

/*
Load suffix list data from DB to  global variable suffListData.
After that call getCurrentTabDomain function.
*/
function getDBSuffList(suffListDB) {
    var transaction = suffListDB.transaction(["pubsufflist"], "readonly");
    var objStoreReq = transaction.objectStore("pubsufflist").get("psl");

    objStoreReq.onsuccess = function (event) {
        suffListData = objStoreReq.result;
        var tab_query = browser.tabs.query({ currentWindow: true, active: true });
        tab_query.then(getCurrentTabDomain, onError);
    }

    objStoreReq.onerror = function (event) {
        console.error("Can't retrieve Public Suffix List data from IndexedDB");
        console.error(objStoreReq.error);
    }
}

// Open DB with Public Suffix List
var dbOpenReq = window.indexedDB.open("PubSuffList");

dbOpenReq.onerror = function (event) {
    console.error("Database open request error: " + dbOpenReq.error);
}

dbOpenReq.onsuccess = function (event) {
    console.log("IndexedDB PubSuffList successfully open");
    getDBSuffList(event.target.result);
}
