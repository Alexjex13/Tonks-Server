module.exports = class GameLobbySetting{
    constructor(gameMode,MaxPlayers,minPlayers,LevelData,WinningScore){
        this.gameMode = 'No gameMode Defined';
        this.maxPlayers = MaxPlayers;
        this.minPlayers = minPlayers;
        this.levelData = LevelData;
        this.winningScore = WinningScore
    }
}