/*******************************************************************************
Copyright © 2016 Daniel Kubica

This file is part of PasswordGen.

   PasswordGen is free software: you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.

   PasswordGen is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with PasswordGen.  If not, see <http://www.gnu.org/licenses/>.
********************************************************************************
                 GitHub: https://github.com/DanKub/PasswordGen
*******************************************************************************/

/**
* @file PasswordGen is a single purpose password generator extension for Mozilla Firefox web browser.
* By user pre-specified preferences, this tool will generate same password on same domains every time.
* However on the other domains, generated password will be every time different.
* Users no longer have to remember all their different passwords what they use.
* With this extension users have and use only one password for all domains and PasswordGen will generate different password on every domain for them.
* @author Daniel Kubica
* @version 2.0
* @see {@link https://github.com/DanKub/PasswordGen}
*/

if ("undefined" == typeof(PassGen)) {
  var PassGen = {};
};

/**
* Namespace PassGen with its members, variables, objects and methods.
* @namespace PassGen
*/
PassGen = {
  prefsList : [
    {name:"b64Enc",type:"bool",value:true},
    {name:"hexEnc",type:"bool",value:false},
    {name:"isActive",type:"bool",value:true},
    {name:"lengthPass",type:"string",value:"15"},
    {name:"passShowTime",type:"string",value:"0"},
    {name:"useStored",type:"bool",value:true},
    {name:"store",type:"bool",value:true},
    {name:"const",type:"string",value:""},
  ],
  prefs: null,
  myDatabase: null,
  prefWin: null,
  minPassLen: 1,
  maxPassLen: 64,
  passBoxTarget: null,

  /**
  * Method is called after the web browser is started.
  * @function init
  */
  init(){
    PassGen.prefs = Components.classes["@mozilla.org/preferences-service;1"]
           .getService(Components.interfaces.nsIPrefService);
    PassGen.prefs = PassGen.prefs.getBranch("extensions.passwordgen.");
    PassGen.prefs.addObserver("", this, false);

    PassGen.prefers();
    PassGen.setIconStyle();

    Components.utils.import("resource://gre/modules/Services.jsm");
    Components.utils.import("resource://gre/modules/FileUtils.jsm");

    var dbFile = FileUtils.getFile("ProfD", ["passgendb.sqlite"]);
    PassGen.myDatabase = Services.storage.openDatabase(dbFile);
    if(!PassGen.myDatabase.tableExists("Prefs")){
      var statement = PassGen.myDatabase.createStatement("CREATE TABLE Prefs(domain varchar(200),lengthPass varchar(2), b64Enc varchar(5), hexEnc varchar(5), secondLDomain varchar(63))");
      statement.executeAsync();
      statement.reset();
      statement.finalize();
    }
  },

  /**
  * Method will be called when there is a notification for the topic that the observer has been registered for.
  * @function observe
  * @param {nsISupports} subject Reflects the object whose change or action is being observed.
  * @param {string} topic Indicates the specific change or action.
  * @param {wstring} data An optional parameter or other auxiliary data further describing the change or action.
  */
  observe(subject, topic, data){
    PassGen.prefers();
    PassGen.setIconStyle();
  },

  /**
  * Save current generator preferences to preference list.
  * @function prefers
  */
  prefers(){
    for( var i=0 ; i<PassGen.prefsList.length; i++){
      if (PassGen.prefsList[i].type == "string"){
        PassGen.prefsList[i].value = PassGen.prefs.getCharPref(PassGen.prefsList[i].name);
      }
      else {
        PassGen.prefsList[i].value = PassGen.prefs.getBoolPref(PassGen.prefsList[i].name);
      }
    }
    if(PassGen.prefsList[0].value == true){
      PassGen.prefs.setBoolPref(PassGen.prefsList[1].name, false);
    }
    if(PassGen.prefsList[0].value == false){
      PassGen.prefs.setBoolPref(PassGen.prefsList[1].name, true);
    }
  },

  /**
  * Activate or deactivate functionality of extension after icon clicked.
  * @function actDeact
  * @param event Event of the object.
  */
  actDeact(event){
    if(event && event.button != 0)
      return;
    if(PassGen.prefs.getBoolPref(PassGen.prefsList[2].name)==true){
      PassGen.prefs.setBoolPref(PassGen.prefsList[2].name, false);
      PassGen.prefsList[2].value = false;
    }
    else{
      PassGen.prefs.setBoolPref(PassGen.prefsList[2].name, true);
      PassGen.prefsList[2].value = true;
    }
    PassGen.setIconStyle();
  },

  /**
  * Method will set up color of extension icon according to current state.
  * @function setIconStyle
  */
  setIconStyle(){
    if(PassGen.prefsList[2].value==true){ // If Active
      document.getElementById("passgen-button").setAttribute("style","list-style-image: url(\"chrome://passwordgen/skin/active.png\")");
    }
    else{
      document.getElementById("passgen-button").setAttribute("style","list-style-image: url(\"chrome://passwordgen/skin/deactive.png\")");
    }
  },

  /**
  * Show generated password at the bottom part of web browser window.
  * @function showPass
  * @param {string} newPass Generated password.
  */
  showPass(newPass){
    //"Password showing time" option
    if(PassGen.prefsList[4].value > 0){
      document.getElementById("passPanel").setAttribute('hidden','false');
      document.getElementById("passPanel").setAttribute('value', newPass);
      setTimeout(PassGen.hidePass, PassGen.prefsList[4].value*1000);
    }
  },

  /**
  * Hide panel shown at the bottom part of web browser window with generated password value.
  * @function hidePass
  */
  hidePass() {
    document.getElementById("passPanel").setAttribute('hidden','true');
  },

  /**
  * Generate password and insert it to the password field.
  * @function generate
  * @param passBox {HTMLInputElement} Password field element.
  */
  generate(passBox){
    // If Active
    if(PassGen.prefsList[2].value==true){
      if(passBox == null){
        return;
      }
      var domain=gBrowser.getBrowserForTab(gBrowser.selectedTab).currentURI.host;
      var lengthPass=null;
      var b64Enc=null;
      var storedSecondLDomain= false;
      var storedDomain = false;
      var storedDomainWithSecondLDomain = false;
      var strBun = document.getElementById("stringBundle");
      var sld = PassGen.getSecondLvlDomain(domain);
      var parentDomain;
      var parentLengthPass;
      var parentB64Enc;
      var parentHexEnc;
      var strToHash;

      // Check if domain is already stored in database
      var statement = PassGen.myDatabase.createStatement("SELECT domain FROM Prefs WHERE domain LIKE :domain");
      statement.params.domain = domain;
      while(statement.step()){
        storedDomain = true;
      }
      statement.finalize();

      // Check if domain is stored with 2nd level domain
      if(storedDomain){
        var statement = PassGen.myDatabase.createStatement("SELECT domain FROM Prefs WHERE domain LIKE :domain AND secondLDomain is NOT 'null'");
        statement.params.domain = domain;
        while(statement.step()){
          storedDomainWithSecondLDomain = true;
        }
        statement.finalize();
      }

      // If domain is not stored, but 2nd level domain of this domain is already stored in database (if some stored domain has same 2nd level domain like the new unstored domain)
      else if(!storedDomain){
        var statement = PassGen.myDatabase.createStatement("SELECT domain, lengthPass, b64Enc, hexEnc FROM Prefs WHERE secondLDomain LIKE :sld LIMIT 1");
        statement.params.sld = sld;
        while(statement.step()){
          storedSecondLDomain = true;

          lengthPass = statement.row.lengthPass;
          b64Enc = statement.row.b64Enc;
          hexEnc = statement.row.hexEnc;

          parentDomain = statement.row.domain;
          parentLengthPass = lengthPass;
          parentB64Enc = b64Enc;
          parentHexEnc = hexEnc;
        }
        statement.finalize();
      }

      // If domain is not stored, use current generator preferences
      if(!storedDomain){
        lengthPass=PassGen.prefsList[3].value;
        b64Enc=PassGen.prefsList[0].value;
      }

      // Use saved settings for password generating
      if(PassGen.prefsList[5].value==true){
        // If domain with 2nd level domain is stored, use their settings
        if(storedDomainWithSecondLDomain){
          var statement = PassGen.myDatabase.createStatement("SELECT domain, lengthPass, b64Enc FROM Prefs WHERE domain LIKE :domain");
          statement.params.domain = domain;
          while(statement.step()){
            lengthPass = statement.row.lengthPass;
            b64Enc = statement.row.b64Enc;
          }
          statement.finalize();

          strToHash=passBox.value+sld+PassGen.prefsList[7].value;
        }
        // If domain is stored without 2nd level domain, use settings of stored domain
        else if(storedDomain){
          var statement = PassGen.myDatabase.createStatement("SELECT lengthPass, b64Enc FROM Prefs WHERE domain LIKE :domain");
          statement.params.domain = domain;
          while(statement.step()){
            lengthPass = statement.row.lengthPass;
            b64Enc = statement.row.b64Enc;

          }
          statement.finalize();

          strToHash=passBox.value+domain+PassGen.prefsList[7].value;
        }
      }

      // If "Save settings" preference is set and domain is not stored
      if(!storedDomain && (PassGen.prefsList[6].value==true)){
        // If exists stored 2nd level domain that is same as current 2nd level domain of domain
        if(storedSecondLDomain){
          // Include domain address with 2nd level domain under stored record with same 2nd level domain?
          var winMsg = strBun.getString('confirm1')+"  "+domain+"  "+strBun.getString('confirm2')+"  "+parentDomain+"\n"+strBun.getString('confirm3');
          var choice = window.confirm(winMsg);
          // If yes, then include...
          if(choice){
            var statement = PassGen.myDatabase.createStatement("INSERT INTO Prefs(domain, lengthPass, b64Enc, hexEnc, secondLDomain) Values(:domain, :parentLengthPass, :parentB64Enc, :parentHexEnc, :sld)");
            statement.params.domain = domain;
            statement.params.parentLengthPass = parentLengthPass;
            statement.params.parentB64Enc = parentB64Enc;
            statement.params.parentHexEnc = parentHexEnc;
            statement.params.sld = sld;

            statement.executeAsync();
            statement.reset();
            statement.finalize();

            lengthPass = parentLengthPass;
            b64Enc = parentB64Enc;
            strToHash=passBox.value+sld+PassGen.prefsList[7].value;
          }
          // Save domain address. Domain set as 'null'
          else{
            var statement = PassGen.myDatabase.createStatement("INSERT INTO Prefs(domain, lengthPass, b64Enc, hexEnc, secondLDomain) Values(:domain, :lengthPass, :b64Enc, :hexEnc, 'null')");
            statement.params.domain = domain;
            statement.params.lengthPass = PassGen.prefsList[3].value;
            statement.params.b64Enc = PassGen.prefsList[0].value;
            statement.params.hexEnc = PassGen.prefsList[1].value;

            statement.executeAsync();
            statement.reset();
            statement.finalize();

            lengthPass = PassGen.prefsList[3].value;
            b64Enc = PassGen.prefsList[0].value;
            strToHash=passBox.value+domain+PassGen.prefsList[7].value;
          }
        }
        // If domain neither 2nd level domain is not stored
        else if(!storedSecondLDomain){
          // Save domain with 2nd level domain
          var statement = PassGen.myDatabase.createStatement("INSERT INTO Prefs(domain, lengthPass, b64Enc, hexEnc, secondLDomain) Values(:domain, :lengthPass, :b64Enc, :hexEnc, :sld)");
          statement.params.domain = domain;
          statement.params.lengthPass = PassGen.prefsList[3].value;
          statement.params.b64Enc = PassGen.prefsList[0].value;
          statement.params.hexEnc = PassGen.prefsList[1].value;
          statement.params.sld = sld;

          statement.executeAsync();
          statement.reset();
          statement.finalize();

          strToHash=passBox.value+sld+PassGen.prefsList[7].value;
        }
        PassGen.prefWin.PassGen.refreshTree();
      }

      // If domain is stored, "Save settings" preference is set and "Use saved settings for password generating" preference is not set
      if(storedDomain && (PassGen.prefsList[6].value==true) && (PassGen.prefsList[5].value==false)){
        alert(strBun.getString('domainSaved'));
      }

      // If domain is not already stored, "Save settings" preference is not set and "Use saved settings for password generating" preference is set
      if(!storedDomain && (PassGen.prefsList[6].value==false) && (PassGen.prefsList[5].value==true)){
        alert(strBun.getString('domainNotSaved'));
      }

      // If "Save settings" and "Use saved settings for password generating" preference is not set
      if((PassGen.prefsList[5].value==false) && (PassGen.prefsList[6].value==false)){
        lengthPass=PassGen.prefsList[3].value;
        b64Enc=PassGen.prefsList[0].value;
        strToHash=passBox.value+domain+PassGen.prefsList[7].value;
      }

      // Password length check
      if(lengthPass>PassGen.maxPassLen){
        lengthPass=PassGen.maxPassLen;
      }
      if(lengthPass<PassGen.minPassLen){
        lengthPass=PassGen.minPassLen;
      }

      // Generate Base-64 encoded password
      if(b64Enc=="true"||b64Enc==true){
        var sha512Obj = {};
        Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                  .getService(Components.interfaces.mozIJSSubScriptLoader);
        Services.scriptloader.loadSubScript("chrome://passwordgen/content/sha-512.js", sha512Obj);

        var pass=sha512Obj.b64_sha512(strToHash).substring(0,lengthPass);
        passBox.value=pass;
        passBox.focus();
        PassGen.showPass(pass);
      }
      // Generate HEX encoded password
      if(b64Enc=="false"||b64Enc==false){
        var sha512Obj = {};
        Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                  .getService(Components.interfaces.mozIJSSubScriptLoader);
        Services.scriptloader.loadSubScript("chrome://passwordgen/content/sha-512.js", sha512Obj);

        var pass=sha512Obj.hex_sha512(strToHash).substring(0,lengthPass);
        passBox.value=pass;
        passBox.focus();
        PassGen.showPass(pass);
      }
    }
  },

  /**
  * Open window with stored settings.
  * @function showSettings
  */
  showSettings(){
    PassGen.prefWin = openDialog("chrome://passwordgen/content/settings.xul", "", "centerscreen,chrome,titlebar,toolbar",PassGen);
  },

  /**
  * Load stored settings from database and show them in tree element.
  * @function loadSettings
  */
  loadSettings(){
    var myDatabase = window.arguments[0].myDatabase;

    var stmnt = myDatabase.createStatement("SELECT secondLDomain,COUNT(*) AS count FROM(SELECT domain,secondLDomain FROM Prefs ORDER BY secondLDomain) GROUP BY secondLDomain");
    while(stmnt.step()){
      var secondLDomain = stmnt.row.secondLDomain;
      var count = stmnt.row.count;

      // Only domain address without 2nd level domain
      if(secondLDomain == 'null'){
        var stmnt2 = myDatabase.createStatement("SELECT domain, lengthPass, b64Enc, hexEnc FROM Prefs WHERE secondLDomain IS 'null'");
        var treeChild = document.getElementById("treeChild");

        while (stmnt2.step()) {
          var domain = stmnt2.row.domain;
          var length = stmnt2.row.lengthPass;
          var b64Enc = stmnt2.row.b64Enc;
          var hexEnc = stmnt2.row.hexEnc;

          // Add domain column from DB to tree
          var treeItem = document.createElement('treeitem');
          var treeRow =  document.createElement('treerow');
          var treeCell = document.createElement('treecell');
          treeCell.setAttribute('label',domain);
          treeCell.setAttribute('editable',false);
          treeRow.appendChild(treeCell);

          // Add lengthPass column from DB to tree
          treeCell = document.createElement('treecell');
          treeCell.setAttribute('label', length);
          treeRow.appendChild(treeCell);

          // Add b64Enc column from DB to tree
          treeCell = document.createElement('treecell');
          treeCell.setAttribute('value', b64Enc);
          treeRow.appendChild(treeCell);

          // Add hexEnc column from DB to tree
          treeCell = document.createElement('treecell');
          treeCell.setAttribute('value', hexEnc);
          treeRow.appendChild(treeCell);

          treeItem.appendChild(treeRow);
          treeChild.appendChild(treeItem);
        }
        stmnt2.finalize();
      }
      // Only one domain address with 2nd level domain stored in database
      if(count == 1 && secondLDomain != 'null'){
        var stmnt2 = myDatabase.createStatement("SELECT domain, lengthPass, b64Enc, hexEnc FROM Prefs WHERE secondLDomain LIKE :secondLDomain ORDER BY secondLDomain");
        stmnt2.params.secondLDomain = secondLDomain;
        var treeChild = document.getElementById("treeChild");

        while (stmnt2.step()) {
          var domain = stmnt2.row.domain;
          var length = stmnt2.row.lengthPass;
          var b64Enc = stmnt2.row.b64Enc;
          var hexEnc = stmnt2.row.hexEnc;

          var treeItem = document.createElement('treeitem');
          var treeRow =  document.createElement('treerow');
          var treeCell = document.createElement('treecell');

          // Add domain column from DB to tree
          treeCell.setAttribute('label',domain);
          treeCell.setAttribute('editable', false);
          treeRow.appendChild(treeCell);

          // Add lengthPass column from DB to tree
          treeCell = document.createElement('treecell');
          treeCell.setAttribute('label', length);
          treeCell.setAttribute('editable', true);
          treeRow.appendChild(treeCell);

          // Add b64Enc column from DB to tree
          treeCell = document.createElement('treecell');
          treeCell.setAttribute('value', b64Enc);
          treeRow.appendChild(treeCell);

          // Add hexEnc column from DB to tree
          treeCell = document.createElement('treecell');
          treeCell.setAttribute('value', hexEnc);
          treeRow.appendChild(treeCell);

          treeItem.appendChild(treeRow);
          treeChild.appendChild(treeItem);
        }
        stmnt2.finalize();
      }
      // More domain addresses with 2nd level domain stored (sub-addresses of parent address)
      if(count > 1 && secondLDomain != 'null'){
        var stmnt2 = myDatabase.createStatement("SELECT domain, lengthPass, b64Enc, hexEnc FROM Prefs WHERE secondLDomain LIKE :secondLDomain ORDER BY secondLDomain");
        stmnt2.params.secondLDomain = secondLDomain;
        var treeChild = document.getElementById("treeChild");
        var subTreeChild = document.createElement('treechildren');
        var parentItem = true;
        var treeItem = document.createElement('treeitem');

        while (stmnt2.step()) {
          // Parent domain address, which will contain childs
          if(parentItem){
            var domain = stmnt2.row.domain;
            var length = stmnt2.row.lengthPass;
            var b64Enc = stmnt2.row.b64Enc;
            var hexEnc = stmnt2.row.hexEnc;

            var treeRow =  document.createElement('treerow');
            var treeCell = document.createElement('treecell');

            treeItem.setAttribute('container',true);
            treeItem.setAttribute('open',true);

            // Add domain column from DB to tree
            treeCell.setAttribute('label',domain);
            treeCell.setAttribute('editable', false);
            treeRow.appendChild(treeCell);

            // Add lengthPass column from DB to tree
            treeCell = document.createElement('treecell');
            treeCell.setAttribute('label', length);
            treeCell.setAttribute('editable', true);
            treeRow.appendChild(treeCell);

            // Add b64Enc column from DB to tree
            treeCell = document.createElement('treecell');
            treeCell.setAttribute('value', b64Enc);
            treeRow.appendChild(treeCell);

            // Add hexEnc column from DB to tree
            treeCell = document.createElement('treecell');
            treeCell.setAttribute('value', hexEnc);
            treeRow.appendChild(treeCell);

            treeItem.appendChild(treeRow);

            parentItem = false;
          }
          // Childrens of parent domain address
          else{
            var domain = stmnt2.row.domain;
            var length = stmnt2.row.lengthPass;
            var b64Enc = stmnt2.row.b64Enc;
            var hexEnc = stmnt2.row.hexEnc;

            var subTreeItem = document.createElement('treeitem');
            var treeRow =  document.createElement('treerow');
            var treeCell = document.createElement('treecell');

            // Add domain column from DB to tree
            treeCell.setAttribute('label',domain);
            treeCell.setAttribute('editable', false);
            treeRow.appendChild(treeCell);

            // Add lengthPass column from DB to tree
            treeCell = document.createElement('treecell');
            treeCell.setAttribute('editable', false);
            treeRow.appendChild(treeCell);

            subTreeItem.appendChild(treeRow);
            subTreeChild.appendChild(subTreeItem);
          }
        }
        treeItem.appendChild(subTreeChild);
        treeChild.appendChild(treeItem);

        stmnt2.finalize();
      }
    }
    stmnt.finalize();
  },

  /**
  * Delete only one item from tree element.
  * In case that item is parent with child nodes, all children nodes will be deleted with parent node.
  * Deleted items are deleted from database too.
  * @function del
  * @param event Event of the object.
  */
  del(event){
    if(event.button == 0 || event.keyCode == KeyEvent.DOM_VK_DELETE){
      var myDatabase = window.arguments[0].myDatabase;
      var tree = document.getElementById('myTree');
      var start = new Object();
      var end = new Object();
      var numRanges = tree.view.selection.getRangeCount();
      var secondLDomain;

      for (var i = numRanges-1; i >= 0; i--){
        tree.view.selection.getRangeAt(i,start,end);
        for(var idx = end.value; idx >= start.value; idx--){
          var treeItem = tree.contentView.getItemAtIndex(idx);
          var childList = treeItem.childNodes;
          var domain = childList[0].children[0].getAttribute('label');

          // Get 2nd level domain of domain address
          var stmnt = myDatabase.createStatement("SELECT secondLDomain FROM Prefs WHERE domain LIKE :domain");
          stmnt.params.domain = domain;

          while(stmnt.step()){
            secondLDomain = stmnt.row.secondLDomain;
          }
          stmnt.finalize();

          // Delete 1st level tree item node
          if(treeItem.parentNode.id == "treeChild"){
            if(secondLDomain == 'null'){
              var statement = myDatabase.createStatement("DELETE FROM Prefs WHERE domain LIKE :domain");
              statement.params.domain = domain;
              statement.executeAsync();
              statement.reset();
              statement.finalize();
            }
            else{
              var statement = myDatabase.createStatement("DELETE FROM Prefs WHERE secondLDomain IN (SELECT secondLDomain FROM Prefs WHERE domain LIKE :domain)");
              statement.params.domain = domain;
              statement.executeAsync();
              statement.reset();
              statement.finalize();
            }
          }
          // Delete 2nd level tree item node
          else{
            var statement = myDatabase.createStatement("DELETE FROM Prefs WHERE domain LIKE :domain");
            statement.params.domain = domain;
            statement.executeAsync();
            statement.reset();
            statement.finalize();
          }
          treeItem.parentNode.removeChild(treeItem);
        }
      }
    }
  },

  /**
  * Delete all items from tree element and database.
  * @function delAll
  */
  delAll(){
    var myDatabase = window.arguments[0].myDatabase;
    var statement = myDatabase.createStatement("DELETE FROM Prefs");
    statement.executeAsync();
    statement.reset();
    statement.finalize();

    var treeChild = document.getElementById("treeChild");
    while(treeChild.hasChildNodes()){
      treeChild.removeChild(treeChild.firstChild);
    }
  },

  /**
  * Save edited password length value into database and tree.
  * Method is called after user inputs new password value into tree.
  * @function savePassLength
  */
  savePassLength(){
    var tree = document.getElementById('myTree');
    var editedRow = tree.currentIndex;
    var treeItem = tree.contentView.getItemAtIndex(editedRow);
    var childList = treeItem.childNodes;

    // Min length of generated password is 1 character
    if(tree.inputField.value < PassGen.minPassLen){
      tree.inputField.value = PassGen.minPassLen;
    }

    // Max length of generated password is 64 characters
    if(tree.inputField.value > PassGen.maxPassLen){
      tree.inputField.value = PassGen.maxPassLen;
    }

    // Check if input is only number
    var regex=/^[0-9]+$/;
    if(!tree.inputField.value.match(regex)){
      tree.inputField.value = 1;
    }
    var txtboxVal = tree.inputField.value;

    treeItem.children[0].children[1].setAttribute('label', txtboxVal);
    var domain = treeItem.children[0].children[0].getAttribute('label');
    var length = treeItem.children[0].children[1].getAttribute('label');

    var myDatabase = window.arguments[0].myDatabase;
    // Update parent and child nodes
    if(childList.length > 1){
      var stmnt =myDatabase.createStatement("SELECT secondLDomain FROM Prefs WHERE domain LIKE :domain");
      stmnt.params.domain = domain;

      while(stmnt.step()){
        var secondLDomain = stmnt.row.secondLDomain;
      }
      stmnt.finalize();

      stmnt = myDatabase.createStatement("UPDATE Prefs SET lengthPass = :lengthPass WHERE secondLDomain LIKE :secondLDomain");
      stmnt.params.lengthPass = length;
      stmnt.params.secondLDomain = secondLDomain;
      stmnt.executeAsync();
      stmnt.reset();
      stmnt.finalize();
    }
    // Update only one node - parent node with no child nodes
    else{
      var stmnt = myDatabase.createStatement("UPDATE Prefs SET lengthPass = :lengthPass WHERE domain LIKE :domain");
      stmnt.params.lengthPass = length;
      stmnt.params.domain = domain;
      stmnt.executeAsync();
      stmnt.reset();
      stmnt.finalize();
    }
  },

  /**
  * Save edited password encoding type into database and tree.
  * Method is called after user selects password encoding type by mouse click on tree.
  * @function saveEncoding
  */
  saveEncoding(event){
    var tree = document.getElementById("myTree");
    var tbo = tree.treeBoxObject;

    var row = { }, col = { }, child = { };
    tbo.getCellAt(event.clientX, event.clientY, row, col, child);

    // Only one type of encoding could be set

    if(col.value.id == "b64Col"){
      var myDatabase = window.arguments[0].myDatabase;
      var treeItem = tree.contentView.getItemAtIndex(row.value);
      var childList = treeItem.childNodes;
      var domain = treeItem.children[0].children[0].getAttribute('label');

      // Update parent and child nodes
      if(childList.length > 1){
        var stmnt =myDatabase.createStatement("SELECT secondLDomain FROM Prefs WHERE domain LIKE :domain");
        stmnt.params.domain = domain;

        while(stmnt.step()){
          var secondLDomain = stmnt.row.secondLDomain;
        }
        stmnt.finalize();

        // If Base-64 is selected, then HEX is deselected
        if(treeItem.children[0].children[2].getAttribute('value') == 'true'){
          treeItem.children[0].children[3].setAttribute('value', 'false');
          var stmnt = myDatabase.createStatement("UPDATE Prefs SET b64Enc = 'true', hexEnc = 'false' WHERE secondLDomain LIKE :secondLDomain");
          stmnt.params.secondLDomain = secondLDomain;
          stmnt.executeAsync();
          stmnt.reset();
          stmnt.finalize();
        }
        // If Base-64 is deselected, then HEX is selected
        else if(treeItem.children[0].children[2].getAttribute('value') == 'false'){
          treeItem.children[0].children[3].setAttribute('value', 'true');
          var stmnt = myDatabase.createStatement("UPDATE Prefs SET b64Enc = 'false', hexEnc = 'true' WHERE secondLDomain LIKE :secondLDomain");
          stmnt.params.secondLDomain = secondLDomain;
          stmnt.executeAsync();
          stmnt.reset();
          stmnt.finalize();
        }
      }
      // Update only one node - parent node with no child nodes
      else{
        // If Base-64 is selected, then HEX is deselected
        if(treeItem.children[0].children[2].getAttribute('value') == 'true'){
          treeItem.children[0].children[3].setAttribute('value', 'false');
          var stmnt = myDatabase.createStatement("UPDATE Prefs SET b64Enc = 'true', hexEnc = 'false' WHERE domain LIKE :domain");
          stmnt.params.domain = domain;
          stmnt.executeAsync();
          stmnt.reset();
          stmnt.finalize();
        }
        // If Base-64 is deselected, then HEX is selected
        else if(treeItem.children[0].children[2].getAttribute('value') == 'false'){
          treeItem.children[0].children[3].setAttribute('value', 'true');
          var stmnt = myDatabase.createStatement("UPDATE Prefs SET b64Enc = 'false', hexEnc = 'true' WHERE domain LIKE :domain");
          stmnt.params.domain = domain;
          stmnt.executeAsync();
          stmnt.reset();
          stmnt.finalize();
        }
      }
    }
    else if(col.value.id == "hexCol"){
      var myDatabase = window.arguments[0].myDatabase;
      var treeItem = tree.contentView.getItemAtIndex(row.value);
      var childList = treeItem.childNodes;
      var domain = treeItem.children[0].children[0].getAttribute('label');

      // Update parent and child nodes
      if(childList.length > 1){
        var stmnt =myDatabase.createStatement("SELECT secondLDomain FROM Prefs WHERE domain LIKE :domain");
        stmnt.params.domain = domain;

        while(stmnt.step()){
          var secondLDomain = stmnt.row.secondLDomain;
        }
        stmnt.finalize();

        // If HEX is selected, then Base-64 is deselected
        if(treeItem.children[0].children[3].getAttribute('value') == 'true'){
          treeItem.children[0].children[2].setAttribute('value', 'false');
          var stmnt = myDatabase.createStatement("UPDATE Prefs SET hexEnc = 'true', b64Enc = 'false' WHERE secondLDomain LIKE :secondLDomain");
          stmnt.params.secondLDomain = secondLDomain;
          stmnt.executeAsync();
          stmnt.reset();
          stmnt.finalize();
        }
        // If HEX is deselected, then Base-64 is selected
        else if(treeItem.children[0].children[3].getAttribute('value') == 'false'){
          treeItem.children[0].children[2].setAttribute('value', 'true');
          var stmnt = myDatabase.createStatement("UPDATE Prefs SET hexEnc = 'false', b64Enc = 'true' WHERE secondLDomain LIKE :secondLDomain");
          stmnt.params.secondLDomain = secondLDomain;
          stmnt.executeAsync();
          stmnt.reset();
          stmnt.finalize();
        }
      }
      // Update only one node - parent node with no child nodes
      else{
        // If HEX is selected, then Base-64 is deselected
        if(treeItem.children[0].children[3].getAttribute('value') == 'true'){
          treeItem.children[0].children[2].setAttribute('value', 'false');
          var stmnt = myDatabase.createStatement("UPDATE Prefs SET hexEnc = 'true', b64Enc = 'false' WHERE domain LIKE :domain");
          stmnt.params.domain = domain;
          stmnt.executeAsync();
          stmnt.reset();
          stmnt.finalize();
        }
        // If HEX is deselected, then Base-64 is selected
        else if(treeItem.children[0].children[3].getAttribute('value') == 'false'){
          treeItem.children[0].children[2].setAttribute('value', 'true');
          var stmnt = myDatabase.createStatement("UPDATE Prefs SET hexEnc = 'false', b64Enc = 'true' WHERE domain LIKE :domain");
          stmnt.params.domain = domain;
          stmnt.executeAsync();
          stmnt.reset();
          stmnt.finalize();
        }
      }
    }
  },

  /**
  * Write all preferences and stored settings from database to JSON file.
  * User can choose name of file and location where JSON will be file stored.
  * @function exportFile
  */
  exportFile(){
    var filePicker = Components.classes["@mozilla.org/filepicker;1"]
                    .createInstance(Components.interfaces.nsIFilePicker);
    filePicker.init(window,"Export",filePicker.modeSave);
    filePicker.defaultExtension = "json";
    filePicker.defaultString = "passgen_settings.json";
    filePicker.appendFilter("json files","*.json");
    filePicker.appendFilter("All files","*.*");

    var rv = filePicker.show();
    if(rv == filePicker.returnOK || rv == filePicker.returnReplace){
      Components.utils.import("resource://gre/modules/FileUtils.jsm");
      Components.utils.import("resource://gre/modules/NetUtil.jsm");

      // Fill JSON object with data from DB
      var obj = {'settings':[]};

      var myDatabase = window.arguments[0].myDatabase;
      var stmnt = myDatabase.createStatement("SELECT domain, lengthPass, b64Enc, hexEnc, secondLDomain FROM Prefs");

      while (stmnt.step()){
        var domain = stmnt.row.domain;
        var length = stmnt.row.lengthPass;
        var b64Enc = stmnt.row.b64Enc;
        var hexEnc = stmnt.row.hexEnc;
        var secondLDomain = stmnt.row.secondLDomain;
        obj.settings.push({'domain':domain, 'length':length, 'b64Enc':b64Enc, 'hexEnc':hexEnc, 'secondLDomain':secondLDomain});
      }
      stmnt.finalize();

      // Fill JSON object with data from prefsList
      obj.preferences = window.arguments[0].prefsList;

      // Write data to JSON file
      var file = filePicker.file;
      var data = JSON.stringify(obj);

      var ostream = FileUtils.openSafeFileOutputStream(file);
      var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
                      createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
      converter.charset = "UTF-8";
      var istream = converter.convertToInputStream(data);

      NetUtil.asyncCopy(istream, ostream);
    }
  },

  /**
  * Load all preferences & settings from JSON file to the database and local profile directory preference file.
  * @function importFile
  */
  importFile(){
    var strBun = document.getElementById("stringBundle");
    var filePicker = Components.classes["@mozilla.org/filepicker;1"]
                    .createInstance(Components.interfaces.nsIFilePicker);
    filePicker.init(window,"Import",filePicker.modeOpen);
    filePicker.appendFilter("json files","*.json");
    filePicker.appendFilter("All files","*.*");

    var rv = filePicker.show();
    if(rv == filePicker.returnOK || rv == filePicker.returnReplace){
      // Check if file is JSON
      var file = filePicker.file;
      var fileName = file.leafName;
      var fileExt = fileName.substr((fileName.lastIndexOf('.')+1));
      var maxFileSize = 10; // Max file size in MB

      if(file.fileSize > (maxFileSize*1024*1024)){
        alert(strBun.getString('invalidFileSize'));
        return;
      }

      // ONLY JSON FILE COULD BE IMPORTED

      if(fileExt != "json"){
        alert(strBun.getString('invalidFileType'));
        return;
      }

      // Read data from JSON file
      var data = "";
      var str={};
      var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
      var cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].createInstance(Components.interfaces.nsIConverterInputStream);
      fstream.init(file, -1, 0, 0);
      cstream.init(fstream, "UTF-8", 0, 0);
      cstream.readString(-1, str);
      data = str.value;
      cstream.close();

      // Check correct format of imported file
      if(PassGen.isValidJson(data)){
        var obj = JSON.parse(data);
        PassGen.delAll();
        // Save data from JSON file into DB
        var myDatabase = window.arguments[0].myDatabase;
        for(var i=0; i<obj.settings.length; i++){
          var stmnt = myDatabase.createStatement("INSERT INTO Prefs VALUES (:domain, :lengthPass, :b64Enc, :hexEnc, :secondLDomain)");
          stmnt.params.domain = obj.settings[i].domain;
          stmnt.params.lengthPass = obj.settings[i].length;
          stmnt.params.b64Enc = obj.settings[i].b64Enc;
          stmnt.params.hexEnc = obj.settings[i].hexEnc;
          stmnt.params.secondLDomain = obj.settings[i].secondLDomain;
          stmnt.executeAsync();
          stmnt.reset();
          stmnt.finalize();
        }

        // Save Gen Preferences from JSON to prefsList
        PassGen.setPrefsList(obj.preferences);
        PassGen.loadSettings();
      }
      else{
        return;
      }
    }
  },

  /**
  * Verify whether JSON file is valid before data will be written into database.
  * @function isValidJson
  * @param {string} data Data of stored settings in JSON format.
  * @return {boolean} true - JSON file is valid and data could be written to database & local profile directory preference file.
  *                 <p>false - JSON file is invalid and data couldn't be written to database & local profile directory preference file.</p>
  */
  isValidJson(data){
    var strBun = document.getElementById("stringBundle");
    try{
      var obj = JSON.parse(data);

      // Check Stored Settings validity
      for(var i=0; i<obj.settings.length; i++){
        if(obj.settings[i].domain==null || obj.settings[i].length==null || obj.settings[i].b64Enc==null || obj.settings[i].hexEnc==null){
          alert(strBun.getString('invalidJSON'));
          return false;
        }
        if(!obj.settings[i].length.match(/^[0-9]+$/)){
          alert(strBun.getString('invalidPassLen')+obj.settings[i].length);
          return false;
        }
        if(obj.settings[i].length < PassGen.minPassLen || obj.settings[i].length > PassGen.maxPassLen){
          alert(strBun.getString('invalidPassLen')+obj.settings[i].length);
          return false;
        }
        if(!(obj.settings[i].b64Enc=="true" || obj.settings[i].b64Enc=="false")){
          alert(strBun.getString('invalidB64')+obj.settings[i].b64Enc);
          return false;
        }
        if(!(obj.settings[i].hexEnc=="true" || obj.settings[i].hexEnc=="false")){
          alert(strBun.getString('invalidHex')+obj.settings[i].hexEnc);
          return false;
        }
      }

      // Check Generator Preferences validity
      if(obj.preferences[0].name!="b64Enc" || obj.preferences[1].name!="hexEnc" ||
         obj.preferences[2].name!="isActive" || obj.preferences[3].name!="lengthPass" ||
         obj.preferences[4].name!="passShowTime" || obj.preferences[5].name!="useStored" ||
         obj.preferences[6].name!="store" || obj.preferences[7].name!="const"){
          alert(strBun.getString('invalidOptName'));
          return false;
      }
      if(obj.preferences[0].type!="bool" || obj.preferences[1].type!="bool" ||
         obj.preferences[2].type!="bool" || obj.preferences[3].type!="string" ||
         obj.preferences[4].type!="string" || obj.preferences[5].type!="bool" ||
         obj.preferences[6].type!="bool" || obj.preferences[7].type!="string"){
          alert(strBun.getString('invalidOptType'));
          return false;
      }
      for(var i=0; i<obj.preferences.length; i++){
        // Password length preference
        if(i==3){
          if(!obj.preferences[i].value.match(/^[0-9]+$/)){
            alert(strBun.getString('invalidPassLen')+obj.preferences[i].value);
            return false;
          }
          if(obj.preferences[i].value < PassGen.minPassLen || obj.preferences[i].value > PassGen.maxPassLen){
            alert(strBun.getString('invalidPassLen')+obj.preferences[i].value);
            return false;
          }
        }
        // Password showing time
        else if(i==4){
          if(!obj.preferences[i].value.match(/^[0-9]+$/)){
            alert(strBun.getString('invalidPassShowTime')+obj.preferences[i].value);
            return false;
          }
          if(obj.preferences[i].value < 0 || obj.preferences[i].value > 60){
            alert(strBun.getString('invalidPassShowTime')+obj.preferences[i].value);
            return false;
          }
        }
        // Length of Constant
        else if(i==7){
          if(obj.preferences[i].value.length > 100){
            alert(strBun.getString('invalidConstLen'));
            return false;
          }
        }
        else if(!(obj.preferences[i].value==true || obj.preferences[i].value==false)){
          alert(strBun.getString('invalidOptValue')+obj.preferences[i].value);
          return false;
        }
      }
    }
    catch(e){
      alert(strBun.getString('invalidJSON'));
      return false;
    }
    return true;
  },

  /**
  * Show description of preference when the mouse pointer moves over this preference.
  * @function showDescription
  * @param {string} msg Description message which will be shown in description box.
  */
  showDescription(msg){
    var descriptionBox = document.getElementById("descriptionBox");
    descriptionBox.value = msg;
  },

  /**
  * Hide description of preference when the mouse pointer moves out this preference.
  * @function hideDescription
  */
  hideDescription(){
    var descriptionBox = document.getElementById("descriptionBox");
    descriptionBox.value = "";
  },

  /**
  * Delete all tree items and call loadSettings() method which load stored settings data from database and show them in tree element.
  * @function refreshTree
  */
  refreshTree(){
    var treeChild = document.getElementById("treeChild");
      while(treeChild.hasChildNodes()){
        treeChild.removeChild(treeChild.firstChild);
      }
    PassGen.loadSettings();
  },

  /**
  * Set list of generator preferences with data from imported JSON file.
  * @function setPrefsList
  * @param {Array} preferences Generator preferences values.
  */
  setPrefsList(preferences){
    var prefs = window.arguments[0].prefs;

    for(var i=0 ; i<preferences.length; i++){
      if(preferences[i].type == "string"){
        prefs.setCharPref(preferences[i].name, preferences[i].value);
      }
      else{
        prefs.setBoolPref(preferences[i].name, preferences[i].value);
      }
    }
  },

  /**
  * Find domain addresses records stored in database and show them in tree element.
  * Items are filtered by user find input value.
  * @function findDomain
  */
  findDomain(){
    var findBox = document.getElementById("findBox");
    var myDatabase = window.arguments[0].myDatabase;
    var treeChild = document.getElementById("treeChild");

    // Clear tree
    while(treeChild.hasChildNodes()){
      treeChild.removeChild(treeChild.firstChild);
    }
    // Show all items from DB
    if(findBox.value == ""){
      PassGen.loadSettings();
      return;
    }

    var stmnt = myDatabase.createStatement("SELECT secondLDomain,COUNT(*) AS count FROM (SELECT domain,secondLDomain FROM Prefs WHERE domain LIKE :findBox ORDER BY secondLDomain) GROUP BY secondLDomain");
    var findBoxParam = "%"+findBox.value+"%";
    stmnt.params.findBox = findBoxParam;

    while(stmnt.step()){
      var secondLDomain = stmnt.row.secondLDomain;
      var count = stmnt.row.count;

      // Only domain address without 2nd level domain
      if(secondLDomain == 'null'){
        var stmnt2 = myDatabase.createStatement("SELECT domain, lengthPass, b64Enc, hexEnc FROM Prefs WHERE secondLDomain IS 'null' AND domain LIKE :findBox");
        var findBoxParam = "%"+findBox.value+"%";
        stmnt2.params.findBox = findBoxParam;

        treeChild = document.getElementById("treeChild");

        while (stmnt2.step()) {
          var domain = stmnt2.row.domain;
          var length = stmnt2.row.lengthPass;
          var b64Enc = stmnt2.row.b64Enc;
          var hexEnc = stmnt2.row.hexEnc;

          // Add domain column from DB to tree
          var treeItem = document.createElement('treeitem');
          var treeRow =  document.createElement('treerow');
          var treeCell = document.createElement('treecell');
          treeCell.setAttribute('label',domain);
          treeCell.setAttribute('editable',false);
          treeRow.appendChild(treeCell);

          // Add lengthPass column from DB to tree
          treeCell = document.createElement('treecell');
          treeCell.setAttribute('label', length);
          treeRow.appendChild(treeCell);

          // Add b64Enc column from DB to tree
          treeCell = document.createElement('treecell');
          treeCell.setAttribute('value', b64Enc);
          treeRow.appendChild(treeCell);

          // Add hexEnc column from DB to tree
          treeCell = document.createElement('treecell');
          treeCell.setAttribute('value', hexEnc);
          treeRow.appendChild(treeCell);

          treeItem.appendChild(treeRow);
          treeChild.appendChild(treeItem);
        }
        stmnt2.finalize();
      }

      // Only one domain address with 2nd level domain stored in database
      if(count == 1 && secondLDomain != 'null'){
        var stmnt2 = myDatabase.createStatement("SELECT domain, lengthPass, b64Enc, hexEnc, COUNT(*) AS domainCount FROM Prefs WHERE secondLDomain LIKE :secondLDomain ORDER BY secondLDomain");
        stmnt2.params.secondLDomain = secondLDomain;
        treeChild = document.getElementById("treeChild");

        while (stmnt2.step()) {
          var domain = stmnt2.row.domain;
          var length = stmnt2.row.lengthPass;
          var b64Enc = stmnt2.row.b64Enc;
          var hexEnc = stmnt2.row.hexEnc;
          var domainCount = stmnt2.row.domainCount;

          // If domain address has some childs
          if(domainCount > 1){
            var stmnt3 = myDatabase.createStatement("SELECT domain, lengthPass, b64Enc, hexEnc FROM Prefs WHERE secondLDomain LIKE :secondLDomain ORDER BY secondLDomain");
            stmnt3.params.secondLDomain = secondLDomain;
            treeChild = document.getElementById("treeChild");
            var subTreeChild = document.createElement('treechildren');
            var parentItem = true;
            var treeItem = document.createElement('treeitem');

            while (stmnt3.step()) {
              // Parent domain address, which will contain childs
              if(parentItem){
                var domain = stmnt3.row.domain;
                var length = stmnt3.row.lengthPass;
                var b64Enc = stmnt3.row.b64Enc;
                var hexEnc = stmnt3.row.hexEnc;

                var treeRow =  document.createElement('treerow');
                var treeCell = document.createElement('treecell');

                treeItem.setAttribute('container',true);
                treeItem.setAttribute('open',true);

                // Add domain column from DB to tree
                treeCell.setAttribute('label',domain);
                treeCell.setAttribute('editable', false);
                treeRow.appendChild(treeCell);

                // Add lengthPass column from DB to tree
                treeCell = document.createElement('treecell');
                treeCell.setAttribute('label', length);
                treeCell.setAttribute('editable', true);
                treeRow.appendChild(treeCell);

                // Add b64Enc column from DB to tree
                treeCell = document.createElement('treecell');
                treeCell.setAttribute('value', b64Enc);
                treeRow.appendChild(treeCell);

                // Add hexEnc column from DB to tree
                treeCell = document.createElement('treecell');
                treeCell.setAttribute('value', hexEnc);
                treeRow.appendChild(treeCell);

                treeItem.appendChild(treeRow);

                parentItem = false;
              }
              // Childrens of parent domain address
              else{
                var domain = stmnt3.row.domain;
                var length = stmnt3.row.lengthPass;
                var b64Enc = stmnt3.row.b64Enc;
                var hexEnc = stmnt3.row.hexEnc;

                var subTreeItem = document.createElement('treeitem');
                var treeRow =  document.createElement('treerow');
                var treeCell = document.createElement('treecell');

                // Add domain column from DB to tree
                treeCell.setAttribute('label',domain);
                treeCell.setAttribute('editable', false);
                treeRow.appendChild(treeCell);

                // Add lengthPass column from DB to tree
                treeCell = document.createElement('treecell');
                treeCell.setAttribute('editable', false);
                treeRow.appendChild(treeCell);

                subTreeItem.appendChild(treeRow);
                subTreeChild.appendChild(subTreeItem);
              }
            }
            treeItem.appendChild(subTreeChild);
            treeChild.appendChild(treeItem);

            stmnt3.finalize();
          }
          else{
            var treeItem = document.createElement('treeitem');
            var treeRow =  document.createElement('treerow');
            var treeCell = document.createElement('treecell');

            // Add domain column from DB to tree
            treeCell.setAttribute('label',domain);
            treeCell.setAttribute('editable', false);
            treeRow.appendChild(treeCell);

            // Add lengthPass column from DB to tree
            treeCell = document.createElement('treecell');
            treeCell.setAttribute('label', length);
            treeCell.setAttribute('editable', true);
            treeRow.appendChild(treeCell);

            // Add b64Enc column from DB to tree
            treeCell = document.createElement('treecell');
            treeCell.setAttribute('value', b64Enc);
            treeRow.appendChild(treeCell);

            // Add hexEnc column from DB to tree
            treeCell = document.createElement('treecell');
            treeCell.setAttribute('value', hexEnc);
            treeRow.appendChild(treeCell);

            treeItem.appendChild(treeRow);
            treeChild.appendChild(treeItem);
          }
        }
        stmnt2.finalize();
      }

      // More domain addresses with 2nd level domain stored (sub-addresses of parent address)
      if(count > 1 && secondLDomain != 'null'){
        var stmnt2 = myDatabase.createStatement("SELECT domain, lengthPass, b64Enc, hexEnc FROM Prefs WHERE secondLDomain LIKE :secondLDomain ORDER BY secondLDomain");
        stmnt2.params.secondLDomain = secondLDomain;
        treeChild = document.getElementById("treeChild");
        var subTreeChild = document.createElement('treechildren');
        var parentItem = true;
        var treeItem = document.createElement('treeitem');

        while (stmnt2.step()) {
          // Parent domain address, which will contain childs
          if(parentItem){
            var domain = stmnt2.row.domain;
            var length = stmnt2.row.lengthPass;
            var b64Enc = stmnt2.row.b64Enc;
            var hexEnc = stmnt2.row.hexEnc;

            var treeRow =  document.createElement('treerow');
            var treeCell = document.createElement('treecell');

            treeItem.setAttribute('container',true);
            treeItem.setAttribute('open',true);

            // Add domain column from DB to tree
            treeCell.setAttribute('label',domain);
            treeCell.setAttribute('editable', false);
            treeRow.appendChild(treeCell);

            // Add lengthPass column from DB to tree
            treeCell = document.createElement('treecell');
            treeCell.setAttribute('label', length);
            treeCell.setAttribute('editable', true);
            treeRow.appendChild(treeCell);

            // Add b64Enc column from DB to tree
            treeCell = document.createElement('treecell');
            treeCell.setAttribute('value', b64Enc);
            treeRow.appendChild(treeCell);

            // Add hexEnc column from DB to tree
            treeCell = document.createElement('treecell');
            treeCell.setAttribute('value', hexEnc);
            treeRow.appendChild(treeCell);

            treeItem.appendChild(treeRow);

            parentItem = false;
          }
          // Childrens of parent domain address
          else{
            var domain = stmnt2.row.domain;
            var length = stmnt2.row.lengthPass;
            var b64Enc = stmnt2.row.b64Enc;
            var hexEnc = stmnt2.row.hexEnc;

            var subTreeItem = document.createElement('treeitem');
            var treeRow =  document.createElement('treerow');
            var treeCell = document.createElement('treecell');

            // Add domain column from DB to tree
            treeCell.setAttribute('label',domain);
            treeCell.setAttribute('editable', false);
            treeRow.appendChild(treeCell);

            // Add lengthPass column from DB to tree
            treeCell = document.createElement('treecell');
            treeCell.setAttribute('editable', false);
            treeRow.appendChild(treeCell);

            subTreeItem.appendChild(treeRow);
            subTreeChild.appendChild(subTreeItem);
          }
        }
        treeItem.appendChild(subTreeChild);
        treeChild.appendChild(treeItem);

        stmnt2.finalize();
      }
    }
    stmnt.finalize();
  },

  /**
  * Open and get content of specified file.
  * @function getFileContent
  * @param {string} aURL Chrome URL of specified file.
  * @return {string} Content of specified file.
  */
  getFileContent(aURL){
    var ioService=Components.classes["@mozilla.org/network/io-service;1"]
                  .getService(Components.interfaces.nsIIOService);
    var scriptableStream=Components.classes["@mozilla.org/scriptableinputstream;1"]
                         .getService(Components.interfaces.nsIScriptableInputStream);

    var channel=ioService.newChannel(aURL,null,null);
    var input=channel.open();
    scriptableStream.init(input);
    var str=scriptableStream.read(input.available());
    scriptableStream.close();
    input.close();

    return str;
  },

  /**
  * Get second level domain part of full domain address.
  * @function getSecondLvlDomain
  * @param {string} domain Domain of some web page (wwww.example.com).
  * @return {string} Second level domain name of full domain (example).
  */
  getSecondLvlDomain(domain){
    var psl = {};
    var puny = {};
    Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
              .getService(Components.interfaces.mozIJSSubScriptLoader);
    Components.utils.import("resource://gre/modules/FileUtils.jsm");
    //Components.utils.import("resource://gre/modules/NetUtil.jsm");
    Services.scriptloader.loadSubScript("chrome://passwordgen/content/publicsuffixlist.js", psl);
    Services.scriptloader.loadSubScript("chrome://passwordgen/content/punycode.js", puny);

    var suffListData = "";
    var str={};
    var currentSuffList = FileUtils.getFile("ProfD", ["sufflist.dat"]);
    var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
    var cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].createInstance(Components.interfaces.nsIConverterInputStream);

    try{ // Use current version of sufflist
      fstream.init(currentSuffList, -1, 0, 0);
      cstream.init(fstream, "UTF-8", 0, 0);
      cstream.readString(-1, str);
      suffListData = str.value;
      cstream.close();
    }
    catch(e){ // If some error, use old version of sufflist included with extension
      suffListData = PassGen.getFileContent("chrome://passwordgen/content/sufflist.dat");
    }

    psl.publicSuffixList.parse(suffListData, puny.punycode.toASCII);

    var tmpDomain = psl.publicSuffixList.getDomain(domain);
    var sld = tmpDomain.substr(0,tmpDomain.indexOf("."));

    return sld;
  },

  /**
  * Check if locally stored Public Suffix List isn't older than 1 month.
  * In case that it's older, update list with new version from web.
  * <p>Method is called on browser load.</p>
  * <p>Downloaded Public Suffix List is stored in profile directory.</p>
  * @function updatePubSuffList
  */
  updatePubSuffList(){
    Components.utils.import("resource://gre/modules/Downloads.jsm");
    Components.utils.import("resource://gre/modules/osfile.jsm");
    Components.utils.import("resource://gre/modules/Task.jsm");

    Task.spawn(function* () {
      var suffListPath = OS.Path.join(OS.Constants.Path.profileDir, "sufflist.dat");

      try{
        var info = yield OS.File.stat(suffListPath);
        var suffListMonth = String(info.lastModificationDate.getMonth()+1) + " " + String(info.lastModificationDate.getFullYear());
        var todayMonth = String(new Date().getMonth()+1) + " " + String(new Date().getFullYear());

        if(suffListMonth.localeCompare(todayMonth) != 0){
          // Download current version of Public Suffix List from web
          Downloads.fetch("https://publicsuffix.org/list/public_suffix_list.dat",
                          OS.Path.join(OS.Constants.Path.profileDir, "sufflist.dat"));
        }

        // If Public Suffix List not exist, download it
      } catch (ex) {
          if(ex instanceof OS.File.Error && ex.becauseNoSuchFile){
            Downloads.fetch("https://publicsuffix.org/list/public_suffix_list.dat",
                            OS.Path.join(OS.Constants.Path.profileDir, "sufflist.dat"));
          }
        }
    });
  },

  /**
  * Close database when user close web browser.
  * @function closeWin
  */
  closeWin(){
    PassGen.myDatabase.close();
  },
};

