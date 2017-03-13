var rita = require('rita');
var workers = require("./appCluster.js");

var asdf = workers.inworker(function(err){

var dataObj = [];
var listName = "items";
var listLength = 2000;

var markov = new rita.RiMarkov(4);
var markovArray = [];
var markovArrayCount = 0;

});