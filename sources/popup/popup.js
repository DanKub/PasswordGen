var in_tab_domain = document.getElementById("in_tab_domain");
var in_tab_pdl = document.getElementById("in_tab_pdl");
var in_pdl_datalist = document.getElementById("pdl_datalist");
var in_pwd_length = document.getElementById("in_pwd_length");
var in_constant = document.getElementById("in_constant");
var rb_base64 = document.getElementById("rb_base64");
var rb_hex = document.getElementById("rb_hex");
var in_inserted_pwd = document.getElementById("in_inserted_pwd");
var in_generated_pwd = document.getElementById("in_generated_pwd");
var div_gen_prefs = document.getElementById("div_gen_prefs");

//var tabDomain;  //Current tab domain (www.example.com) DELTE THIS VAR
//var tabPdl;     //Current tab second level domain (example) DELETE THIS VAR
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

function createParentDomainsList(){
    publicSuffixList.parse(suffListData, punycode.toASCII);
    var publicSuffix = publicSuffixList.getPublicSuffix(in_tab_domain.value);

    var splittedDomain = in_tab_domain.value.split(".");
    var subdomains =  splittedDomain.slice(0, splittedDomain.indexOf(getSecondLvlDomain(publicSuffix))) // array of subdomains without psl

    var optionstring = new String();
    for (var i = subdomains.length - 1; i >= 0; i--){
        optionstring = subdomains[i] + optionstring;
        var option = document.createElement("option");
        option.value = optionstring;
        in_pdl_datalist.appendChild(option);
        optionstring = "." + optionstring;
    }
}

