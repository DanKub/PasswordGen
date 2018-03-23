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

function displayDataFromGenRulesDB(){
    var transaction = genRulesDB.transaction(["rules"], "readwrite");
    var objStore = transaction.objectStore("rules");
    var index = objStore.index("domain");
    var req = index.get("efg.com"); // zobrazi prvu domenu ktoru najde
    var reqCursor = index.openCursor(); // cez kurzor sa mozem iterovat cez vsetky domeny v DB

    req.onsuccess = function (){
        console.log(req.result);
    }

    reqCursor.onsuccess = function() {
        var cursor = reqCursor.result;
        if(cursor) {
            console.log(cursor);
            cursor.continue();
        } else {
          console.log('Entries all displayed.');    
        }
      }
}

function putGenRulesToDB() {
    var transaction = genRulesDB.transaction(["rules"], "readwrite");
    var objStore = transaction.objectStore("rules");
    objStore.put({domain: "efg.efg.com", pwdLength: 5, b64Enc: "true", hexEnc: "false", sld: "efg"}, "neviem2");
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
        // putGenRulesToDB();
        // displayDataFromGenRulesDB();

        // var transaction = genRulesDB.transaction(["rules"], "readwrite");
        // var objStore = transaction.objectStore("rules");
        // var index = objStore.index("domain");
        // var reqAllRules = index.getAll(); // ziskam vsetky pravidla z DB
        // reqAllRules.onsuccess = () => {
        //     console.log('PT_DATA: ',reqAllRules.result);
        //     var jsonObj = JSON.stringify(reqAllRules.result); // pravidla zoserializujem pomocou JSON z objektu do stringu
        //     encryptText(jsonObj, "heslo").then(encryptedObj => {    // zasifrujeme to
        //         var encryptedString = ab2str(encryptedObj.encBuffer);
        //         var transaction = genRulesDB.transaction(["rules"], "readwrite");
        //         var objStore = transaction.objectStore("rules");
        //         var jsonIV = JSON.stringify(encryptedObj.iv);
        //         var base64IV = btoa(jsonIV);   // IV zakodujeme pomocou Base64
        //         objStore.put(encryptedString, base64IV).onsuccess = () => { // ulozim zasifrovane data do DB pod klucom IV
        //             var transaction = genRulesDB.transaction(["rules"], "readwrite");
        //             var objStore = transaction.objectStore("rules");
        //             var reqEncryptedRule = objStore.get(base64IV); // ziskam zasifrovane data z DB na zaklade IV
        //             reqEncryptedRule.onsuccess = () => {
        //                 console.log('CT_DATA: ',reqEncryptedRule.result);
        //                 var objIV = JSON.parse(atob(base64IV));  // deserializujem zakodovany IV -> vznikne mi obycajny Object, ktory potom treba hodit to Uint8Array
        //                 decryptText(str2ab(encryptedString), new Uint8Array(Object.values(objIV)), "heslo").then(decryptedObject => {
        //                     console.log(JSON.parse(decryptedObject));
        //                 });
        //             }
        //         }
        //     });
        // }
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

// async function hex_sha512(message) {

//     // encode as UTF-8
//     const msgBuffer = new TextEncoder('utf-8').encode(message);

//     // hash the message
//     const hashBuffer = await crypto.subtle.digest('SHA-512', msgBuffer);
    
//     // convert ArrayBuffer to Array
//     const hashArray = Array.from(new Uint8Array(hashBuffer));

//     // convert bytes to hex string
//     const hashHex = hashArray.map(b => ('00' + b.toString(16)).slice(-2)).join('');

//     // return hashHex;
//     return hashHex;
// }

// async function b64_sha512(message) {

//     // encode as UTF-8
//     const msgBuffer = new TextEncoder('utf-8').encode(message);

//     // hash the message
//     const hashBuffer = await crypto.subtle.digest('SHA-512', msgBuffer);
    
//     // convert ArrayBuffer to Array
//     const hashArray = Array.from(new Uint8Array(hashBuffer));

//     // convert bytes to base64
//     const hashB64 = btoa(String.fromCharCode.apply(null, new Uint8Array(hashBuffer)));

//     // return hashHex;
//     return hashB64;
// }

// hex_sha512('a').then(hash => console.log(hash));
// b64_sha512('a').then(hash => console.log(hash));


// function cakajnaB(){
//     return new Promise(resolve => {
//         setTimeout(()=>{console.log('b'); resolve();}, 2000);
//     });
// }

// async function haha(){
//     console.log("a");
//     await cakajnaB();
//     console.log("c");
// }
// haha();

const encryptText = async (plainText, password) => {
    const ptUtf8 = new TextEncoder().encode(plainText);
  
    const pwUtf8 = new TextEncoder().encode(password);
    const pwHash = await crypto.subtle.digest('SHA-256', pwUtf8); 
  
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const alg = { name: 'AES-CBC', iv: iv };
    const key = await crypto.subtle.importKey('raw', pwHash, alg, false, ['encrypt']);
  
    return { iv, encBuffer: await crypto.subtle.encrypt(alg, key, ptUtf8) };
}

const decryptText = async (ctBuffer, iv, password) => {
    const pwUtf8 = new TextEncoder().encode(password);
    const pwHash = await crypto.subtle.digest('SHA-256', pwUtf8);

    const alg = { name: 'AES-CBC', iv: iv };
    const key = await crypto.subtle.importKey('raw', pwHash, alg, false, ['decrypt']);

    const ptBuffer = await crypto.subtle.decrypt(alg, key, ctBuffer);

    const plaintext = new TextDecoder().decode(ptBuffer);

    return plaintext;
}

function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint16Array(buf));
}

function str2ab(str) {
    var buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
    var bufView = new Uint16Array(buf);
    for (var i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
}

// encryptText("abcd", "heslo").then(encryptedObj => {
//     console.log(encryptedObj);
//     var encryptedString = ab2str(encryptedObj.encBuffer);
//     console.log(encryptedString);
//     decryptText(str2ab(encryptedString), encryptedObj.iv, "heslo").then(decryptedObj => {
//         console.log(decryptedObj);
//     }, rejection => console.error(rejection));
// }, rejection => console.error(rejection));



// function portCommunication(p) {
//     popupPort = p;
//     popupPort.postMessage({greeting: "Hello from BACKGROUND"});
//     // popupPort.postMessage(suffListDB);
    
//   }
  
//   browser.runtime.onConnect.addListener(portCommunication);

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