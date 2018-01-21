var in_tab_domain = document.getElementById("in_tab_domain");
var in_tab_sld = document.getElementById("in_tab_sld");
var in_inserted_pwd = document.getElementById("in_inserted_pwd");
var in_generated_pwd = document.getElementById("in_generated_pwd");
//var tabDomain;  //Current tab domain (www.example.com) DELTE THIS VAR
//var tabSld;     //Current tab second level domain (example) DELETE THIS VAR
var suffListData;
var genRulesDB;


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

function isIpAddress(ip){
    var ip = ip.split(".");
    if (ip.length != 4){
        return false;
    }
    for(var i = 0; i < 4; i++){
        if (ip[i] < 0 || ip[i] > 255 || isNaN(ip[i])){
            return false;
        }
    }
    return true;
}

/* 
Get current tab URL, call getSecondLvlDomain and write value to HTML input
*/
function getCurrentTabDomain(tabs) {
    var urlWithoutProtocol = tabs[0].url.replace(/(^\w+:|^)\/\//, '');
    var tabDomain = urlWithoutProtocol.match(/[\w.-]+/)[0];
    in_tab_domain.value = tabDomain;

    if(isIpAddress(tabDomain)){
        in_tab_sld.value = tabDomain;
    }
    else{
        in_tab_sld.value = getSecondLvlDomain(tabDomain);
    }
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

// Ulozim aktualne nastavenia generatora pre danu domenu do databazy ako nove pravidlo.
// V pripade, ze sa tam uz pravidlo pre danu domenu nachadza, tak sa to len prepise.
function saveGenRule(){
    var transaction = genRulesDB.transaction(["rules"], "readwrite");
    var rulesObjStore = transaction.objectStore("rules");
    rulesObjStore.put({ domain: in_tab_domain.value, 
                        pwdLength: preferences.length,
                        b64Enc: String(preferences.base64),
                        hexEnc: String(preferences.hex),
                        sld: in_tab_sld.value,
                      }, in_tab_domain.value)
}

// Vstupny retazec zahashujem N krat a vyplujem ho do pozadovaneho kodovania (B64/ENC)
function hashNTimes(strToHash, b64Enc, hexEnc, N){
    if (String(b64Enc) == "true" && String(hexEnc) == "false"){
        var pwd = b64_sha512(strToHash);
        for (let i = 1; i < N; i++){
            pwd = b64_sha512(pwd);
        }
        return pwd;
    }
    else if (String(hexEnc) == "true" && String(b64Enc) == "false"){
        var pwd = hex_sha512(strToHash);
        for (let i = 1; i < N; i++){
            pwd = hex_sha512(pwd);
        }
        return pwd;
    }
}

// Generovanie hesla
function generatePassword(){
    var transaction = genRulesDB.transaction(["rules"], "readonly");
    var rulesObjStore = transaction.objectStore("rules");
    var indexDomain = rulesObjStore.index("domain");

    // GENERUJ Z ULOZENYCH PRAVIDIEL A UKLADAJ PRAVIDLA
    if(preferences.use_stored == true && preferences.store == true){
        var req = indexDomain.get(in_tab_domain.value);
        req.onsuccess = function(){
            var storedRule = req.result;

            // ak nasiel ulozenu domenu v DB tak vygeneruje heslo podla ulozeneho pravidla
            if (storedRule != null){
                var strToHash = in_inserted_pwd.value + in_tab_domain.value + preferences.constant; // zatial tam je DOMAIN NAME
                var pwd = hashNTimes(strToHash, storedRule.b64Enc, storedRule.hexEnc, 1000);
                in_generated_pwd.value = pwd.substring(0,storedRule.pwdLength);
            }
            // ak nenasiel, tak generuje s aktualnymi nastaveniami generatora a nasledne ulozi tieto nastavenia ako nove pravidlo
            else{
                console.log("Rule with domain name '" + in_tab_domain.value + "' was not found in DB");
                console.log("Generating password with current generator preferences");
                var strToHash = in_inserted_pwd.value + in_tab_domain.value + preferences.constant;
                var pwd = hashNTimes(strToHash, preferences.base64, preferences.hex, 1000);
                in_generated_pwd.value = pwd.substring(0,preferences.length);

                //Ulozenie nastaveni do DB
                saveGenRule();
            }
        }
        req.onerror = function(){
            console.error(req.result);
        }
    }
    //GENERUJ Z ULOZENYCH PRAVIDIEL A NEUKLADAJ PRAVIDLA
    else if(preferences.use_stored == true && preferences.store == false){
        var req = indexDomain.get(in_tab_domain.value);
        req.onsuccess = function(){
            var storedRule = req.result;

            // ak nasiel ulozenu domenu v DB tak vygeneruje heslo podla ulozeneho pravidla
            if (storedRule != null){
                var strToHash = in_inserted_pwd.value + in_tab_domain.value + preferences.constant; // zatial tam je DOMAIN NAME
                var pwd = hashNTimes(strToHash, storedRule.b64Enc, storedRule.hexEnc, 1000);
                in_generated_pwd.value = pwd.substring(0,storedRule.pwdLength);
            }
            // ak nenasiel tak musim upozornit pouzivatela. Zaroven nic negenerujem a ani neukladam.
            else {
                console.log("Rule with domain name '" + in_tab_domain.value + "' was not found in DB");
                console.log("ZOBRAZENIE UPOZORNENIA!");
            }
        }
        req.onerror = function(){
            console.error(req.result);
        }
    }
    //NEGENERUJ Z ULOZENYCH PRAVIDIEL A UKLADAJ PRAVIDLA
    else if(preferences.use_stored == false && preferences.store == true){
        var req = indexDomain.get(in_tab_domain.value);
        req.onsuccess = function(){
            var storedRule = req.result;

            // ak nasiel ulozenu domenu v DB tak nechavam bez zmeny // ALEBO PREPISAT AKTUALNYMI NASTAVENIAMI? -skor asi to
            if (storedRule != null){

            }
            // ak nenasiel ulozenu domenu, tak ju ulozim
            else {
                console.log("Rule with domain name '" + in_tab_domain.value + "' was not found in DB");
                console.log("Saving rule for domain name '" + in_tab_domain.value + "' into DB");
                saveGenRule();
            }
        }
        req.onerror = function(){
            console.error(req.result);
        }

        console.log("Generating password with current generator preferences");
        var strToHash = in_inserted_pwd.value + in_tab_domain.value + preferences.constant;
        var pwd = hashNTimes(strToHash, preferences.base64, preferences.hex, 1000);
        in_generated_pwd.value = pwd.substring(0,preferences.length);

    }
    //NEGENERUJ Z ULOZENYCH PRAVIDIEL A NEUKLADAJ PRAVIDLA
    else if(preferences.use_stored == false && preferences.store == false){
        console.log("Generating password with current generator preferences");
        var strToHash = in_inserted_pwd.value + in_tab_domain.value + preferences.constant;
        var pwd = hashNTimes(strToHash, preferences.base64, preferences.hex, 1000);
        in_generated_pwd.value = pwd.substring(0,preferences.length);
    }
}

//Nacitanie nastaveni generatora
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
function openSuffListDB(){
    var dbOpenReq = window.indexedDB.open("PubSuffList");

    dbOpenReq.onerror = function () {
        console.error("Database open request error: " + dbOpenReq.error);
    }

    dbOpenReq.onsuccess = function () {
        console.log("IndexedDB 'PubSuffList' successfully open");
        getDBSuffList(dbOpenReq.result);
    }
}

function openGenRulesDB(){
    var dbOpenReq = window.indexedDB.open("GeneratorRules");

    dbOpenReq.onerror = function () {
        console.error("Database open request error: " + dbOpenReq.error);
    }

    dbOpenReq.onsuccess = function () {
        console.log("IndexedDB 'GeneratorRules' successfully open");
        genRulesDB = dbOpenReq.result;
    }
}


openSuffListDB();
loadPreferences();
openGenRulesDB();

in_inserted_pwd.addEventListener("change", generatePassword);


// var backgroundPort = browser.runtime.connect({name:"popup-port"}); //connect to backround.js

// backgroundPort.onMessage.addListener(function(m) {
//   console.log(m);
// });