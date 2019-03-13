require('babel-register');
require('babel-polyfill');

const HDWallet = require('truffle-hdwallet-provider');
const infuraKey = "fj4jllsdfsdfsdfs";
//
// const fs = require('fs');
const mnemonic = "marriage river salon about siren acquire vague amateur guard board armed food";

module.exports = {
    networks: {
        development: {
            host: "127.0.0.1",
            port: 7545,
            network_id: "*",
            gas: 8000000
        },
        ropsten: {
            provider: () => new HDWallet(mnemonic, `https://ropsten.infura.io/${infuraKey}`),
            network_id: 3,       // Ropsten's id
            gas: 5500000,        // Ropsten has a lower block limit than mainnet
            confirmations: 2,    // # of confs to wait between deployments. (default: 0)
            timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
            skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
        }
    }
};
