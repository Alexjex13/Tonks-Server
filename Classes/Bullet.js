var ServerObjects = require('./ServerObjects.js')
var Vector2 = require('./Vector2.js')

module.exports = class Bullet extends ServerObjects{
    constructor(){
        super();
        this.direction = new Vector2();
        this.speed = 0.5;
        this.isDestroyed = false;
        this.activator = '';
    }


    onUpdate(){var ServerObject = require('./ServerObjects.js')
    var Vector2 = require('./Vector2.js');
    
    module.exports = class Bullet extends ServerObject {
        constructor() {
            super();
            this.direction = new Vector2();
            this.speed = 0.5;
            this.isDestroyed = false;
            this.activator = '';
        }
    
        onUpdate() {     
    
            this.position.x += this.direction.x * this.speed;
            this.position.y += this.direction.y * this.speed;
    
            return this.isDestroyed;
        }
    }

        this.position.x += this.direction.x * this.speed;
        this.position.y += this.direction.y * this.speed;

        return this.isDestroyed;
    }
}