// Call "init()" and "updatePubSuffList()" methods on browser start
window.addEventListener("load", function load(event){
  window.removeEventListener("load", load, false);
  PassGen.init();
  PassGen.updatePubSuffList();
}, false);

// Call method "closeWin" after close browser event
window.addEventListener("close", function close(event){
	PassGen.closeWin();}, false);

// Show "Generate password" item in context menu
window.addEventListener("contextmenu", function(e){
  // If active
  if(PassGen.prefsList[2].value==true){
    if(e.target.nodeName.toLowerCase() == "input" && e.target.type.toLowerCase() == "password"){
      document.getElementById("context-generate").hidden = false;
      PassGen.passBoxTarget = e.target;
    }
    else{
      document.getElementById("separator-generate").hidden = true;
      document.getElementById("context-generate").hidden = true;
      PassGen.passBoxTarget = null;
    }
  }
  else{
    document.getElementById("separator-generate").hidden = true;
    document.getElementById("context-generate").hidden = true;
    PassGen.passBoxTarget = null;
  }
},false);

// Generate password on password input change event (When user type some password)
window.addEventListener("change", function(e){
  // If active
  if(PassGen.prefsList[2].value==true){
    if(e.target.nodeName.toLowerCase() == "input" && e.target.type.toLowerCase() == "password"){
      if(e.target.value == ""){
        return;
      }
      else{
        PassGen.generate(e.target);
      }
    }
  }
},false);
