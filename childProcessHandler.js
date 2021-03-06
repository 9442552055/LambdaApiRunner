var child = require('child_process');
var Promise = require('promise');
var os = require('os');
var fs = require('fs');
var beautify = require('js-beautify').js_beautify;
var FileRemover = require("./FileRemover");

module.exports = {
    execute: execute,
    setMaxNumberOfProcesses: setMaxNumberOfProcesses
}

var maxNumberOfProcesses = os.cpus().length - 1;

var numberOfRunningProcesses = 0;
var requestsQueue = [];


function setMaxNumberOfProcesses(numOfProcesses) {
    maxNumberOfProcesses = numOfProcesses;
}

function execute(func, args, callback) {
    return new Promise(function(resolve, reject) {

        var request = { func: func, args: args, resolve: resolve, reject: reject, callback: callback };
        requestsQueue.push(request);

        if (numberOfRunningProcesses < maxNumberOfProcesses) {

            executeFromQueue();
        }
    });
}

function executeFromQueue() {
    var toExecute = requestsQueue.shift();

    executeRequest(toExecute).then(function(result) {
        toExecute.resolve(result);
        executeFromQueue();
    }).catch(function(error) {
        toExecute.reject(error);
        executeFromQueue();
    });
}

function executeRequest(request) {

    return new Promise(function(resolve, reject) {
        var func = request.func;
        var args = request.args;

        var arguments = getArguments(args);
        var filename = newConsoleCommand = request.filename || Math.random().toString().replace('.', '');
        //var replaceConsoleCommand = 'var ' + newConsoleCommand + ' = console.log; console.log = function () {};';
        var funcCommand = func.toString().replace(/(\r\n|\n|\r)/gm, "");
        //var outputCommand = newConsoleCommand + '(' + func.name + '(' + arguments + '));';
        var outputCommand = func.name + '(' + arguments + ');';
        //outputCommand = outputCommand.replace(/"/g, '\\\"');
        //****** edited by Arun here */
        var js = beautify(funcCommand + ' ' + outputCommand, { indent_size: 2 });
        fs.writeFile('./' + filename + '.js', js, function(err) {
            if (!err) {
                var command = 'node ' + filename + '.js';
                numberOfRunningProcesses++;
                var cProcess = child.exec(command, function(error, stdout, stderr) {
                    if (error) {
                        reject(error);
                    } else {
                        try {
                            resolve(JSON.parse(stdout.replace(/(\r\n|\n|\r)/gm, "")));
                        } catch (e) {
                            resolve(stdout.replace(/(\r\n|\n|\r)/gm, ""));
                        }
                    }
                });
                cProcess.on('exit', function() {
                    numberOfRunningProcesses--;
                    FileRemover(filename);

                });
                request.callback(cProcess, './' + filename + '.js')
            }
        });




    });
}

function getArguments(args) {
    if (args == undefined) return '';

    if (!(args instanceof Array)) args = [args];

    var result = [];

    args.forEach(function(arg) {
        var str = "'" + arg + "'";

        console.log();
        if (typeof(arg) != 'string') {

            str = JSON.stringify(arg);
        }
        result.push(str);
    });

    return result.join();
}