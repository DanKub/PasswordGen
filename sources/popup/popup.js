var in_tab_domain = document.getElementById("in_tab_domain");
var in_tab_pdl = document.getElementById("in_tab_pdl");
var in_pdl_datalist = document.getElementById("pdl_datalist");
var in_inserted_pwd = document.getElementById("in_inserted_pwd");
var in_generated_pwd = document.getElementById("in_generated_pwd");
var div_description = document.getElementById("div_description");
var p_description = document.getElementById("p_description");

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

            reqDomain.onsuccess = function(){
                var storedRuleDomain = reqDomain.result;

                //Ak sa nachadza aktualna domena v DB, vypln inputy hodnotami z DB
                if(storedRuleDomain != null){
                    in_tab_domain.value = tabDomain;
                    in_tab_pdl.value = storedRuleDomain.pdl;
                    in_tab_pdl.readOnly = true;

                    p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_1"));

                    var b = document.createElement("b");
                    b.innerText = storedRuleDomain.domain;
                    p_description.insertAdjacentElement("beforeend", b);
                    p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_1_1"));

                    var br = document.createElement("br");
                    p_description.insertAdjacentElement("beforeend", br);

                    p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_2"));

                    b = document.createElement("b");
                    b.innerText = storedRuleDomain.pwdLength;
                    p_description.insertAdjacentElement("beforeend", b);
                    var plural = new Intl.PluralRules().select(storedRuleDomain.pwdLength);
                    if(plural == 'one'){
                        p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_3_one"));
                    }
                    else if(plural == "few"){
                        p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_3_few"));
                    }
                    else{
                        p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_3_other"));
                    }

                    b = document.createElement("b");
                    if(storedRuleDomain.b64Enc == "true"){
                        b.innerText = "Base-64";
                    }
                    else if(storedRuleDomain.hexEnc == "true"){
                        b.innerText = "HEX";
                    }
                    p_description.insertAdjacentElement("beforeend", b);
                    p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_4"));

                    createParentDomainsList();
                }

                //Inac skontroluj este ci sa nenachadza v DB nahodou PDL aktualnej domeny
                else{
                    var indexPdl = rulesObjStore.index("pdl");
                    var reqPdl = indexPdl.get(tabPdl);

                    reqPdl.onsuccess = function(){
                        var storedRulePdl = reqPdl.result;
                        in_tab_domain.value = tabDomain;
                        in_tab_pdl.value = tabPdl;

                        // Ak sa v DB nachadza PDL aktualnej domeny, tak vypln inputy a nastavenia generatora z ulozeneho pravidla z DB
                        // Zobraz tieto inputy... to vsetko iba v pripade, ze na takuto neulozenu domenu sme natrafili 1. krat.
                        if(storedRulePdl != null){

                            p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_1"));

                            var b = document.createElement("b");
                            b.innerText = in_tab_domain.value;
                            p_description.insertAdjacentElement("beforeend", b);
                            p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_2_1"));
        
                            b = document.createElement("b");
                            b.innerText = "*." + storedRulePdl.pdl;
                            p_description.insertAdjacentElement("beforeend", b);
                            p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_2_2"));

                            var br = document.createElement("br");
                            p_description.insertAdjacentElement("beforeend", br);

                            p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_2"));

                            b = document.createElement("b");
                            b.innerText = storedRulePdl.pwdLength;
                            p_description.insertAdjacentElement("beforeend", b);
                            var plural = new Intl.PluralRules().select(storedRulePdl.pwdLength);
                            if(plural == 'one'){
                                p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_3_one"));
                            }
                            else if(plural == "few"){
                                p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_3_few"));
                            }
                            else{
                                p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_3_other"));
                            }
        
                            b = document.createElement("b");
                            if(storedRulePdl.b64Enc == "true"){
                                b.innerText = "Base-64";
                            }
                            else if(storedRulePdl.hexEnc == "true"){
                                b.innerText = "HEX";
                            }
                            p_description.insertAdjacentElement("beforeend", b);
                            p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_4"));


                            temporarySavePreferences(storedRulePdl.pwdLength, storedRulePdl.b64Enc == "true", storedRulePdl.hexEnc == "true");
                            createParentDomainsList();
                        }

                        //Ak nie je v DB ulozene nic (ani domena ani PDL tejto domeny), vypln inputy podla aktualneho tabu
                        else{
                            in_tab_domain.value = tabDomain;
                            in_tab_pdl.value = tabPdl;

                            p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_1"));

                            var b = document.createElement("b");
                            b.innerText = in_tab_domain.value;
                            p_description.insertAdjacentElement("beforeend", b);
                            p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_3_1"));

                            var br = document.createElement("br");
                            p_description.insertAdjacentElement("beforeend", br);

                            p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_2"));

                            b = document.createElement("b");
                            b.innerText = preferences.length;
                            p_description.insertAdjacentElement("beforeend", b);
                            var plural = new Intl.PluralRules().select(preferences.length);
                            if(plural == 'one'){
                                p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_3_one"));
                            }
                            else if(plural == "few"){
                                p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_3_few"));
                            }
                            else{
                                p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_3_other"));
                            }

                            b = document.createElement("b");
                            if(preferences.base64 == true){
                                b.innerText = "Base-64";
                            }
                            else if(preferences.hex == true){
                                b.innerText = "HEX";
                            }
                            p_description.insertAdjacentElement("beforeend", b);
                            p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_4"));


                            createParentDomainsList();
                        }
                    }
                }
            }
        }
        else{
            in_tab_domain.value = tabDomain;
            in_tab_pdl.value = tabPdl;

            p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_1"));

            var b = document.createElement("b");
            b.innerText = in_tab_domain.value;
            p_description.insertAdjacentElement("beforeend", b);
            p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_3_1"));

            var br = document.createElement("br");
            p_description.insertAdjacentElement("beforeend", br);

            p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_2"));

            b = document.createElement("b");
            b.innerText = preferences.length;
            p_description.insertAdjacentElement("beforeend", b);
            var plural = new Intl.PluralRules().select(preferences.length);
            if(plural == 'one'){
                p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_3_one"));
            }
            else if(plural == "few"){
                p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_3_few"));
            }
            else{
                p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_3_other"));
            }

            b = document.createElement("b");
            if(preferences.base64 == true){
                b.innerText = "Base-64";
            }
            else if(preferences.hex == true){
                b.innerText = "HEX";
            }
            p_description.insertAdjacentElement("beforeend", b);
            p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_4"));


            createParentDomainsList();
        }
    }
}

