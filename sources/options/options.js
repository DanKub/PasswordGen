var in_pwd_length = document.getElementById("in_pwd_length");
var in_constant = document.getElementById("in_constant");
var rb_base64 = document.getElementById("rb_base64");
var rb_hex = document.getElementById("rb_hex");
var in_time = document.getElementById("in_time");

var cb_store = document.getElementById("cb_store");
var cb_use_stored = document.getElementById("cb_use_stored");


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
}

function onError(err) {
    console.error(err);
}

function insertNewTableEntry(){
    var table = document.getElementById("table_stored_settings");
    var row = table.insertRow();
    var domainCell = row.insertCell();
    var pwdLengthCell = row.insertCell();
    var base64Cell = row.insertCell();
    var hexCell = row.insertCell();

    pwdLengthCell.contentEditable = "true";

    var radioBase64 = document.createElement("input");
    radioBase64.setAttribute("type", "radio");
    radioBase64.setAttribute("name", "encoding_row" + row.rowIndex);
    var radioHex = radioBase64.cloneNode(true);

    domainCell.innerHTML = "example";
    pwdLengthCell.innerHTML = row.rowIndex;
    base64Cell.appendChild(radioBase64);
    hexCell.appendChild(radioHex);
}

for(var i = 0; i < 10; i++){
    insertNewTableEntry();
}

document.addEventListener("change", savePreferences);
document.addEventListener("load", loadPreferences());
