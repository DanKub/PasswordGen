var suffListDB;

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

function initDB() {
    var dbOpenReq = window.indexedDB.open("PubSuffList");
    var dbUpgraded = false;

    dbOpenReq.onerror = function (event) {
        console.error("Database open request error: " + dbOpenReq.error);
    }

    dbOpenReq.onupgradeneeded = function (event) {
        console.log("Upgrading DB version");
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

//TODO: Pridat moznost nacitania SuffListu aj zo suboru v pripade, ze nebude fungovat list zo servera

initDB();

// httpGetAsync("https://publicsuffix.org/list/public_suffix_list.dat");


// function readFile(_path, _cb){

//     fetch(_path, {mode:'same-origin'})   // <-- important

//     .then(function(_res) {
//         return _res.blob();
//     })

//     .then(function(_blob) {
//         var reader = new FileReader();

//         reader.addEventListener("loadend", function() {
//             _cb(this.result);
//         });

//         reader.readAsText(_blob); 
//     });
// };

// readFile('file.txt', function(_res){
//     console.log(_res); // <--  result (file content)
// });