/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *  
 */

const CryptoJS = require('crypto-js');
const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

const ALLOWED_TIME_TO_SIGN_SECONDS = 300; // 5 minutes

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if (this._isGenesis(this.height)) {
            let block = new BlockClass.Block({ data: 'Genesis Block' });
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return the height of the chain
     */
    async getChainHeight() {
        return this.height;
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't forget 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    async _addBlock(block) {
        if (!this._isGenesis(this.height)) {
            block.previousBlockHash = this.chain[this.height].hash;
        }
        block.height = ++this.height;
        block.time = this._currentTimestamp();
        const hash = this._generateHash(block);
        block.hash = hash;
        this.chain[this.height] = block;
        return block;
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    async requestMessageOwnershipVerification(address) {
        return [address, this._currentTimestamp(), 'startRegistry'].join(':');
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    async submitStar(address, message, signature, star) {

        const timestamp = parseInt(message.split(':')[1]);

        if (!this._isValidTime(timestamp)) {
            return this._errorMessage('Time has expired!');
        } else if (!this._isValidSignature(message, address, signature)) {
            return this._errorMessage('Invalid signature!');
        }
        let newBlock = new BlockClass.Block({
            owner: address,
            star
        });
        return this._validBlock(await this._addBlock(newBlock));
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        let block = this.chain.filter(block => block.hash === hash);
        return block.length > 0 ? block[0] : null;
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.filter(p => p.height === height)[0];
            if (block) {
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress(address) {
        let stars = [];
        this.chain.forEach(block => {
            const body = block.getBData();
            if (body != null && body.owner === address) {
                stars.push(body.star);
            }
        });
        return stars;

    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    async validateChain() {
        let errorLog = [];
        for (let i = 0; i < this.chain.length; i++) {
            const block = this.chain[i];
            const previousBlock = i === 0 ? null : this.chain[i - 1];
            const isValid = await block.validate();
            if (i > 0 && (!isValid || !(block.previousBlockHash = previousBlock.hash))) {
                errorLog.push(block);
            }
        }
        return errorLog;
    }

    _currentTimestamp() {
        return new Date().getTime().toString().slice(0, -3);
    }

    _isValidTime(timestamp) {
        return (this._currentTimestamp() - timestamp) <= ALLOWED_TIME_TO_SIGN_SECONDS;
    }

    _isValidSignature(message, address, signature) {
        return bitcoinMessage.verify(message, address, signature);
    }

    _isGenesis(height) {
        return height === -1;
    }

    _generateHash(block) {
        return SHA256(JSON.stringify(block)).toString(CryptoJS.enc.Hex);
    }

    _errorMessage(message) {
        return {
            isValid: false,
            error: message
        };
    }

    _validBlock(block) {
        return {
            isValid: true,
            block: block
        }
    }

}

module.exports.Blockchain = Blockchain;   