module.exports = class Connection {
    constructor() {
        this.socket;
        this.player;
        this.server;
        this.lobby;
    }

    //Handles all our io events and where we should route them too to be handled
    createEvents() {
        let connection = this;
        let socket = connection.socket;
        let server = connection.server;
        let player = connection.player;

        socket.on('disconnect', function() {
            server.onDisconnected(connection);
        });

        socket.on('createAccount', function(data) {
            if(data.username != "" && data.password != ""){
                server.database.CreateAccount(data.username,data.password, results => {
                    //result will return true or false depending on an already existing account
                    console.log(results.valid + ': ' + results.reason);
                })
            }
            else{
                let returnData = {
                    reason: "Failed To Create User"
                }
                socket.emit('signInFailed' , returnData);
            }
        });

        socket.on('signIn', function(data) {
            if(data.username != "" && data.password != ""){
                server.database.SignIn(data.username,data.password, results => {
                    //result will return true or false depending on an already existing account
                    console.log(results.valid + ': ' + results.reason);
                    if(results.valid){
                        //store username in player object
                        player.username = data.username;

                        //get High scores                     
                        server.database.GetTop5HighScores(results => {                  
                            //console.log(results);
                            let returnData = {
                                id: player.id,
                                username: data.username,
                                highScores: results
                            }
                            //console.log(data.username);

                            socket.emit('signIn' , returnData);     
                        })              
                    }
                    else{
                        let returnData = {
                            reason: "Failed To Log In Check Username Or Password"
                        }
                        socket.emit('signInFailed' , returnData);
                    }
                })
            }
            else{
                let returnData = {
                    reason: "Failed To Log In Check Username Or Password"
                }
                socket.emit('signInFailed' , returnData);
            }
        });

        socket.on('play', function() {
            server.database.GetTop5HighScores(results => {                  
                //console.log(results);
                let returnData = {
                    highScores: results
                }
                //console.log(data.username);
                socket.emit('highScoresReceivedPlay' , returnData);     
            })
        });

        socket.on('signOut', function() {
            server.onSwitchLobby(connection, server.generalServerID);
        });
        
        socket.on('joinGame', function() {
            server.onAttemptToJoinGame(connection);
        });

        socket.on('fireBullet', function(data) {
            connection.lobby.onFireBullet(connection, data);
        });

        socket.on('collisionDestroy', function(data) {
            connection.lobby.onCollisionDestroy(connection, data);
        });

        socket.on('updatePosition', function(data) {
            player.position.x = data.position.x;
            player.position.y = data.position.y;

            socket.broadcast.to(connection.lobby.id).emit('updatePosition', player);
        });

        socket.on('updateRotation', function(data) {
            player.tankRotation = data.tankRotation;
            player.barrelRotation = data.barrelRotation;

            socket.broadcast.to(connection.lobby.id).emit('updateRotation', player);
        });

        socket.on('quitGame',function(data){
            server.onSwitchLobby(connection, server.generalServerID);
        });

        socket.on('getHighScores',function(data){
            server.database.GetTop5HighScores(results => {                  
                //console.log(results);
                let returnData = {
                    state: "EndGame",  
                    highScores: results

                }
                //console.log(data.username);
                socket.emit('highScoresReceived' , returnData);     
            })
        });
    }
}