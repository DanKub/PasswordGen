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

    // Show Generator rules from GenRules DB
    var transaction = genRulesDB.transaction(["rules"], "readonly");
    var objStore = transaction.objectStore("rules");
    var index = objStore.index("sld");
    var reqCursor = index.openCursor();

    reqCursor.onsuccess = function() {
        var cursor = reqCursor.result;
        if(cursor) {
            insertNewTableEntry(cursor.value.domain, Number(cursor.value.pwdLength), cursor.value.b64Enc == "true" , cursor.value.hexEnc == "true", cursor.value.sld);
            cursor.continue();
        } else {
            console.log('Entries all displayed.');    
        }
    }
}

function onError(err) {
    console.error(err);
}

function updateStoredRule(event){
    var node = event.target;
    while(node.nodeName != "TR"){   //preiterujem sa na riadok v tabulke, v ktorom nastala nejaka zmena
        node = node.parentElement;
    }
    var transaction = genRulesDB.transaction(["rules"], "readwrite");
    var rulesObjStore = transaction.objectStore("rules");
    rulesObjStore.put({ domain: node.cells[0].innerHTML, 
                        pwdLength: node.cells[1].innerHTML,
                        b64Enc: String(node.cells[2].firstChild.checked),
                        hexEnc: String(node.cells[3].firstChild.checked),
                        sld: node.cells[4].innerHTML,
                      }, node.cells[0].innerHTML)
}

function insertNewTableEntry(domain, pwdLength, base64Check, hexCheck, sld){
    table = document.getElementById("table_stored_rules");
    var row = table.insertRow();
    var domainCell = row.insertCell();
    var pwdLengthCell = row.insertCell();
    var base64Cell = row.insertCell();
    var hexCell = row.insertCell();
    var sldCell = row.insertCell();

    pwdLengthCell.contentEditable = "true";
    sldCell.contentEditable = "true";

    var radioBase64 = document.createElement("input");
    radioBase64.setAttribute("type", "radio");
    radioBase64.setAttribute("name", "encoding_row" + row.rowIndex);
    var radioHex = radioBase64.cloneNode(true);

    domainCell.innerHTML = domain;
    pwdLengthCell.innerHTML = pwdLength;
    radioBase64.checked = base64Check;
    radioHex.checked = hexCheck;
    base64Cell.appendChild(radioBase64);
    hexCell.appendChild(radioHex);
    sldCell.innerHTML = sld;
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