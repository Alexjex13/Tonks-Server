module.exports = class LobbyState{
    constructor(){
        //predefined states
        this.GAME = 'Game';
        this.LOBBY = 'Lobby'
        this.ENDGAME = 'EndGame'

        //current lobby state
        this.currentState = this.LOBBY;
    }
}