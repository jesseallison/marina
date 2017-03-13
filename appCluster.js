// ************************************************
//	NEXUS Node Server (Adapted for Diamonds in Dystopia)
//	Jesse Allison (2016)
//  Derick Ostrenko (2016)
//
//	Before Launching:
//		Start up redis with, redis-server
//
//	To Launch:
//		sudo NODE_ENV=production node appCluster.js
//		(sudo is required to launch on port 80.)
//
//	To start server with Xtra RAM:
//		sudo NODE_DEBUG=cluster node --max_old_space_size=4096 appCluster.js
// ************************************************

// Setup web app
//  - using express to serve pages
//  - socket.io to maintain websocket communication
//  - redis for interworker communications/data

var cluster = require('cluster');
var workerNumber = require('os').cpus().length*2;
var express = require('express');
var http = require('http');
var sio = require('socket.io');
var io;
var redis = require('redis');
var redisAdapter = require('socket.io-redis');
var redisClient;	

// Below process.env variables allow you to set parameters when starting the application.
// For example you can run, sudo PORT=8080 WORKERS=32 node appCluster.js.
var serverPort = process.env.PORT || 8081;
var workers = process.env.WORKERS || workerNumber;
var redisPort = process.env.REDISPORT || 6379;
var redisIP = process.env.REDISIP || "localhost";
var redisUrl = process.env.REDISURL || 'redis://'+ redisIP +':' + redisPort;

var app = express();
app.use(express.static(__dirname + '/public'));

// server is the node server (web app via express)
// this code can launch the server on port 80 and switch the user id away from sudo
// apparently this makes it more secure - if something goes awry it isn't running under the superuser.

function startWorker() {
	var httpServer = http.createServer(app);
	var server = httpServer.listen(serverPort, function(err) {
		if (err) return cb(err);
		var uid = parseInt(process.env.SUDO_UID);	// Find out which user used sudo through the environment variable
		if (uid) process.setuid(uid);			// Set our server's uid to that user
		console.log('Server\'s UID is now ' + process.getuid());
	});

	io = sio.listen(server);
	io.adapter(redisAdapter({host: redisIP, port : redisPort }));
	
	console.log('Redis adapter started with url: ' + redisUrl);
	
	redisClient = redis.createClient();
	redisClient.on("error", function (err) {
   		console.log("Error " + err);
	});
}

