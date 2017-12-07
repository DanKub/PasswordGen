var in_tab_domain = document.getElementById("in_tab_domain");
var in_inserted_pwd = document.getElementById("in_inserted_pwd");
var in_generated_pwd = document.getElementById("in_generated_pwd");
var suffListData;

//Default preferences will be overwritten after call loadPreferences()
var preferences = {
    length: null,
    constant: null,
    base64: null,
    hex: null,
    time: null,
    store: null,
    use_stored: null
}

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

function generatePassword(){
    var pwdLength = preferences.length;
    var strToHash = in_inserted_pwd.value + in_tab_domain.value + preferences.constant;

    if (preferences.base64 == true && preferences.hex == false){
        var pwd = b64_sha512(strToHash);
        for (let i = 1; i < 1000; i++){
            pwd = b64_sha512(pwd);
        }
        in_generated_pwd.value = pwd.substring(0,pwdLength);
    }
    else if(preferences.hex == true && preferences.base64 == false){
        var pwd = hex_sha512(strToHash);
        for (let i = 1; i < 1000; i++){
            pwd = hex_sha512(pwd);
        }
        in_generated_pwd.value = pwd.substring(0,pwdLength);
    }
    
}

function loadPreferences(){
    var p = browser.storage.local.get();
    p.then(onSuccess, onError);

    function onSuccess(item){
        preferences.length = item.length;
        preferences.constant = item.constant;
        preferences.base64 = item.base64;
        preferences.hex = item.hex;
        preferences.time = item.time;
        preferences.store = item.store;
        preferences.use_stored = item.use_stored;
    }

    function onError(err){
        console.error(err);
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

loadPreferences();

in_inserted_pwd.addEventListener("change", generatePassword);


// var backgroundPort = browser.runtime.connect({name:"popup-port"}); //connect to backround.js

// backgroundPort.onMessage.addListener(function(m) {
//   console.log(m);
// });