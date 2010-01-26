/** Called automatically by JsDoc Toolkit. */
function publish(symbolSet) {
	publish.conf = {  // trailing slash expected for dirs
		ext:         ".html",
		outDir:      JSDOC.opt.d || SYS.pwd+"../out/jsdoc/",
		templatesDir: JSDOC.opt.t || SYS.pwd+"../templates/jsdoc/",
		symbolsDir:  "symbols/",
		srcDir:      "symbols/src/"
	};
	
    load(publish.conf.templatesDir + "json2.js");

	// is source output is suppressed, just display the links to the source file
	if (JSDOC.opt.s && defined(Link) && Link.prototype._makeSrcLink) {
		Link.prototype._makeSrcLink = function(srcFilePath) {
			return "&lt;"+srcFilePath+"&gt;";
		};
	}
	
	// create the folders and subfolders to hold the output
	IO.mkPath((publish.conf.outDir+"symbols/src").split("/"));
		
	// used to allow Link to check the details of things being linked to
	Link.symbolSet = symbolSet;

	// create the required templates
	try {
		var classTemplate = new JSDOC.JsPlate(publish.conf.templatesDir+"class.tmpl");
		var classesTemplate = new JSDOC.JsPlate(publish.conf.templatesDir+"allclasses.tmpl");
	}
	catch(e) {
		print("Couldn't create the required templates: "+e);
		quit();
	}
	
	// get an array version of the symbolset, useful for filtering
	var symbols = symbolSet.toArray();
	
    // create the hilited source code files
    var files = JSDOC.opt.srcFiles;
    for (var i = 0, l = files.length; i < l; i++) {
        var file = files[i];
        var srcDir = publish.conf.outDir + "symbols/src/";
        makeSrcFile(file, srcDir);
    }
    
    // get a list of all the classes in the symbolset
    var classes = symbols.filter(isaClass).sort(makeSortby("alias"));
    
    // create a filemap in which outfiles must be to be named uniquely, ignoring case
    if (JSDOC.opt.u) {
        var filemapCounts = {};
        Link.filemap = {};
        for (var i = 0, l = classes.length; i < l; i++) {
            var lcAlias = classes[i].alias.toLowerCase();
            
            if (!filemapCounts[lcAlias]) filemapCounts[lcAlias] = 1;
            else filemapCounts[lcAlias]++;
            
            Link.filemap[classes[i].alias] = 
                (filemapCounts[lcAlias] > 1)?
                lcAlias+"_"+filemapCounts[lcAlias] : lcAlias;
        }
    }
    
    // create a class index, displayed in the left-hand column of every class page
    Link.base = "../";

    // create each of the class pages
    for (var i = 0, l = classes.length; i < l; i++) {
        var symbol = classes[i];
        
        symbol.events = symbol.getEvents();   // 1 order matters
        symbol.methods = symbol.getMethods(); // 2
        
        Link.currentSymbol= symbol;
        var output = "";
        output = classTemplate.process(symbol);
        
        IO.saveFile(publish.conf.outDir+"symbols/", ((JSDOC.opt.u)? Link.filemap[symbol.alias] : symbol.alias) + publish.conf.ext, output);
    }
    
    Link.base = "";
    var tree = buildTreeIndex(symbolSet);
    var searchIndex = buildSearchIndex(symbolSet);
    IO.saveFile(publish.conf.outDir, 'data.js', 'uki.doc.indexesLoaded(' + JSON.stringify(tree) + ', ' + JSON.stringify(searchIndex) + ')');
    copyStatic();
    
    
    
    // regenerate the index with different relative links, used in the index pages
    Link.base = "";
    var classes = symbolSet.toArray().filter(isaNonGlobalClass);
    // create the class index page
    try {
        var classesindexTemplate = new JSDOC.JsPlate(publish.conf.templatesDir+"class_index.tmpl");
    }
    catch(e) { print(e.message); quit(); }
    
	var classesIndex = classesindexTemplate.process(classes);
    IO.saveFile(publish.conf.outDir, "class_index"+publish.conf.ext, classesIndex);
    // classesindexTemplate = classesIndex = classes = null;
	//     
	//     // create the file index page
	//     try {
	//         var fileindexTemplate = new JSDOC.JsPlate(publish.conf.templatesDir+"allfiles.tmpl");
	//     }
	//     catch(e) { print(e.message); quit(); }
	//     
	//     var documentedFiles = symbols.filter(isaFile); // files that have file-level docs
	//     var allFiles = []; // not all files have file-level docs, but we need to list every one
	//     
	//     for (var i = 0; i < files.length; i++) {
	//         allFiles.push(new JSDOC.Symbol(files[i], [], "FILE", new JSDOC.DocComment("/** */")));
	//     }
	//     
	//     for (var i = 0; i < documentedFiles.length; i++) {
	//         var offset = files.indexOf(documentedFiles[i].alias);
	//         allFiles[offset] = documentedFiles[i];
	//     }
	//         
	//     allFiles = allFiles.sort(makeSortby("name"));
	// 
	//     // output the file index page
	//     var filesIndex = fileindexTemplate.process(allFiles);
	//     IO.saveFile(publish.conf.outDir, "files"+publish.conf.ext, filesIndex);
	//     fileindexTemplate = filesIndex = files = null;
}