if(cluster.isMaster) {
	console.log('Start cluster with %s workers', workers - 1);
	workers--;
	for (var i = 0; i < workers; ++i) {
		var worker = cluster.fork();
		console.log('Worker %s started.', worker.process.pid);
	}

	cluster.on('death', function(worker) {
		console.log('Worker %s died. restart...', worker.process.pid);
	});
	
	// FYI!  The master spawns all of the worker nodes. If it is not running under root, the worker nodes cannot connect to port 80.  

} else {
			// ---- Kickoff a Worker! -----
	startWorker();

	var rita = require('rita');

	var dataObj = [];
	var listName = "libbretti";
	var listLength = 90387;

	var markov = new rita.RiMarkov(4);
	var markovArray = [];
	var markovArrayCount = 0;

	// *********************
		// Global Variables!

	var ioClients = [];		// list of clients who have logged in.
	var currentSection = 0;		// current section.
	redisClient.set("currentSection", currentSection);
			// Specific clients who we only want one of.
	var theaterID,
			conrollerID,
			audioControllerID;

	// *********************


// Respond to web sockets with socket.on
	io.sockets.on('connection', function (socket) {
		var ioClientCounter = 0;		// Can I move this outside into global vars?
		
		socket.on('addme', function(data) {
			var username = data.name;
			var userPoem = data.poem;
			var userColor = data.color || [62,35,255];
			// var userNote = data.note;
			var userLocation = data.location || [0.5, 0.5];

			if(username == "theater"){
				theaterID = socket.id;
				redisClient.set("theaterID", theaterID);
				console.log("Hello Theater: " + theaterID);
			}

			if(username == "controller"){
				controllerID = socket.id;
				redisClient.set("controllerID", controllerID);
				console.log("Hello Controller: " + controllerID);
			}

			if(username == "audio_controller"){
				audioControllerID = socket.id;
				redisClient.set("audioControllerID", audioControllerID);
				console.log("Hello Audio Controller: " + audioControllerID);
			}
					// Not really using this...
			if(username == "a_user") {
				ioClients.push(socket.id);
			}

			socket.username = username;  // allows the username to be retrieved anytime the socket is used
					// Can add any other pertinent details to the socket to be retrieved later
			socket.userLocation = userLocation;
			socket.userPoem = userPoem;
			socket.userColor = userColor;
			// socket.userNote = userNote;
					// .emit to send message back to caller.
			socket.emit('chat', 'SERVER: You have connected. Hello: ' + socket.username + " " + socket.id + 'Color: ' + socket.userColor);
					// .broadcast to send message to all sockets.
			//socket.broadcast.emit('chat', 'SERVER: A new user has connected: ' + username + " " + socket.id + 'Color: ' + socket.userColor);

			redisClient.get('currentSection', function(err, reply) {
					currentSection = reply;
					if(currentSection) {
						var title = getSection(currentSection);
						socket.emit('setSection', {sect: currentSection, title: title});
			    }
			});

					// If it is a normal user, alert the audioController
			if(username == "a_user") {
				redisClient.get('audioControllerID', function(err, reply) {
						audioControllerID =reply;
						if(audioControllerID) {
								io.to(audioControllerID).emit('/diamonds/registerUser', {id: socket.id, color: socket.userColor, locationX: socket.userLocation[0], locationY: socket.userLocation[1]}, 1);
				    }
				});
			}
		});
		
		socket.on('disconnect', function() {
					// ioClients.remove(socket.id);	// FIXME: Remove client if they leave
			io.sockets.emit('chat', 'SERVER: ' + socket.id + ' has left the building');
		});


		socket.on('item' , function(data) {
					// --- Someone selected 'item', search for ted Talks that use the word, then markov them. --- //
			console.log(socket.id + " tapped item: " + data);
			
			var matchingTexts = [];
			var cursor = '0';
			
			var tedTexts = sscan(data, function(returnedTexts) {
				console.log("Texts Returned _________\n", returnedTexts);

					// Now Markov the texts
					// console.log(matchingTexts);
				var generatedText = markoving(returnedTexts);
				console.log("*** Generated Text ***", generatedText);
						// Save generated sentances into redis.
				if(generatedText){
					redisClient.lpush("markov", generatedText);
							// Send generated sentances to EVERYONE  FIXME: Should this only be a few people?
					socket.emit('itemback', {phrase: generatedText});
				}

							// --- diamonds > Sending to the Theatre if connected ----
				// if(io.sockets.connected[theaterID]!== null) {
				// 	io.sockets.connected[theaterID].emit('itemback', {
				// 		phrase: generatedText, 
				// 		color: socket.userColor});
				// }
				
			});
			
			function sscan(data, callWhenDone) {
		    redisClient.sscan(
	        "libretti",
	        cursor,
	        'MATCH', '*'+data+'*',
	        'COUNT', '10', // Find 10 occurances of the word that was tapped in the CORPUS.
	        function(err, res) {
            if (err) throw err;

            // Update the cursor position for the next scan
            cursor = res[0];
            // get the SCAN result for this iteration
            var keys = res[1]; // 	     

		            // Remember: more or less than COUNT or no keys may be returned
		            // See http://redis.io/commands/scan#the-count-option
		            // Also, SCAN may return the same key multiple times
		            // See http://redis.io/commands/scan#scan-guarantees
		            // Additionally, you should always have the code that uses the keys
		            // before the code checking the cursor.
            if (keys.length > 0) {
							try {
										// Keep adding matching texts until you get 10.
											// console.log(JSON.parse(keys).title);
								if(matchingTexts.length<10) {
									matchingTexts.push(JSON.parse(keys));
								}
							} catch (err) {
								console.log("error:", err)
							}
            }
		            // It's important to note that the cursor and returned keys
		            // vary independently. The scan is never complete until redis
		            // returns a non-zero cursor. However, with MATCH and large
		            // collections, most iterations will return an empty keys array.

		            // Still, a cursor of zero DOES NOT mean that there are no keys.
		            // A zero cursor just means that the SCAN is complete, but there
		            // might be one last batch of results to process.

		            // From <http://redis.io/commands/scan>:
		            // 'An iteration starts when the cursor is set to 0,
		            // and terminates when the cursor returned by the server is 0.'
            if (cursor === '0') {
            	console.log('--- Iteration complete, matches below ---');
            	
							callWhenDone(matchingTexts); // go markov the results.
              return matchingTexts;		// Must return here or it will loop for a LONG time.
            }
							// Iterate through sscan until you've reached cursor === '0' then end it! 
						return sscan(data,callWhenDone);
        	}
	    	);
			}

			function markoving(textsToMarkov) {
				var contents = [];
						// Extracting the content from the text and making one large text to markov.
				
				for (var i = 0; i < textsToMarkov.length; i++) {
					contents[i] = textsToMarkov[i].content;
					console.log(i+": "+textsToMarkov[i].content);
				}
        	
				var joinedText = contents.join(' '); 
						// console.log("*** LINES JOINED ***", joinedText);

				markov.loadText(joinedText);
						// console.log("markov size:", markov.size());
					
				if (!markov.ready()) {
					return console.log("markov not ready"); // Discontinue if markov is not ready
				} 

				var lines = markov.generateSentences(3);
				var markovJoined = lines.join(' ');
				return markovJoined;
			}
		}); 

		socket.on('sendchat', function(data) {
			// Transmit to everyone who is connected //
			io.sockets.emit('chat', socket.username, data);
		});


		socket.on('interactionTrail', function(data) {
			console.log("Received interactionTrail: "+ data);
			// send somewhere?  perhaps theatre?
			redisClient.lpush("interactionTrail", data);		// Store for some other time...
		})


		socket.on('nextChord', function(data) {
			redisClient.get('audioControllerID', function(err, reply) {
					audioControllerID =reply;
					if(audioControllerID) {
						io.to(audioControllerID).emit('/diamonds/nextChord', {id: socket.id}, 1);
			    }
			});
			socket.broadcast.emit('triggerNextChord', data);
		});

		socket.on('triggerBeginning', function(data) {
			redisClient.get('audioControllerID', function(err, reply) {
					audioControllerID =reply;
					if(audioControllerID) {
						io.to(audioControllerID).emit('/diamonds/triggerBeginning', {id: socket.id}, 1);
			    }
			});
			socket.broadcast.emit('triggerBeginning', data);
		});

		socket.on('triggerUtopalypse', function(data) {
			redisClient.get('audioControllerID', function(err, reply) {
				audioControllerID =reply;
				if(audioControllerID) {
					io.to(audioControllerID).emit('/diamonds/triggerUtopalypse', {id: socket.id}, 1);
		    }
			});
			socket.broadcast.emit('triggerUtopalypse', data);
		});

		socket.on('triggerDiamonds', function(data) {
			redisClient.get('audioControllerID', function(err, reply) {
				audioControllerID =reply;
				if(audioControllerID) {
					io.to(audioControllerID).emit('/diamonds/triggerDiamonds', {id: socket.id}, 1);
		    }
			});
			socket.broadcast.emit('triggerDiamonds', data);
		});

		socket.on('triggerEnding', function(data) {
			redisClient.get('audioControllerID', function(err, reply) {
				audioControllerID =reply;
				if(audioControllerID) {
					io.to(audioControllerID).emit('/diamonds/triggerEnding', {id: socket.id}, 1);
		    }
			});
			socket.broadcast.emit('triggerEnding', data);
		});


		socket.on('selectedPhrase', function(data) {
			console.log("****** Phrase Selected: ******\n"+ data);
			
			redisClient.lpush("generatedPoem", data);

			redisClient.get('theaterID', function(err, reply) {
				theaterID =reply;
				if(theaterID) {
					io.to(theaterID).emit('selectedPhrase', {phrase: data});
		    }
			});

			redisClient.get('audioControllerID', function(err, reply) {
				audioControllerID =reply;
				if(audioControllerID) {
					io.to(audioControllerID).emit('/diamonds/selectedPhrase', {phrase: data}, 1);
		    }
			});
		})

		socket.on('section', function(data) {
			console.log("Section is now: "+ data);
			currentSection = data;
			redisClient.set("currentSection", currentSection);
			sendSection(currentSection);
		})

		// *********************
		// Functions for handling stuff
		
		// **** SECTIONS ****
		var sectionTitles = [	"Welcome", 
													"Markov", 
													"Diamonds in Distopia", 
													"Markov", 
													"for a minute", 
													"End"];

		getSection = function(sect){
			return sectionTitles[sect];
		}

		// sendSection(currentSection);	 // Sets everyone's section
		sendSection = function (sect) {
			var title = getSection(sect);
			io.sockets.emit('setSection', {sect: sect, title: title});

			redisClient.get('audioControllerID', function(err, reply) {
				audioControllerID =reply;
				if(audioControllerID) {
					io.to(audioControllerID).emit('/diamonds/currentSection', {section: sect, title: title}, 1);
		    }
			});
		};

			// Section shared from Max to UIs
		shareSection = function(sect) {
			var title = getSection(sect);
			io.sockets.emit('setSection', sect, title);
		};


		// pick a random user from those still connected and return the user
		getRandomUser = function() {
			var randomUser = Math.floor(Math.random() * ioClients.length);
			var user = io.sockets.socket(ioClients[randomUser]);
			return user;
		};

		getNextUser = function() {
			// console.log("ioClients Length: ", ioClients.length);
			// console.log("io.sockets.socket length: ", io.sockets.socket.length);
			var user = io.sockets.socket(ioClients[ioClientCounter]);
			ioClientCounter = ioClientCounter + 1;
			if (ioClientCounter >= ioClients.length) {
				ioClientCounter = 0;
			}
			// console.log("Username ", user.username);

			return user;
		};

		function getRandomColor() {
			var letters = '0123456789ABCDEF'.split('');
			var color = '#';
			for (var i = 0; i < 6; i++ ) {
			    color += letters[Math.floor(Math.random() * 16)];
			}
			return color;
		};
	});
}