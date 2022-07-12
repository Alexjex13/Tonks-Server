let LobbyBase = require('./LobbyBase')
let GameLobbySettings = require('./GameLobbySetting')
let Connection = require('../Connection')
let Bullet = require('../Bullet')
let LobbyState = require('../Utility/LobbyState')
let Vector2 = require('../Vector2')
let ServerItem = require('../Utility/ServerItem')
let AIBase = require('../AI/AIBase')
let TankAI = require('../AI/TankAI')

module.exports = class GameLobbby extends LobbyBase {
    constructor(settings = GameLobbySettings) {
        super();
        this.settings = settings;
        this.lobbyState = new LobbyState();
        this.bullets = [];
        this.endGameLobby = function(){};
    }

    onUpdate() {
        super.onUpdate();

        let lobby = this;
        let serverItems = lobby.serverItems; 
        
        let aiList = serverItems.filter(item => {return item instanceof AIBase;});
        aiList.forEach(ai => {
            if(ai.isDead)
            {
                return;
            }
            //Update each ai unity, passing in a function for those that need to update other connections
            ai.onObtainTarget(lobby.connections);

            ai.onUpdate(data => {
                lobby.connections.forEach(connection => {
                    let socket = connection.socket;
                    socket.emit('updateAI', data);
                });
            }, (data) => {
                lobby.onFireBullet(undefined, data, true);
            });
        });

        lobby.updateBullets();
        lobby.updateDeadPlayers();

        //close lobby because noone is here
        if(lobby.connections == 0){
            lobby.endGameLobby();
        }
    }

    canEnterLobby(connection = Connection) {
        let lobby = this;
        let maxPlayerCount = lobby.settings.maxPlayers;
        let currentPlayerCount = lobby.connections.length;

        if(currentPlayerCount + 1 > maxPlayerCount) {
            return false;
        }

        return true;
    }

    onEnterLobby(connection = Connection) {
        let lobby = this;
        let socket = connection.socket;

        super.onEnterLobby(connection);

        //lobby.addPlayer(connection);

        //make sure we have enough players to continue
        if (lobby.connections.length != lobby.settings.maxPlayers) {
            console.log("Not Enough Players");
            lobby.lobbyState.currentState = lobby.lobbyState.LOBBY;
            let returnData = {
                state: lobby.lobbyState.currentState,
            };
            socket.emit('lobbyUpdate', returnData);
            socket.broadcast.to(lobby.id).emit('lobbyUpdate', returnData);
            return
        }
        
        console.log('We have enough players we can start the game');
        lobby.lobbyState.currentState = lobby.lobbyState.GAME;
        lobby.onSpawnAllPlayersIntoGame();            
        // for(let i = 0;i < 2;i++){
            let randomPosition = lobby.getRandomSpawnForAI();
            lobby.onSpawnAIIntoGame(randomPosition.x,randomPosition.y);            
        // }

        let returnData = {
            state: lobby.lobbyState.currentState,
            maxGameTime: 120
        };

        socket.emit('loadGame',returnData);
        socket.broadcast.to(lobby.id).emit('loadGame',returnData);
        socket.emit('lobbyUpdate', returnData);
        socket.broadcast.to(lobby.id).emit('lobbyUpdate', returnData);

        //Handle spawning any server spawned objects here
        //Example: loot, perhaps flying bullets etc
    }

    onLeaveLobby(connection = Connection) {
        let lobby = this;

        super.onLeaveLobby(connection);

        lobby.removePlayer(connection);

        //Handle unspawning any server spawned objects here
        //Example: loot, perhaps flying bullets etc
        lobby.onUnspawnAllAIInGame(connection);

        //determine if there are enough players to continue
        if (lobby.connections.length < lobby.settings.minPlayers || lobby.id == 'General Server') {
            lobby.connections.forEach(connection =>{
                if(connection != undefined){
                    let returnData = {
                        state: lobby.lobbyState.ENDGAME
                    }
                    connection.socket.emit('unloadGame',returnData);
                    connection.server.onSwitchLobby(connection,connection.server.generalServerID);
                }
            });
        }
    }

    onSpawnAllPlayersIntoGame() {
        let lobby = this;
        let connections = lobby.connections;

        connections.forEach(connection => {            
            lobby.addPlayer(connection);
        });
    }

    onSpawnAIIntoGame(positionx, positiony) {
        let lobby = this;
        lobby.onServerSpawn(new TankAI(), new Vector2(positionx, positiony));
    }

    onUnspawnAllAIInGame(connection = Connection) {
        let lobby = this;
        let serverItems = lobby.serverItems;

        //Remove all server items from the client, but still leave them in the server others
        serverItems.forEach(serverItem => {
            connection.socket.emit('serverUnspawn', {
                id: serverItem.id,
                name: "AI",
                position: {
                    x: serverItem.position.x,
                    y: serverItem.position.y
                }
            });
        });
    }

    updateBullets() {
        let lobby = this;
        let bullets = lobby.bullets;
        let connections = lobby.connections;

        bullets.forEach(bullet => {
            let isDestroyed = bullet.onUpdate();

            if(isDestroyed) {
                lobby.despawnBullet(bullet);
            } else {
                /*var returnData = {
                    id: bullet.id,
                    position: {
                        x: bullet.position.x,
                        y: bullet.position.y
                    }
                }

                connections.forEach(connection => {
                    connection.socket.emit('updatePosition', returnData);
                });*/
            }
        });
    }

    updateDeadPlayers() {
        let lobby = this;
        let connections = lobby.connections;

        connections.forEach(connection => {
            let player = connection.player;

            if(player.isDead) {
                let isRespawn = player.respawnCounter();
                if(isRespawn) {
                    let socket = connection.socket;
                    let returnData = {
                        id: player.id,
                        position: lobby.getRandomSpawn()
                    }

                    socket.emit('playerRespawn', returnData);
                    socket.broadcast.to(lobby.id).emit('playerRespawn', returnData);
                }
            }
        });

        let aiList = lobby.serverItems.filter(item => {return item instanceof AIBase;});
        aiList.forEach(ai => {            
            if(ai.isDead) {
                let isRespawn = ai.respawnCounter();
                if(isRespawn && connections[0].socket != undefined) {
                    let socket = connections[0].socket;
                    let position = lobby.getRandomSpawnForAI();
                    ai.position = position;
                    let returnData = {
                        id: ai.id,
                        position: position
                    }
                    socket.emit('playerRespawn', returnData);
                    socket.broadcast.to(lobby.id).emit('playerRespawn', returnData);
                }
            }
        });
    }

    onFireBullet(connection = Connection, data, isAI = false) {
        let lobby = this;

        let bullet = new Bullet();
        bullet.name = 'Bullet';
        bullet.activator = data.activator;
        bullet.position.x = data.position.x;
        bullet.position.y = data.position.y;
        bullet.direction.x = data.direction.x;
        bullet.direction.y = data.direction.y;

        lobby.bullets.push(bullet);

        var returnData = {
            name: bullet.name,
            id: bullet.id,
            activator: bullet.activator,
            position: {
                x: bullet.position.x,
                y: bullet.position.y
            },
            direction: {
                x: bullet.direction.x,
                y: bullet.direction.y
            },
            speed: bullet.speed
        }

        if (!isAI) {
            connection.socket.emit('serverSpawn', returnData);
            connection.socket.broadcast.to(lobby.id).emit('serverSpawn', returnData); //Only broadcast to those in the same lobby as us
        } else if (lobby.connections.length > 0) {
            lobby.connections[0].socket.emit('serverSpawn', returnData);
            lobby.connections[0].socket.broadcast.to(lobby.id).emit('serverSpawn', returnData); //Broadcast to everyone that the ai spawned a bullet for
        }        
    }

    onCollisionDestroy(connection = Connection, data) {
        let lobby = this;

        let returnBullets = lobby.bullets.filter(bullet => {
            return bullet.id == data.id
        });

        returnBullets.forEach(bullet => {
            let playerHit = false;

            lobby.connections.forEach(c => {
                let player = c.player;

                if(bullet.activator != player.id) {
                    let distance = bullet.position.Distance(player.position);
                    if(distance < 0.8) {
                        let isDead = player.dealDamage(50);
                        if(isDead) {
                            console.log('Player with id: ' + player.id + ' has died');                       
                            let scoreCounter = lobby.increasePlayerScore(c,player,-1);
                            let playerName = player.username;
                            console.log(player.displayPlayerInformation() + ' Has a score of: ' +  player.score)
                            let returnData = {
                                id: player.id,
                                playerScore: scoreCounter,
                                playerName: playerName
                            }
                            c.socket.emit('playerDied', returnData);
                            c.socket.broadcast.to(lobby.id).emit('playerDied', returnData);
                        } else {
                            console.log('Player with id: ' + player.id + ' has (' + player.health + ') health left');
                        }
                        playerHit = true;
                        lobby.despawnBullet(bullet);
                    }
                }
            });

            if (!playerHit) {
                let aiList = lobby.serverItems.filter(item => {return item instanceof AIBase;});
                let isAnotherAI = false;
                aiList.forEach(ai => {
                    if(ai.id == bullet.activator){
                        isAnotherAI = true;
                    }
                });
                aiList.forEach(ai => {                   
                    if (bullet.activator != ai.id && !isAnotherAI) { //checks if its not itself or any other AI
                        let distance = bullet.position.Distance(ai.position);
                        if (distance < 0.8) {
                            let isDead = ai.dealDamage(50);
                            if (isDead) {
                                console.log('Ai has died');    
                                let scoreCounter = 0;     
                                let playerName = "";                       
                                lobby.connections.forEach(c => {
                                    let player = c.player;
                                    if(player.id == bullet.activator){
                                        scoreCounter = lobby.increasePlayerScore(c,player,1);
                                        playerName = player.username;
                                    }
                                    console.log(player.displayPlayerInformation() + ' Has a score of: ' +  player.score)
                                });                                
                                let returnData = {
                                    id: ai.id,
                                    killedByID: bullet.activator,
                                    killedByScore: scoreCounter,
                                    killedByName: playerName
                                }
                                lobby.connections[0].socket.emit('aiDied', returnData);
                                lobby.connections[0].socket.broadcast.to(lobby.id).emit('aiDied', returnData);
                            } else {
                                console.log('AI with id: ' + ai.id + ' has (' + ai.health + ') health left');
                            }
                        }
                        playerHit = true;
                        lobby.despawnBullet(bullet);
                    }
                });
            }

            if(!playerHit) {
                bullet.isDestroyed = true;
            }
        });        
    }

    increasePlayerScore(c,player,amount){
        let lobby = this;
        let updatedScore = player.score + amount;
        player.score = updatedScore;

        if(updatedScore >= lobby.settings.winningScore){
            console.log('Winner:' + player.username + ' With ID:' + player.id)
            lobby.lobbyState.currentState = lobby.lobbyState.ENDGAME;
            let returnData = {
                state: lobby.lobbyState.currentState                
            }

            c.server.database.UpdateHighScores(player.username,updatedScore)

            lobby.connections[0].socket.emit('gameWon', returnData);
            lobby.connections[0].socket.broadcast.to(lobby.id).emit('gameWon', returnData);
        }

        return updatedScore;
    }

    despawnBullet(bullet = Bullet) {
        let lobby = this;
        let bullets = lobby.bullets;
        let connections = lobby.connections;

        console.log('Destroying bullet (' + bullet.id + ')');
        var index = bullets.indexOf(bullet);
        if(index > -1) {
            bullets.splice(index, 1);

            var returnData = {
                id: bullet.id,
                name: "Bullet",
                position: {
                    x: bullet.position.x,
                    y: bullet.position.y
                }
            }

            //Send remove bullet command to players
            connections.forEach(connection => {
                connection.socket.emit('serverUnspawn', returnData);
            });
        }
    }

    addPlayer(connection = Connection) {
        let lobby = this;
        let connections = lobby.connections;
        let socket = connection.socket;

        let randomPosition = lobby.getRandomSpawn();
        connection.player.position = new Vector2(randomPosition.x,randomPosition.y);
        connection.player.score = 0; //reset score to 0

        var returnData = {
            id: connection.player.id,
            username: connection.player.username,
            position: connection.player.position
        }

        socket.emit('spawn', returnData); //tell myself I have spawned
        socket.broadcast.to(lobby.id).emit('spawn', returnData); // Tell others

        //Tell myself about everyone else already in the lobby
        connections.forEach(c => {
            if(c.player.id != connection.player.id) {
                socket.emit('spawn', {
                    id: c.player.id,
                    username: c.player.username,
                    position: c.player.position
                });
            }
        });
    }

    removePlayer(connection = Connection) {
        let lobby = this;

        connection.socket.broadcast.to(lobby.id).emit('disconnected', {
            id: connection.player.id
        });
    }

    getRandomSpawn(){
        let lobby = this;
        let index = lobby.getRandomInteger(0,lobby.settings.levelData.freeForAllSpawn.length);

        return{
            x: lobby.settings.levelData.freeForAllSpawn[index].position.x,
            y: lobby.settings.levelData.freeForAllSpawn[index].position.y
        }
    }
    
    getRandomSpawnForAI(){
        let lobby = this;
        let index = lobby.getRandomInteger(0,lobby.settings.levelData.free_For_All_AI_Spawn.length);

        return new Vector2(
            lobby.settings.levelData.free_For_All_AI_Spawn[index].position.x,
            lobby.settings.levelData.free_For_All_AI_Spawn[index].position.y
        )
    }
    //includes min but excludes max
    getRandomInteger(min, max){
        return Math.floor(Math.random() * (max - min)) + min
    }
}