function validatePdl(pdl){
    // Odstranim vsetky nevalidne znaky
    pdl = pdl.replace(/[^A-Za-z0-9.-]/g, "");
    // Zo zaciatku odstranim bodky a pomlcky
    pdl = pdl.replace(/^(\.+)|^(-+)/g, "");
    // Viacero pomlciek za sebou nahradim iba jednou
    pdl = pdl.replace(/-{2,}/g, "-");
    // Za pomlckou nesmie nasledovat bodka
    pdl = pdl.replace(/\-./g,".");
    // Viacero bodiek za sebou nahradim iba jednou
    pdl = pdl.replace(/\.{2,}/g, ".");
    // Z konca odstranim bodky a pomlcky
    pdl = pdl.replace(/(\.|-)+$/g, "");

    return pdl;
}

function onChangeInPdl(event){
    if(!event.isTrusted){
        console.log("The event is not trusted");
        return;
    }

    var changedPdl = validatePdl(event.target.value);
    in_tab_pdl.value = changedPdl;

    // Ak je pdl po validacii rovnaka ako pred zmenou, tak nerobim nic
    if(changedPdl == event.target.value){
        return;
    }
    
    var transaction = genRulesDB.transaction(["rules"], "readonly");
    var rulesObjStore = transaction.objectStore("rules");
    var indexPdl = rulesObjStore.index("pdl");
    var reqPdl = indexPdl.get(changedPdl);

    reqPdl.onsuccess = function(){
        var storedRulePdl = reqPdl.result;

        // Ak sa v DB nachadza PDL aktualnej domeny...
        if(storedRulePdl != null){
            div_description.children[0].remove();
            var p_description = document.createElement("p");
            p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_1"));

            var b = document.createElement("b");
            b.innerText = in_tab_domain.value;
            p_description.insertAdjacentElement("beforeend", b);
            p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_2_1"));

            b = document.createElement("b");
            b.innerText = "*." + storedRulePdl.pdl;
            p_description.insertAdjacentElement("beforeend", b);
            p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_2_2"));

            var br = document.createElement("br");
            p_description.insertAdjacentElement("beforeend", br);

            p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_2"));

            b = document.createElement("b");
            b.innerText = storedRulePdl.pwdLength;
            p_description.insertAdjacentElement("beforeend", b);
            var plural = new Intl.PluralRules().select(storedRulePdl.pwdLength);
            if(plural == 'one'){
                p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_3_one"));
            }
            else if(plural == "few"){
                p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_3_few"));
            }
            else{
                p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_3_other"));
            }

            b = document.createElement("b");
            if(storedRulePdl.b64Enc == "true"){
                b.innerText = "Base-64";
            }
            else if(storedRulePdl.hexEnc == "true"){
                b.innerText = "HEX";
            }
            p_description.insertAdjacentElement("beforeend", b);
            p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_4"));

            div_description.appendChild(p_description);


            temporarySavePreferences(storedRulePdl.pwdLength, storedRulePdl.b64Enc == "true", storedRulePdl.hexEnc == "true");
        }

        //Ak nie je v DB ulozene nic (ani domena ani PDL tejto domeny)
        else{
            // Nacitat temporary pravidla (od zaciatku nacitania stranky mohli byt zmenene)
            var p = browser.storage.local.get();
            p.then(
                item => {
                    preferences.length = item.length;
                    preferences.constant = item.constant;
                    preferences.base64 = item.base64;
                    preferences.hex = item.hex;
                    preferences.time = item.time;
                    preferences.store = item.store;
                    preferences.use_stored = item.use_stored;

                    div_description.children[0].remove();
                    var p_description = document.createElement("p");
                    p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_1"));

                    var b = document.createElement("b");
                    b.innerText = in_tab_domain.value;
                    p_description.insertAdjacentElement("beforeend", b);
                    p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_3_1"));

                    var br = document.createElement("br");
                    p_description.insertAdjacentElement("beforeend", br);

                    p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_2"));

                    b = document.createElement("b");
                    b.innerText = preferences.length;
                    p_description.insertAdjacentElement("beforeend", b);
                    var plural = new Intl.PluralRules().select(preferences.length);
                    if(plural == 'one'){
                        p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_3_one"));
                    }
                    else if(plural == "few"){
                        p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_3_few"));
                    }
                    else{
                        p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_3_other"));
                    }

                    b = document.createElement("b");
                    if(preferences.base64 == true){
                        b.innerText = "Base-64";
                    }
                    else if(preferences.hex == true){
                        b.innerText = "HEX";
                    }
                    p_description.insertAdjacentElement("beforeend", b);
                    p_description.insertAdjacentText("beforeend", browser.i18n.getMessage("popup_description_C_4"));

                    div_description.appendChild(p_description);
                }
            );
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
        var parentObject;
        var replaceParent = false;

        // Ak je ulozeny aspon 1, tak ten zaznam budem povazovat za rodica, pripisem mu aktualnu domenu ako dieta.
        if(storedRulePdl.length > 0){
            if (storedRulePdl.length == 1 && storedRulePdl[0].childs == null){
                storedRulePdl[0].childs = [];
            }
            //Najdem si rodica
            for (var i = 0; i < storedRulePdl.length; i++){
                if(storedRulePdl[i].childs != null){
                    parentObject = storedRulePdl[i];
                    // ak aktualna domena je suffixom uz nejakej ulozenej (ma subdomeny z hladiska DNS), tak sa z nej dalej stane rodic a zdedi vsetky decka od povodneho rodica
                    publicSuffixList.parse(suffListData, punycode.toASCII);
                    var publicSuffix = publicSuffixList.getPublicSuffix(in_tab_domain.value);
                    var tabDomainWoSuffix = in_tab_domain.value.substr(0, in_tab_domain.value.indexOf(publicSuffix) - 1);
                    publicSuffix = publicSuffixList.getPublicSuffix(parentObject.domain);
                    var parentDomainWoSuffix = parentObject.domain.substr(0, parentObject.domain.indexOf(publicSuffix) - 1);
                    if(parentDomainWoSuffix.endsWith(("." + tabDomainWoSuffix))){
                        replaceParent = true;
                        break;
                    }
                    // Rodicovi pridam aktualnu domenu ako dieta
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
            // Dietatu pridam 
            if(replaceParent == false){
                rulesObjStore.put({ domain: in_tab_domain.value, 
                    pwdLength: preferences.length,
                    b64Enc: String(preferences.base64),
                    hexEnc: String(preferences.hex),
                    pdl: in_tab_pdl.value,
                    parent: parentObject.domain,
                  }, in_tab_domain.value);
            }
        }
        // Ak nie je ulozeny ziadny zaznam s rovnakou PDL, tak nerobim, ziadne specialne zmeny. Zaznam nebude ani rodic ani dieta.
        else{
            rulesObjStore.put({ domain: in_tab_domain.value, 
                pwdLength: preferences.length,
                b64Enc: String(preferences.base64),
                hexEnc: String(preferences.hex),
                pdl: in_tab_pdl.value,
              }, in_tab_domain.value);
        }
        
        if(replaceParent){
            parentObject.childs.push(parentObject.domain);  // V povodnom rodicovskom objekte pridam do zoznamu deti samotnu rodicovsku domenu (kedze sa z nej stane dieta)
            rulesObjStore.put({ domain: in_tab_domain.value, 
                pwdLength: preferences.length,
                b64Enc: String(preferences.base64),
                hexEnc: String(preferences.hex),
                pdl: in_tab_pdl.value,
                childs: parentObject.childs,
              }, in_tab_domain.value);

            for (var i = 0; i < parentObject.childs.length; i++){ //vsetkym detom prepisem povodneho rodica na noveho rodica
                rulesObjStore.put({ domain: parentObject.childs[i], 
                    pwdLength: preferences.length,
                    b64Enc: String(preferences.base64),
                    hexEnc: String(preferences.hex),
                    pdl: in_tab_pdl.value,
                    parent: in_tab_domain.value,
                    }, parentObject.childs[i]);
            }
        }
    }
}

// Generovanie hesla
function generatePassword(event){
    if(!event.isTrusted){
        console.log("The event is not trusted");
        return;
    }
    // Vstupny retazec zahashujem N krat a vyplujem ho do pozadovaneho kodovania (B64/ENC)
    async function hashNTimes(strToHash, b64Enc, hexEnc, N){
        if (String(b64Enc) == "true" && String(hexEnc) == "false"){
            const pwd = await b64_sha512(strToHash, N);
            return pwd;
        }
        else if (String(hexEnc) == "true" && String(b64Enc) == "false"){
            const pwd = await hex_sha512(strToHash, N);
            return pwd;
        }
    }

    async function hex_sha512(message, N) {
        // encode as UTF-8
        const msgBuffer = new TextEncoder('utf-8').encode(message);
    
        // hash the message N times
        var hashBuffer = await crypto.subtle.digest('SHA-512', msgBuffer);
        for (let i = 1; i < N; i++){
            hashBuffer = await crypto.subtle.digest('SHA-512', hashBuffer);
        }
        
        // convert ArrayBuffer to Array
        const hashArray = Array.from(new Uint8Array(hashBuffer));
    
        // convert bytes to hex string
        const hashHex = hashArray.map(b => ('00' + b.toString(16)).slice(-2)).join('');
    
        // return hashHex;
        return hashHex;
    }
    
    async function b64_sha512(message, N) {
        // encode as UTF-8
        const msgBuffer = new TextEncoder('utf-8').encode(message);
    
        // hash the message N times
        var hashBuffer = await crypto.subtle.digest('SHA-512', msgBuffer);
        
        for (let i = 1; i < N; i++){
            hashBuffer = await crypto.subtle.digest('SHA-512', hashBuffer);
        }
    
        // convert ArrayBuffer to Array
        const hashArray = Array.from(new Uint8Array(hashBuffer));
    
        // convert bytes to base64
        const hashB64 = btoa(String.fromCharCode.apply(null, new Uint8Array(hashBuffer)));
    
        // return hashHex;
        return hashB64;
    }

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
                hashNTimes(strToHash, storedRule.b64Enc, storedRule.hexEnc, 1000).then( pwd => {
                    in_generated_pwd.value = pwd.substring(0,storedRule.pwdLength);
                    copyToClipboard();
                    showPassword();
                });
            }
            // ak nenasiel, tak generuje s aktualnymi nastaveniami generatora a nasledne ulozi tieto nastavenia ako nove pravidlo
            else{
                console.log("Rule with domain name '" + in_tab_domain.value + "' was not found in DB");
                console.log("Generating password with current generator preferences");
                var strToHash = in_inserted_pwd.value + in_tab_pdl.value + preferences.constant;
                hashNTimes(strToHash, preferences.base64, preferences.hex, 1000).then( pwd => {
                    in_generated_pwd.value = pwd.substring(0,preferences.length);
                    copyToClipboard();
                    showPassword();
                });

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
                hashNTimes(strToHash, storedRule.b64Enc, storedRule.hexEnc, 1000).then( pwd => {
                    in_generated_pwd.value = pwd.substring(0,storedRule.pwdLength);
                    copyToClipboard();
                    showPassword();
                });
            }
            // ak nenasiel tak musim upozornit pouzivatela. Zaroven nic negenerujem a ani neukladam.
            else {
                console.log("Rule with domain name '" + in_tab_domain.value + "' was not found in DB");
                alert(browser.i18n.getMessage("popup_alert_rule_not_found"));
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

            // ak nasiel ulozenu domenu v DB tak nechavam bez zmeny
            if (storedRule != null){
                ;
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
        hashNTimes(strToHash, preferences.base64, preferences.hex, 1000).then( pwd => {
            in_generated_pwd.value = pwd.substring(0,preferences.length);
            copyToClipboard();
            showPassword();
        });

    }
    //NEGENERUJ Z ULOZENYCH PRAVIDIEL A NEUKLADAJ PRAVIDLA
    else if(preferences.use_stored == false && preferences.store == false){
        console.log("Generating password with current generator preferences");
        var strToHash = in_inserted_pwd.value + in_tab_pdl.value + preferences.constant;
        hashNTimes(strToHash, preferences.base64, preferences.hex, 1000).then( pwd => {
            in_generated_pwd.value = pwd.substring(0,preferences.length);
            copyToClipboard();
            showPassword();
        });
    }
}

function showPassword(){
    if(Number(preferences.time) > 0){
        in_generated_pwd.type = "text";
        setTimeout(function hidePassord(){in_generated_pwd.type = "password";}, Number(preferences.time) * 1000);
    }
}

function copyToClipboard(){
    in_generated_pwd.type="text";
    in_generated_pwd.select();
    document.execCommand("copy");
    in_generated_pwd.type="password";
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
}

/*
Store preferences in variable while popup window is not closed
*/
function temporarySavePreferences(pwdLength, base64, hex) {
    preferences.length = pwdLength;
    preferences.base64 = base64;
    preferences.hex = hex;
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

in_inserted_pwd.focus();
in_inserted_pwd.addEventListener("change", generatePassword);
in_tab_pdl.addEventListener("change", onChangeInPdl);

// Localisation
document.getElementById("strong_domain").textContent = browser.i18n.getMessage("popup_inputlabel_domain");
document.getElementById("strong_pdl").textContent = browser.i18n.getMessage("popup_inputlabel_pdl");
document.getElementById("strong_pwd").textContent = browser.i18n.getMessage("popup_inputlabel_pwd");
document.getElementById("strong_generatedpwd").textContent = browser.i18n.getMessage("popup_inputlabel_generatedpwd");