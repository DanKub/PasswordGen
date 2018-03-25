var in_pwd_length = document.getElementById("in_pwd_length");
var in_constant = document.getElementById("in_constant");
var rb_base64 = document.getElementById("rb_base64");
var rb_hex = document.getElementById("rb_hex");
var in_time = document.getElementById("in_time");

var cb_store = document.getElementById("cb_store");
var cb_use_stored = document.getElementById("cb_use_stored");
var btn_del_all_rules = document.getElementById("btn_del_all_rules");
var table = document.getElementById("table_stored_rules");
var btn_export = document.getElementById("btn_export");
var in_import = document.getElementById("in_import");

var genRulesDB;

var minPwdLen = 1;
var maxPwdLen = 64;


/*
Store the currently selected settings using browser.storage.local.
*/
function savePreferences() {
    var preferences = {
        length: in_pwd_length.value,
        constant: in_constant.value,
        base64: rb_base64.checked,
        hex: rb_hex.checked,
        time: in_time.value,
        store: cb_store.checked,
        use_stored: cb_use_stored.checked
    }
    var p = browser.storage.local.set(preferences);
    p.then(null, onError);
}

/*
On opening the options page, fetch stored settings and update the UI with them.
*/
function loadPreferences() {
    var p = browser.storage.local.get();
    p.then(updateUI, onError);
}

/*
Update the options UI with the settings values retrieved from storage
*/
function updateUI(item) {
    in_pwd_length.value = item.length;
    in_constant.value = item.constant;
    rb_base64.checked = item.base64;
    rb_hex.checked = item.hex;
    in_time.value = item.time;
    cb_store.checked = item.store;
    cb_use_stored.checked = item.use_stored;

    loadTableRules();
}

function onError(err) {
    console.error(err);
}

function loadTableRules(){
    // Show Generator rules from GenRules DB
    var transaction = genRulesDB.transaction(["rules"], "readonly");
    var objStore = transaction.objectStore("rules");
    var index = objStore.index("pdl");
    var reqCursor = index.openCursor();

    deleteTableRules();
    reqCursor.onsuccess = function() {
        var cursor = reqCursor.result;
        if(cursor){
            // Ak ma zaznam deti -> je rodic
            if(cursor.value.childs){
                // Do tabulky vloz najprv rodica
                insertNewTableEntry(cursor.value.domain, Number(cursor.value.pwdLength), cursor.value.b64Enc == "true" , cursor.value.hexEnc == "true", cursor.value.pdl, cursor.value.parent != null);
                
                var reqPdl = index.getAll(cursor.value.pdl);
                reqPdl.onsuccess = function(){
                    // Do tabulky vloz postupne vsetky deti, ktore ma rodic
                    for(var i = 0; i < cursor.value.childs.length; i++){
                        for(var j = 0; j < reqPdl.result.length; j++){
                            if (cursor.value.childs[i] == reqPdl.result[j].domain){
                                insertNewTableEntry(reqPdl.result[j].domain, Number(reqPdl.result[j].pwdLength), reqPdl.result[j].b64Enc == "true" , reqPdl.result[j].hexEnc == "true", reqPdl.result[j].pdl, reqPdl.result[j].parent != null);
                            }
                        }
                    }
                }
            }
            // Ak zaznam nema rodica
            else if(cursor.value.parent == null) {
                insertNewTableEntry(cursor.value.domain, Number(cursor.value.pwdLength), cursor.value.b64Enc == "true" , cursor.value.hexEnc == "true", cursor.value.pdl, cursor.value.parent != null);
            }
            cursor.continue();
        }
        else {
            console.log('Entries all displayed.');    
        }
    }
}
 //TODO: UPDATE TABLE RULES BY DOMAN NAME
function deleteTableRules(){
    for (var i = table.rows.length - 1; i > 0; i--){
        table.deleteRow(i);
    }
}

function validatePwdLen(pwdLen){
    pwdLen = pwdLen.replace(/\D+/g, "");
    if(pwdLen < 1){
        pwdLen = 1;
    }
    else if(pwdLen > 64){
        pwdLen = 64;
    }
    return pwdLen;
}

