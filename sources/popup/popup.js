var in_tab_domain = document.getElementById("in_tab_domain");

let tab_query = browser.tabs.query({ currentWindow: true, active: true });
tab_query.then(getCurrentTabUrl, onError);

function getCurrentTabUrl(tabs) {
    in_tab_domain.value = tabs[0].url;
}

function onError(err) {
    console.error(err);
}