function copyStatic () {
    var src = publish.conf.templatesDir+'static/';
	var paths = IO.ls(src, 3);
	for (var i=0; i < paths.length; i++) {
	    var relativePath = paths[i].substring(src.length);
	    var dest = publish.conf.outDir+relativePath;
	    var mkPathParams = dest.split("/");
	    mkPathParams.pop();
    	IO.mkPath(mkPathParams);
    	IO.copyFile(paths[i], publish.conf.outDir, relativePath);
	};
}

function filterOwn (thisClass, items) {
    if (!items) return [];
    return items.filter(function($){return $.memberOf == thisClass.alias  && !$.isNamespace});
}

function addSearchFields (array) {
    array.forEach(function(item) {
        item.searchIndex = item.name.toLowerCase();
        item.longSearchIndex = (item.memberOf + '.' + item.name).toLowerCase();
    });
    return array;
}

function addBasePath (path, items) {
    items.forEach(function(item) {
        item.basePath = path;
    })
    return items;
}

function buildSearchIndex (symbolSet) {
    var classes = symbolSet.toArray().filter(isaNonGlobalClass);
    var methods = [],
        events = [],
        properties = [];
    classes.forEach(function(thisClass) {
        thisClass.path = new Link().toClass(thisClass.alias).toString().match(/href="([^"]+)"/)[1];
        methods = methods.concat(addBasePath(thisClass.path, filterOwn(thisClass, thisClass.methods)));
        events = events.concat(addBasePath(thisClass.path, filterOwn(thisClass, thisClass.events)));
        properties = properties.concat(addBasePath(thisClass.path, filterOwn(thisClass, thisClass.properties)));
    });
    
    classes = classes.map(function(thisClass) {
        return {
            name: aliasToName(thisClass.alias.match(/([^\.]+)$/)[1]),
            memberOf: thisClass.memberOf,
            augments: thisClass.augments.length ? thisClass.augments
                .map(function(baseClass) { 
                    return baseClass;
                }).join(', ') : '',
            params: thisClass.is('FUNCTION') ? makeSignature(thisClass.params) : '',
            desc: summarize(thisClass.desc),
            path: thisClass.path
        };
    }).sort(makeSortby('name'));
    
    methods = methods.map(function(thisMethod) {
        return {
            name: aliasToName(thisMethod.name),
            memberOf: thisMethod.memberOf,
            params: makeSignature(thisMethod.params),
            desc: summarize(thisMethod.desc),
            path: thisMethod.basePath + '#' + Link.symbolNameToLinkName(thisMethod)
        };
    }).sort(makeSortby('name'));
    
    events = events.map(function(thisEvent) {
        return {
            name: aliasToName(thisEvent.name),
            memberOf: thisEvent.memberOf,
            params: makeSignature(thisEvent.params),
            desc: summarize(thisEvent.desc),
            path: thisEvent.basePath + '#' + Link.symbolNameToLinkName(thisEvent)
        };
    }).sort(makeSortby('name'));
    
    properties = properties.map(function(thisProp) {
        return {
            name: aliasToName(thisProp.name),
            memberOf: thisProp.memberOf,
            desc: summarize(thisProp.desc),
            path: thisProp.basePath + '#' + Link.symbolNameToLinkName(thisProp)
        };
    }).sort(makeSortby('name'));
    
    return addSearchFields(classes.concat(methods).concat(events).concat(properties));
}

function aliasToName (alias) {
    return alias.match(/([^\.]+)$/)[1];
}

