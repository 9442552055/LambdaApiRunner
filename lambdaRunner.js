var MongoClient = require('mongodb').MongoClient;
var childProcessHandler = require('./childProcessHandler');

var _store = {
    childProcess: []
};
process.on('exit', function() {
    for (var a = 0; a < childProcess.length; a++) {
        _store.childProcess[a].process.exit(0);
    }
    _store.db.close();
    console.log("Exited");
});

process.on('uncaughtException', function(err) {
    console.log('Caught exception: ' + err);
});

process.on('SIGINT', function() {
    console.log('Got SIGINT.  Press Control-D to exit.');
    process.exit();
});



var getChildEventHandler = function(apiDetail) {
    return function(process, filename) {
        childProcess.push({ filename: filename, process: process });
        process.on('exit', function() {
            console.log("Exited");
            //childProcessHandler.execute(FileRemover, ['./' + filename + '.js']);
            //FileRemover(filename);
        });
        process.on('uncaughtException', function(err) {
            console.log('Caught exception: ' + err);
        });

        process.on('SIGINT', function() {
            console.log('Got SIGINT.  Press Control-D to exit.');
            process.exit();
        });
    }
};
// Connection url
var url = 'mongodb://localhost:27017/NodeApis';
// Connect using MongoClient
MongoClient.connect(url, function(err, db) {
    // Use the admin database for the operation
    //var adminDb = db.admin();
    // List all the available databases
    // adminDb.listDatabases(function(err, dbs) {
    //     console.log(dbs)
    // });
    _store.db = db;
    db.collection('ApiServices').find(function(err, cursor) {
        // while (cursor.hasNext()) {
        //    var apiDetail = cursor.next();
        cursor.each(function(err, apiDetail) {
            //fork child process
            //runApiServer(apiDetail);
            if (apiDetail && apiDetail.port) {
                childProcessHandler.execute(runApiServer, [apiDetail], getChildEventHandler(apiDetail)).then(function(apiDetail) {
                    return function(s) {
                        console.log("signal from child", apiDetail.port);
                    }
                }, function(e) {
                    console.error("Error in fork child process", e);
                });
            }
        });
        //}
    });

});



var runApiServer = function runApiServer(apiInfo) {
    var http = require('http');
    var url = require('url');
    var getRouteHandler = function getRouteHandler(req, apiConfig, callback) {
        var reqURL = url.parse(req.url);
        var split = reqURL.pathname.split('/');
        var i = 1;
        var hConfig = apiConfig.handlers['/' + split[i]];
        var urlParams = [];
        i++;
        while (split.length > i) {
            if (hConfig && hConfig['/' + split[i]]) {
                hConfig = hConfig['/' + split[i]];
            } else if (hConfig && hConfig['urlParam']) {
                /*check for url parameters*/
                var param = {
                    key: hConfig['urlParam'].paramName,
                    value: split[i]
                };
                urlParams.push(param);
                hConfig = hConfig['urlParam'];
            }
            i++;
        }

        return callback(hConfig, urlParams);
    }

    if (apiInfo && apiInfo.port) {
        try {
            var server = http.createServer(function(apiConfig) {
                return function(req, res) {
                    getRouteHandler(req, apiConfig, function(config, urlparams) {
                        /*console.log("success", config, urlparams);*/
                        if (config && config[req.method]) {
                            try {
                                require(config[req.method])(req, urlparams, function(result) {
                                    res.end(JSON.stringify(result), 200);
                                });
                            } catch (e) {
                                console.error(e);
                                res.end(JSON.stringify(e), 500);
                            }
                        } else {
                            res.end("Not found", 404);
                        }
                    });
                };
            }(apiInfo));
            server.listen(apiInfo.port, "0.0.0.0", function() {
                console.log("Server running in port", server.address().port)
            });
        } catch (e) {
            console.error("server launch failed!!", e);
        }
    }

    return "runApiServer method executed!!";
};