function validatePdl(pdl){
    // Odstranim vsetky nevalidne znaky a zo zaciatku bodku alebo cislo
    pdl = pdl.replace(/[^A-Za-z0-9.]/g, "");
    if(pdl.charAt(0).match(/[.\d]/)){
        pdl = pdl.slice(1);
    }
    return pdl;
}

function updateUIChildRules(ruleChilds, parentNode){
    for (var i = 0; i < ruleChilds.length; i++){
        for (var j = 1; j < table.rows.length; j++){
            if (table.rows[j].children[0].firstChild.data == ruleChilds[i]){
                table.rows[j].children[1].firstChild.value = parentNode.cells[1].firstChild.value;
                table.rows[j].children[2].firstChild.checked = parentNode.cells[2].firstChild.checked;
                table.rows[j].children[3].firstChild.checked = parentNode.cells[3].firstChild.checked;
            }
        }
    }
}


function updateStoredRule(event){
    var node = event.target;
    while(node.nodeName != "TR"){   //preiterujem sa na riadok v tabulke, v ktorom nastala nejaka zmena
        node = node.parentElement;
    }

    node.cells[1].firstChild.value = validatePwdLen(node.cells[1].firstChild.value);
    node.cells[4].firstChild.value = validatePdl(node.cells[4].firstChild.value);

    var transaction = genRulesDB.transaction(["rules"], "readwrite");
    var rulesObjStore = transaction.objectStore("rules");
    var indexDomain = rulesObjStore.index("domain");

    var reqDomain = indexDomain.get(node.cells[0].firstChild.data);
    reqDomain.onsuccess = function(){
        var storedRule = reqDomain.result;

        //Ak zaznam ktory idem menit nema deti
        if (storedRule.childs == null){
            //Ak nema deti a ma rodica, tak zmenim iba dany (detsky) zaznam a oddelim ho od hlavneho stromu ako novy strom
            if(storedRule.parent){
                rulesObjStore.put({ domain: node.cells[0].firstChild.data, 
                                    pwdLength: node.cells[1].firstChild.value,
                                    b64Enc: String(node.cells[2].firstChild.checked),
                                    hexEnc: String(node.cells[3].firstChild.checked),
                                    pdl: node.cells[0].firstChild.data, // zmena pdl na domain name -> takto vznikne novy strom
                                    }, node.cells[0].firstChild.data);

                node.cells[4].firstChild.value = node.cells[0].firstChild.data; // prepisem pld zaznam v UI

                // Odstranenie zaznamu od rodica (nakolko zo zmeneneho zaznamu je teraz samostatny strom)
                // vyziadam si jeho rodica a odstranim ho odtial
                var reqParentDomain = indexDomain.get(storedRule.parent);
                reqParentDomain.onsuccess = function(){
                    var storedParentRule = reqParentDomain.result;
                    var parentChilds = storedParentRule.childs;
                    parentChilds.splice(parentChilds.indexOf(storedRule.domain), 1);
    
                    // Ak rodic po vymazani childa obsahuje este ine deti
                    if(storedParentRule.childs.length > 0){
                        rulesObjStore.put({ domain: storedParentRule.domain, 
                                            pwdLength: storedParentRule.pwdLength,
                                            b64Enc: storedParentRule.b64Enc,
                                            hexEnc: storedParentRule.hexEnc,
                                            pdl: storedParentRule.pdl,
                                            childs: storedParentRule.childs,
                                            }, storedParentRule.domain);
                    }
                    // Ak to bol posledny detsky zaznam, tak vymaz property 'childs'
                    else{
                        rulesObjStore.put({ domain: storedParentRule.domain, 
                                            pwdLength: storedParentRule.pwdLength,
                                            b64Enc: storedParentRule.b64Enc,
                                            hexEnc: storedParentRule.hexEnc,
                                            pdl: storedParentRule.pdl,
                                            }, storedParentRule.domain);
                    }
                }
            }

            //Ak zaznam, ktory idem menit nema deti ani rodica
            else{
                rulesObjStore.put({ domain: node.cells[0].firstChild.data, 
                                    pwdLength: node.cells[1].firstChild.value,
                                    b64Enc: String(node.cells[2].firstChild.checked),
                                    hexEnc: String(node.cells[3].firstChild.checked),
                                    pdl: node.cells[4].firstChild.value,
                                    }, node.cells[0].firstChild.data);
            }
        }

        // Zaznam ktory idem menit MA DETI. Treba ich vsetky zmenit podla rodica (aktualneho zaznamu).
        else {
            // Zmena aktualneho (rodicovskeho) zaznamu, ktory user zmenil cez GUI
            rulesObjStore.put({ domain: node.cells[0].firstChild.data, 
                                pwdLength: node.cells[1].firstChild.value,
                                b64Enc: String(node.cells[2].firstChild.checked),
                                hexEnc: String(node.cells[3].firstChild.checked),
                                pdl: node.cells[4].firstChild.value,
                                childs: storedRule.childs,
                                }, node.cells[0].firstChild.data);

            updateUIChildRules(storedRule.childs, node); // zmena detskych zaznamov v tabulke GUI

            // Zmena detskych zaznamov v DB
            for (var i = 0; i < storedRule.childs.length; i++){
                rulesObjStore.put({ domain: storedRule.childs[i], 
                                    pwdLength: node.cells[1].firstChild.value,
                                    b64Enc: String(node.cells[2].firstChild.checked),
                                    hexEnc: String(node.cells[3].firstChild.checked),
                                    pdl: node.cells[4].firstChild.value,
                                    parent: storedRule.domain,
                                    }, storedRule.childs[i]);
            }
        }
    }
}