/* 
Get current tab URL, call getSecondLvlDomain and write value to HTML input
*/
function showUI(){
    var tab_query = browser.tabs.query({ currentWindow: true, active: true });
    tab_query.then(tabObtained, onError);

    function tabObtained(tabs){
        var urlWithoutProtocol = tabs[0].url.replace(/(^\w+:|^)\/\//, '');
        var tabDomain = urlWithoutProtocol.match(/[\w.-]+/)[0];
        var tabPdl;

        if(isIpAddress(tabDomain)){
            tabPdl = tabDomain;
        }
        else{
            tabPdl = getSecondLvlDomain(tabDomain);
        }

        if(preferences.use_stored == true){
            var transaction = genRulesDB.transaction(["rules"], "readonly");
            var rulesObjStore = transaction.objectStore("rules");
            var indexDomain = rulesObjStore.index("domain");
            var reqDomain = indexDomain.get(tabDomain);

            // Ked nahodou niekto zmeni PDL podla seba
            if(in_tab_pdl.value != ""){
                tabPdl = in_tab_pdl.value;
            }

            reqDomain.onsuccess = function(){
                var storedRuleDomain = reqDomain.result;

                //Ak sa nachadza aktualna domena v DB, vypln inputy hodnotami z DB
                if(storedRuleDomain != null){
                    in_tab_domain.value = tabDomain;
                    in_tab_pdl.value = storedRuleDomain.pdl;
                    createParentDomainsList();
                }

                //Inac skontroluj este ci sa nenachadza v DB nahodou PDL aktualnej domeny
                else{
                    var indexPdl = rulesObjStore.index("pdl");
                    var reqPdl = indexPdl.get(tabPdl);

                    reqPdl.onsuccess = function(){
                        var storedRulePdl = reqPdl.result;

                        // Ak sa v DB nachadza PDL aktualnej domeny, tak vypln inputy a nastavenia generatora z ulozeneho pravidla z DB
                        // Zobraz tieto inputy... to vsetko iba v pripade, ze na takuto neulozenu domenu sme natrafili 1. krat.
                        if(storedRulePdl != null){
                            in_tab_domain.value = tabDomain;
                            in_tab_pdl.value = tabPdl;
                            in_pwd_length.value = storedRulePdl.pwdLength;
                            rb_base64.checked = (storedRulePdl.b64Enc == "true");
                            rb_hex.checked = (storedRulePdl.hexEnc == "true");
                            div_gen_prefs.hidden = false;

                            temporarySavePreferences();
                            createParentDomainsList();
                        }

                        //Ak nie je v DB ulozene nic (ani domena ani PDL tejto domeny), vypln inputy podla aktualneho tabu
                        else{
                            in_tab_domain.value = tabDomain;
                            in_tab_pdl.value = tabPdl;
                            createParentDomainsList();
                        }
                    }
                }
            }
        }
        else{
            in_tab_domain.value = tabDomain;
            in_tab_pdl.value = tabPdl;
            createParentDomainsList();
        }
    }
}

function onError(err) {
    console.error(err);
}

/*
Load suffix list data from DB to  global variable suffListData.
After that call getCurrentTab function.
*/
function getDBSuffList(suffListDB) {
    var transaction = suffListDB.transaction(["pubsufflist"], "readonly");
    var objStoreReq = transaction.objectStore("pubsufflist").get("psl");

    objStoreReq.onsuccess = function (event) {
        suffListData = objStoreReq.result;
        showUI();
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
    var indexPdl = rulesObjStore.index("pdl");
    var reqPdl = indexPdl.getAll(in_tab_pdl.value);

    // Pozriem sa na vsetky existujuce zaznamy s rovnakou PDL. 
    reqPdl.onsuccess = function(){
        var storedRulePdl = reqPdl.result;

        // Ak je ulozeny aspon 1, tak ten zaznam budem povazovat za rodica, pripisem mu aktualnu domenu ako dieta.
        // Zaroven to bude zaznam vzdy ako posledny. Preto length-1.
        if(storedRulePdl.length > 0){
            if (storedRulePdl.length == 1 && storedRulePdl[0].childs == null){
                storedRulePdl[0].childs = [];
            }
            for (var i = 0; i < storedRulePdl.length; i++){
                if(storedRulePdl[i].childs != null){
                    storedRulePdl[i].childs.push(in_tab_domain.value);
                    rulesObjStore.put({ domain: storedRulePdl[i].domain, 
                                        pwdLength: storedRulePdl[i].pwdLength,
                                        b64Enc: storedRulePdl[i].b64Enc,
                                        hexEnc: storedRulePdl[i].hexEnc,
                                        pdl: storedRulePdl[i].pdl,
                                        childs: storedRulePdl[i].childs,
                                    }, storedRulePdl[i].domain);
                }
            }
        }
    }
    rulesObjStore.put({ domain: in_tab_domain.value, 
                        pwdLength: preferences.length,
                        b64Enc: String(preferences.base64),
                        hexEnc: String(preferences.hex),
                        pdl: in_tab_pdl.value,
                      }, in_tab_domain.value);
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
                var strToHash = in_inserted_pwd.value + in_tab_pdl.value + preferences.constant;
                var pwd = hashNTimes(strToHash, storedRule.b64Enc, storedRule.hexEnc, 1000);
                in_generated_pwd.value = pwd.substring(0,storedRule.pwdLength);
            }
            // ak nenasiel, tak generuje s aktualnymi nastaveniami generatora a nasledne ulozi tieto nastavenia ako nove pravidlo
            else{
                console.log("Rule with domain name '" + in_tab_domain.value + "' was not found in DB");
                console.log("Generating password with current generator preferences");
                var strToHash = in_inserted_pwd.value + in_tab_pdl.value + preferences.constant;
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
                var strToHash = in_inserted_pwd.value + in_tab_pdl.value + preferences.constant; // zatial tam je DOMAIN NAME
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
        var strToHash = in_inserted_pwd.value + in_tab_pdl.value + preferences.constant;
        var pwd = hashNTimes(strToHash, preferences.base64, preferences.hex, 1000);
        in_generated_pwd.value = pwd.substring(0,preferences.length);

    }
    //NEGENERUJ Z ULOZENYCH PRAVIDIEL A NEUKLADAJ PRAVIDLA
    else if(preferences.use_stored == false && preferences.store == false){
        console.log("Generating password with current generator preferences");
        var strToHash = in_inserted_pwd.value + in_tab_pdl.value + preferences.constant;
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

        in_pwd_length.value = item.length;
        in_constant.value = item.constant;
        rb_base64.checked = item.base64;
        rb_hex.checked = item.hex;
    }
}

/*
Store preferences in variable while popup window is not closed
*/
function temporarySavePreferences() {
    preferences.length = in_pwd_length.value;
    preferences.constant = in_constant.value;
    preferences.base64 = rb_base64.checked;
    preferences.hex = rb_hex.checked;
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
        openSuffListDB();
    }
}

openGenRulesDB();
loadPreferences();

in_inserted_pwd.addEventListener("change", generatePassword);
div_gen_prefs.addEventListener("change", temporarySavePreferences);
// in_tab_pdl.addEventListener("change", showUI);


// var backgroundPort = browser.runtime.connect({name:"popup-port"}); //connect to backround.js

// backgroundPort.onMessage.addListener(function(m) {
//   console.log(m);
// });