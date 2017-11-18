var suffListDB;

function putSuffListDataToDB(data){
    var transaction = suffListDB.transaction(["pubsufflist"], "readwrite");    
    var objStoreReq = transaction.objectStore("pubsufflist");
    objStoreReq.put(data, "psl");
}

function getLocalSuffList(filePath){
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", filePath, true);
    xmlHttp.responseType = "text";
    xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200){
            putSuffListDataToDB(xmlHttp.response);
        }
    }
    xmlHttp.send(null);
}

function initDB(){
    var dbOpenReq = window.indexedDB.open("PubSuffList");

    dbOpenReq.onerror = function(event){
        console.error("Database open request error: " + dbOpenReq.error);
    }

    dbOpenReq.onupgradeneeded = function(event){
        var db = event.target.result;
        var objectStore = db.createObjectStore("pubsufflist");
    }

    dbOpenReq.onsuccess = function(event){
        console.log("IndexedDB PubSuffList successfully open");
        suffListDB = event.target.result;
        getLocalSuffList("sufflist.dat");
    }
}

//TODO: Aktualizacia sufflistu v DB po mesiaci

initDB();



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