function deleteStoredRule(event){
    var node = event.target;
    while(node.nodeName != "TR"){   //preiterujem sa na riadok v tabulke, v ktorom nastala nejaka zmena
        node = node.parentElement;
    }

    var transaction = genRulesDB.transaction(["rules"], "readwrite");
    var rulesObjStore = transaction.objectStore("rules");
    var indexDomain = rulesObjStore.index("domain");

    var reqDomain = indexDomain.get(node.cells[0].firstChild.data);
    reqDomain.onsuccess = function(){
        // Ak zaznam, ktory chcem vymazat je rodic
        if(reqDomain.result.childs){
            for(var i = 0; i < reqDomain.result.childs.length; i++){
                rulesObjStore.delete(reqDomain.result.childs[i]); // Vymazanie detskych zaznamov v DB

                for (var j = 1; j < table.rows.length; j++){
                    if (table.rows[j].children[0].firstChild.data == reqDomain.result.childs[i]){
                        table.rows[j].remove(); // Vymazanie detskych zaznamov v tabulke GUI
                    }
                }
            }
            rulesObjStore.delete(reqDomain.result.domain); // Vymazanie rodica v DB
            node.remove(); // Vymazanie rodica z tabulky GUI
        }

        // Ak zaznam ktory chcem vymazat je dieta
        else if(reqDomain.result.parent){
            // Detsky zaznam bude vymazany a v jeho rodicovi ho teda musim odstranit zo zoznamu deti
            var reqParentDomain = indexDomain.get(reqDomain.result.parent);
            reqParentDomain.onsuccess = function(){
                var storedParentRule = reqParentDomain.result;
                var parentChilds = storedParentRule.childs;
                parentChilds.splice(parentChilds.indexOf(reqDomain.result.domain), 1);

                // Ak rodic po vymazani childa obsahuje este ine deti
                if(storedParentRule.childs.length > 0){
                    rulesObjStore.put({ domain: storedParentRule.domain, 
                                        pwdLength: storedParentRule.pwdLength,
                                        b64Enc: storedParentRule.b64Enc,
                                        hexEnc: storedParentRule.hexEnc,
                                        pdl: storedParentRule.pdl,
                                        childs: storedParentRule.childs,
                                        }, storedParentRule.domain);
                }
                // Ak to bol posledny detsky zaznam, tak vymaz property 'childs'
                else{
                    rulesObjStore.put({ domain: storedParentRule.domain, 
                                        pwdLength: storedParentRule.pwdLength,
                                        b64Enc: storedParentRule.b64Enc,
                                        hexEnc: storedParentRule.hexEnc,
                                        pdl: storedParentRule.pdl,
                                        }, storedParentRule.domain);
                }
                rulesObjStore.delete(reqDomain.result.domain); // Vymazanie zaznamu v DB
            }
            node.remove(); // Vymazanie zaznamu v tabulke GUI
        }

        // Zaznam nema rodica ani dieta
        else{
            rulesObjStore.delete(reqDomain.result.domain);
            node.remove();
        }
    }
}

