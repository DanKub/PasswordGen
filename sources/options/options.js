var in_pwd_length = document.getElementById("in_pwd_length");
var in_constant = document.getElementById("in_constant");
var rb_base64 = document.getElementById("rb_base64");
var rb_hex = document.getElementById("rb_hex");
var in_time = document.getElementById("in_time");

var cb_store = document.getElementById("cb_store");
var cb_use_stored = document.getElementById("cb_use_stored");
var table = document.getElementById("table_stored_rules");

var genRulesDB;


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
        if(cursor) {
            insertNewTableEntry(cursor.value.domain, Number(cursor.value.pwdLength), cursor.value.b64Enc == "true" , cursor.value.hexEnc == "true", cursor.value.pdl);
            cursor.continue();
        } else {
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

    var reqDomain = indexDomain.get(node.cells[0].firstChild.value);
    reqDomain.onsuccess = function(){
        var storedRule = reqDomain.result;

        //Ak zaznam ktory idem menit nema deti, tak zmenim iba dany zaznam
        if (storedRule.childs == null){
            rulesObjStore.put({ domain: node.cells[0].firstChild.value, 
                                pwdLength: node.cells[1].firstChild.value,
                                b64Enc: String(node.cells[2].firstChild.checked),
                                hexEnc: String(node.cells[3].firstChild.checked),
                                pdl: node.cells[4].firstChild.value,
                                }, node.cells[0].firstChild.value);
        }

        // Zaznam ktory idem menit ma deti. Treba ich vsetky zmenit podla rodica (aktualneho zaznamu).
        else {
            // Zmena aktualneho zaznamu, ktory user zmenil cez GUI
            rulesObjStore.put({ domain: node.cells[0].firstChild.value, 
                                pwdLength: node.cells[1].firstChild.value,
                                b64Enc: String(node.cells[2].firstChild.checked),
                                hexEnc: String(node.cells[3].firstChild.checked),
                                pdl: node.cells[4].firstChild.value,
                                childs: storedRule.childs,
                                }, node.cells[0].firstChild.value);

            // Zmena detskych zaznamov v DB
            for (var i = 0; i < storedRule.childs.length; i++){
                rulesObjStore.put({ domain: storedRule.childs[i], 
                                    pwdLength: node.cells[1].firstChild.value,
                                    b64Enc: String(node.cells[2].firstChild.checked),
                                    hexEnc: String(node.cells[3].firstChild.checked),
                                    pdl: node.cells[4].firstChild.value,
                                    }, storedRule.childs[i]);
            }
            loadTableRules();
        }
    }
}

function insertNewTableEntry(domain, pwdLength, base64Check, hexCheck, pdl){
    var row = table.insertRow();
    var domainCell = row.insertCell();
    var pwdLengthCell = row.insertCell();
    var base64Cell = row.insertCell();
    var hexCell = row.insertCell();
    var pdlCell = row.insertCell();

    // pwdLengthCell.contentEditable = "true";
    // pdlCell.contentEditable = "true";

    var radioBase64Input = document.createElement("input");
    radioBase64Input.setAttribute("type", "radio");
    radioBase64Input.setAttribute("name", "encoding_row" + row.rowIndex);
    var radioHexInput = radioBase64Input.cloneNode(true);

    var domainCellInput = document.createElement("input");
    domainCellInput.type = "text";
    domainCellInput.pattern = "([[a-z0-9]+\.)*[a-z0-9]+\.[a-z0-9]+";
    var pdlCellInput = domainCellInput.cloneNode(true);
    domainCellInput.readOnly = true;

    var pwdLengthCellInput = document.createElement("input");
    pwdLengthCellInput.type = "text";

    domainCellInput.value = domain;
    pwdLengthCellInput.value = pwdLength;
    radioBase64Input.checked = base64Check;
    radioHexInput.checked = hexCheck;
    pdlCellInput.value = pdl;

    domainCell.appendChild(domainCellInput);
    pwdLengthCell.appendChild(pwdLengthCellInput);
    base64Cell.appendChild(radioBase64Input);
    hexCell.appendChild(radioHexInput);
    pdlCell.appendChild(pdlCellInput);
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

openGenRulesDB();

document.addEventListener("change", savePreferences);
document.addEventListener("load", loadPreferences());
table.addEventListener("input", updateStoredRule);