function buildTreeIndex (symbolSet) {
    var files = JSDOC.opt.srcFiles;
    var classes = symbolSet.toArray().filter(isaNonGlobalClass).sort(makeSortby("alias"));
    
    var fileMap = {};
    for (var i=0; i < files.length; i++) {
        var parts = files[i].split('/'),
            current = fileMap;
        for (var j=0; j < parts.length - 1; j++) {
            var part = parts[j];
            current = current[part] = current[part] || {}
        };
        current[parts[parts.length - 1]] = files[i];
    };
    
    var fileTree = buildFileTree(fileMap);
    var classTree = classes.filter(hasNoParent).sort(makeSortby("alias")).map(buildClassTree);
    return [
        { data: { name: 'files', files: 'true' }, children: fileTree }
    ].concat(classTree);
    
    
    function buildClassTree (thisClass) {
        var result  = {
            data: {
                name: aliasToName(thisClass.alias),
                path: new Link().toClass(thisClass.alias).toString().match(/href="([^"]+)"/)[1]
            }
        };
        if (thisClass.isNamespace) {
            result.children = classes.filter(function($) { 
                return $.memberOf == thisClass.alias;
            }).sort(makeSortby("alias")).map(buildClassTree);
        }
        return result;
    }
    
    function hashKeys (x) {
        var result = [];
        for (var i in x) result.push(i);
        return result;
    }
    
    function buildFileTree (fileMap) {
        var keys = hashKeys(fileMap).sort();
        var result = [];
        for (var i=0; i < keys.length; i++) {
            var node = fileMap[keys[i]],
                row = {
                    data: {
                        name: keys[i]
                    }
                };
            if (typeof node == 'string') {
                row.data.path = 'symbols/src/' +  srcFileName(node) + publish.conf.ext;
            } else {
                row.children = buildFileTree(node);
            }
            result.push(row);
        };
        return result;
    }
    
}

// some ustility filters
function hasNoParent($) {return ($.memberOf == "");}
function isaFile($) {return ($.is("FILE"));}
function isaClass($) {return ($.is("CONSTRUCTOR") || $.isNamespace);}
function isaNonGlobalClass($) {return $.alias != '_global_' && ($.is("CONSTRUCTOR") || $.isNamespace);}



/** Just the first sentence (up to a full stop). Should not break on dotted variable names. */
function summarize(desc) {
	if (typeof desc != "undefined")
		return desc.match(/([\w\W]+?\.)[^a-z0-9_$]/i)? RegExp.$1 : desc;
}

/** Make a symbol sorter by some attribute. */
function makeSortby(attribute) {
	return function(a, b) {
		if (a[attribute] != undefined && b[attribute] != undefined) {
			a = a[attribute].toLowerCase();
			b = b[attribute].toLowerCase();
			if (a < b) return -1;
			if (a > b) return 1;
			return 0;
		}
	};
}

/** Pull in the contents of an external file at the given path. */
function include(path) {
	var path = publish.conf.templatesDir+path;
	return IO.readFile(path);
}

function srcFileName (path) {
	var name = path.replace(/\.\.?[\\\/]/g, "").replace(/[\\\/]/g, "_");
	return name.replace(/\:/g, "_");
}

/** Turn a raw source file into a code-hilited page in the docs. */
function makeSrcFile(path, srcDir, name) {
	if (JSDOC.opt.s) return;
	
	name = name || srcFileName(path);
	var src = {path: path, name:name, charset: IO.encoding, hilited: ""};
	
	if (defined(JSDOC.PluginManager)) {
		JSDOC.PluginManager.run("onPublishSrc", src);
	}

	if (src.hilited) {
		IO.saveFile(srcDir, name+publish.conf.ext, src.hilited);
	}
}

/** Build output for displaying function parameters. */
function makeSignature(params) {
	if (!params) return "()";
	var signature = "("
	+
	params.filter(
		function($) {
			return $.name.indexOf(".") == -1; // don't show config params in signature
		}
	).map(
		function($) {
			return $.name;
		}
	).join(", ")
	+
	")";
	return signature;
}

/** Find symbol {@link ...} strings in text and turn into html links */
function resolveLinks(str, from) {
	str = str.replace(/\{@link ([^} ]+) ?\}/gi,
		function(match, symbolName) {
			return new Link().toSymbol(symbolName);
		}
	);
	
	return str;
}