function deleteAllStoredRules(){
    deleteTableRules();
    var transaction = genRulesDB.transaction(["rules"], "readwrite");
    var rulesObjStore = transaction.objectStore("rules");
    rulesObjStore.clear();
}

function insertNewTableEntry(domain, pwdLength, base64Check, hexCheck, pdl, isChild){
    var row = table.insertRow();
    var domainCell = row.insertCell();
    var pwdLengthCell = row.insertCell();
    var base64Cell = row.insertCell();
    var hexCell = row.insertCell();
    var pdlCell = row.insertCell();
    var delIconCell = row.insertCell();

    // pwdLengthCell.contentEditable = "true";
    // pdlCell.contentEditable = "true";

    var radioBase64Input = document.createElement("input");
    radioBase64Input.setAttribute("type", "radio");
    radioBase64Input.setAttribute("name", "encoding_row" + row.rowIndex);
    var radioHexInput = radioBase64Input.cloneNode(true);

    if (isChild){
        domainCell.setAttribute("class", "children");
    }

    delIconCell.setAttribute("style", "text-align: center;");

    var pdlCellInput = document.createElement("input");
    pdlCellInput.type = "text";
    pdlCellInput.pattern = "([[a-z0-9]+\.)*[a-z0-9]+\.[a-z0-9]+";

    var pwdLengthCellInput = document.createElement("input");
    pwdLengthCellInput.type = "text";

    var delIcon = document.createElement("i");
    delIcon.className = "material-icons";
    delIcon.innerText = "delete";
    delIcon.addEventListener("click", deleteStoredRule);

    domainCell.textContent = domain;
    pwdLengthCellInput.value = pwdLength;
    radioBase64Input.checked = base64Check;
    radioHexInput.checked = hexCheck;
    pdlCellInput.value = pdl;

    pwdLengthCell.appendChild(pwdLengthCellInput);
    base64Cell.appendChild(radioBase64Input);
    hexCell.appendChild(radioHexInput);
    pdlCell.appendChild(pdlCellInput);
    delIconCell.appendChild(delIcon);
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

function exportSettings(){
    var retrievePrefs = browser.storage.local.get(); // Ziskaj lokalne ulozene nastavenia generatora
    retrievePrefs.then(
        function(preferences){
            var exportObject = {};
            exportObject.preferences = preferences; // Do objektu, kt. sa bude exportovat vloz ziskane nastavenia

            var transaction = genRulesDB.transaction(["rules"], "readonly");
            var objStore = transaction.objectStore("rules");
            var index = objStore.index("domain");
            var reqAllRules = index.getAll();

            reqAllRules.onsuccess = function(){
                exportObject.rules = reqAllRules.result;    // Do objektu, kt. sa bude exportovat vloz vsetky ziskane pravidla z DB
                var blob = new Blob([JSON.stringify(exportObject, null, 4)], {type : 'application/json'});
                var url = URL.createObjectURL(blob);
                browser.runtime.getPlatformInfo().then(info => {
                    var downloading;
                    if (info.os == "android"){
                        downloading = browser.downloads.download(
                            {
                                url: url,
                                filename: "passgen_settings.json",
                            }
                        );
                    }
                    else{
                        downloading = browser.downloads.download(
                            {
                                url: url,
                                filename: "passgen_settings.json",
                                incognito: true,
                                saveAs: true
                            }
                        );
                    }
                    downloading.then(null, onError);
                });
            }
        }, onError);
}

function importSettings(){
    var file = in_import.files[0];
    var maxFileSize = 10; // Max file size in MB

    if (file == null){
        return;
    }

    if(file.type != "application/json"){
        alert("Selected file is not JSON");
        return;
    }

    if(file.size > (maxFileSize*1024*1024)){
        alert("Selected file is too large");
        return;
    }

    var reader = new FileReader();
    reader.readAsText(file);
    reader.onload = function(event){

        if(isValidJson(event.target.result)){
            var importObj = JSON.parse(event.target.result);

            browser.storage.local.set(importObj.preferences); // nacitanie nastaveni z importovaneho objektu

            var transaction = genRulesDB.transaction(["rules"], "readwrite");
            var objStore = transaction.objectStore("rules");
            var clearReq = objStore.clear();
            clearReq.onsuccess = function(){

                // Nacitanie vsetkych pravidiel do DB z importovaneho objektu
                for(var i = 0; i < importObj.rules.length; i++){
                    objStore.put(importObj.rules[i], importObj.rules[i].domain).onerror = function(err){
                        console.error(err)
                    }
                }
                updateUI(importObj.preferences);
                in_import.value = null;
            }
        }
        else{
            return;
        }
    }
}

function isValidJson(data){
    try {
        var obj = JSON.parse(data);

        // Check Generator Preferences validity
        if (obj.preferences.length == undefined ||
            obj.preferences.constant == undefined ||
            obj.preferences.base64 == undefined ||
            obj.preferences.hex == undefined ||
            obj.preferences.time == undefined ||
            obj.preferences.store == undefined ||
            obj.preferences.use_stored == undefined){
            alert("Invalid Preference Name");
            return false;
        }
        if (typeof(obj.preferences.length) != "string" ||
            typeof(obj.preferences.constant) != "string" ||
            typeof(obj.preferences.base64) != "boolean" ||
            typeof(obj.preferences.hex) != "boolean" ||
            typeof(obj.preferences.time) != "string" ||
            typeof(obj.preferences.store) != "boolean" ||
            typeof(obj.preferences.use_stored) != "boolean"){
            alert("Invalid Preference Type");
            return false;
            }
        if(!obj.preferences.length.match(/^[0-9]+$/)){
            alert("Invalid PDWLEN value " + obj.preferences.length);
            return false;
        }
        if(parseInt(obj.preferences.length, 10) < minPwdLen || parseInt(obj.preferences.length, 10) > maxPwdLen){
            alert("Invalid PDWLEN value " + obj.preferences.length);
            return false;
        }
        if(!obj.preferences.time.match(/^[0-9]+$/)){
            alert("Invalid Time value " + obj.preferences.time);
            return false;
        }
        if(parseInt(obj.preferences.time, 10) < 0 || parseInt(obj.preferences.time, 10) > 60){
            alert("Invalid Time value " + obj.preferences.time);
            return false;
        }
        if(obj.preferences.constant.length > 100){
            alert("Invalid Constant length");
            return false;
        }

        // Check Stored Rules Validity
        for (var i = 0; i < obj.rules.length; i++){
            if (obj.rules[i].domain == undefined ||
                obj.rules[i].pwdLength == undefined ||
                obj.rules[i].b64Enc == undefined ||
                obj.rules[i].hexEnc == undefined ||
                obj.rules[i].pdl == undefined){
                alert("InvalidJSON");
                return false;
                }
            if (obj.rules[i].domain == null ||
                obj.rules[i].pwdLength == null ||
                obj.rules[i].b64Enc == null ||
                obj.rules[i].hexEnc == null ||
                obj.rules[i].pdl == null) {
                alert('invalidJSON');
                return false;
            }
            if (!obj.rules[i].pwdLength.match(/^[0-9]+$/)) {
                alert("Invalid PWDLEN value" + obj.rules[i].pwdLength);
                return false;
            }
            if (parseInt(obj.rules[i].pwdLength, 10) < minPwdLen || parseInt(obj.rules[i].pwdLength, 10) > maxPwdLen) {
                alert('Invalid PWDLEN value' + obj.rules[i].pwdLength);
                return false;
            }
            if (!(obj.rules[i].b64Enc == "true" || obj.rules[i].b64Enc == "false")) {
                alert("Ivalid b64 encoding");
                return false;
            }
            if (!(obj.rules[i].hexEnc == "true" || obj.rules[i].hexEnc == "false")) {
                alert("invalid HEX encoding");
                return false;
            }
        }
    } catch (error) {
        alert("Invalid JSON");
        return false;
    }
    return true;
}

openGenRulesDB();

document.addEventListener("change", savePreferences);
document.addEventListener("load", loadPreferences());
table.addEventListener("input", updateStoredRule);
btn_export.addEventListener("click", exportSettings);
in_import.addEventListener("change", importSettings);
btn_del_all_rules.addEventListener("click", deleteAllStoredRules);