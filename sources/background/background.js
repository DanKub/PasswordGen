var suffListDB;
var genRulesDB;
var popupPort;

var preferences = {
    length: "15",
    constant: "",
    base64: true,
    hex: false,
    time: "0",
    store: true,
    use_stored: true
}

function putSuffListDataToDB(data) {
    var transaction = suffListDB.transaction(["pubsufflist"], "readwrite");
    var objStoreReq = transaction.objectStore("pubsufflist");
    objStoreReq.put(data, "psl");

    transaction = suffListDB.transaction(["listversion"], "readwrite");
    objStoreReq = transaction.objectStore("listversion");
    var currentDate = String(new Date().getMonth() + 1) + " " + String(new Date().getFullYear());
    objStoreReq.put(currentDate, "pslversion");
}

function getSuffList() {
    var suffListPath = "https://publicsuffix.org/list/public_suffix_list.dat";
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", suffListPath, true);
    xmlHttp.responseType = "text";
    xmlHttp.onreadystatechange = function () {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
            putSuffListDataToDB(xmlHttp.response);
        }
    }
    xmlHttp.send(null);
}

function updateSuffList() {
    var currentDate = String(new Date().getMonth() + 1) + " " + String(new Date().getFullYear());

    var transaction = suffListDB.transaction(["listversion"], "readonly");
    var objStoreReq = transaction.objectStore("listversion").get("pslversion");

    objStoreReq.onsuccess = function (event) {
        var listversionDate = objStoreReq.result;
        if (listversionDate.localeCompare(currentDate) != 0) {
            console.log("Downloading new version of Public Suffix List to local IndexedDB");
            getSuffList();
        }
    }
    objStoreReq.onerror = function (event) {
        console.error("Can't retrieve Public Suffix List version from IndexedDB");
        console.error(objStoreReq.error);
    }
}

function initSuffListDB() {
    var dbOpenReq = window.indexedDB.open("PubSuffList");
    var dbUpgraded = false;

    dbOpenReq.onerror = function (event) {
        console.error("Database 'PubSuffList' open request error: " + dbOpenReq.error);
    }

    dbOpenReq.onupgradeneeded = function (event) {
        console.log("Upgrading DB 'PubSuffList' version");
        var db = dbOpenReq.result;
        db.createObjectStore("pubsufflist");
        db.createObjectStore("listversion");
        if (db.version > 0) {
            dbUpgraded = true;
        }
    }

    dbOpenReq.onsuccess = function (event) {
        console.log("IndexedDB PubSuffList successfully open");
        suffListDB = dbOpenReq.result;

        // Init DB in first start
        if (dbUpgraded) {
            console.log("Downloading Public Suffix List to local IndexedDB");
            getSuffList();
        } else {
            //Check if Public Suffix List is no older than 1 month
            updateSuffList();
        }
    }
}


function initGenRulesDB() {
    var dbOpenReq = window.indexedDB.open("GeneratorRules");

    dbOpenReq.onerror = function (event) {
        console.error("Database 'GeneratorRules' open request error: " + dbOpenReq.error);
    }

    dbOpenReq.onupgradeneeded = function (event) {
        console.log("Upgrading DB 'GeneratorRules' version");
        var db = dbOpenReq.result;
        var objStore = db.createObjectStore("rules");
        objStore.createIndex("domain", "domain");
        objStore.createIndex("pwdLength", "pwdLength");
        objStore.createIndex("b64Enc", "b64Enc");
        objStore.createIndex("hexEnc", "hexEnc");
        objStore.createIndex("pdl", "pdl");
        objStore.createIndex("childs", "childs");
        objStore.createIndex("parent", "parent");
    }

    dbOpenReq.onsuccess = function (event) {
        console.log("IndexedDB 'GeneratorRules' successfully open");
        genRulesDB = dbOpenReq.result;
    }
}

function initPreferences(){
    var p = browser.storage.local.get();
    p.then(
        function(prefObj){
            if (Object.keys(prefObj).length == 0){ //if retrieved object has no keys (if no preferences are stored), then set default preferences
                var p = browser.storage.local.set(preferences);
                p.then(null, function(err){console.error(err);});
            }
        },
        function(err){
            console.error(err);
        }
    );
}




//TODO: Pridat moznost nacitania SuffListu aj zo suboru v pripade, ze nebude fungovat list zo servera

initSuffListDB();
initGenRulesDB();
initPreferences();
