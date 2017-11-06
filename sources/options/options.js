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
    let preferences = {
        length: in_pwd_length.value,
        constant: in_constant.value,
        base64: rb_base64.checked,
        hex: rb_hex.checked,
        time: in_time.value,
        store: cb_store.checked,
        use_stored: cb_use_stored.checked
    }
    let p = browser.storage.local.set(preferences);
    p.then(null, onError);
}

/*
On opening the options page, fetch stored settings and update the UI with them.
*/
function loadPreferences() {
    let p = browser.storage.local.get();
    p.then(updateUI, onError);
}

/*
Update the options UI with the settings values retrieved from storage,
or the default settings if the stored settings are empty.
*/
function updateUI(item) {
    in_pwd_length.value = item.length || "15";
    in_constant.value = item.constant || "";
    rb_base64.checked = item.base64 || true;
    rb_hex.checked = item.hex || false;
    in_time.value = item.time || "0";
    cb_store.checked = item.store || true;
    cb_use_stored.checked = item.use_stored || true;
}

function onError(err) {
    console.error(err);
}


document.addEventListener("change", savePreferences);
document.addEventListener("load", loadPreferences());
