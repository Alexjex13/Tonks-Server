let MySql = require('mysql')
let DatabaseSettings = require('../Files/DatabaseSettings.json')
let DatabaseSettingsLocal = require('../Files/DatabaseSettingsLocal.json');
let PasswordHash = require('password-hash')

module.exports = class Database{
    constructor(isLocal = false){
        this.currentSettings = (isLocal) ? DatabaseSettingsLocal : DatabaseSettings;
        this.pool = MySql.createPool({
            host: this.currentSettings.Host,
            user:this.currentSettings.User,
            password: this.currentSettings.Password,
            database: this.currentSettings.Database
        });
    }

    Connect(callback){
        let pool = this.pool;
        pool.getConnection((error,connection) =>{
            if(error) throw error;
            callback(connection);
        })
    }

    GetSampleData(callback){
       this.Connect(connection =>{
           let query = 'SELECT * FROM users'

           connection.query(query, (error,results) =>{
               connection.release();
               if(error) throw error;
               callback(results);
           })
       }) 
    }

    GetSampleDataUser(username,callback){
        this.Connect(connection =>{
            let query = 'SELECT * FROM users WHERE username = ?'
 
            connection.query(query,[username], (error,results) =>{
                connection.release();
                if(error) throw error;
                callback(results);
            })
        }) 
    }

    //Account Queries    
    CreateAccount(username,password,callback){
        //you may want to check length and perform regex        
        let hashedPassword = PasswordHash.generate(password);
        //Attempt to see if this account exists
        this.Connect(connection =>{
            let query = 'SELECT * FROM users WHERE username = ?'
 
            connection.query(query,[username], (error,results) =>{
                if(error){
                    connection.release();
                    throw error;
                }

                if(results[0] != undefined){
                    callback({
                        valid: false,
                        reason: "user already exists."
                    });
                    connection.release();
                    return;
                }
                
                //if not insert user
                let query = 'INSERT INTO users (username,password) VALUES(?,?) '        
                connection.query(query,[username,hashedPassword], (error,results) =>{
                    connection.release();
                    if(error) {
                        throw error;
                    }
                    callback({
                        valid: true,
                        reason: "Success"
                    });
                })
            });
        }) 
    }

    SignIn(username,password,callback){
        this.Connect(connection =>{
            let query = "SELECT password FROM users WHERE username = ?";
            connection.query(query,[username], (error,results) =>{
                connection.release();
                if(error) {
                    throw error;
                }
                if(results[0] != undefined){
                    if(PasswordHash.verify(password,results[0].password)){
                        callback({
                            valid: true,
                            reason: "Success"
                        });
                    }else{
                        //dont return this for safety
                        callback({
                            valid: false,
                            reason: "Password Does Not Match"
                        });
                    }
                }
                else{
                    callback({
                        valid: false,
                        reason: "User Does Not Exist"
                    });
                }
            });
        });
    }

    GetTop5HighScores(callback){
        this.Connect(connection =>{
            let query = 'SELECT username,highscore FROM users ORDER BY highscore desc LIMIT 5;'
 
            connection.query(query, (error,results) =>{
                connection.release();
                if(error) throw error;
                callback(results);
            })
        })
    }

    UpdateHighScores(username,newScore){
        this.Connect(connection =>{            
            let query = 'SELECT highscore FROM users WHERE username = ?'
            connection.query(query,[username], (error,result) =>{
                if(error){
                    connection.release();
                    throw error;
                }             
                if(result[0].highscore != undefined){
                    if(result[0].highscore < newScore){ //new high score ?
                        let query = 'UPDATE users SET highscore = ? WHERE username = ?'        
                        connection.query(query,[newScore,username], (error,results) =>{
                            connection.release();
                            if(error) {
                                throw error;
                            }
                        });
                    }                    
                };
            })
        }) 
    }
}