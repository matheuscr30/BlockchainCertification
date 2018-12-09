const TokenSale = artifacts.require('./TokenSale.sol');
const MatToken = artifacts.require('./MatToken.sol');

module.exports = async function(deployer, network, accounts) {
    const price = web3.utils.toBN(1000);
    const bonus = 30;
    const duration = 600000;
    const wallet = accounts[0];

    await deployer.deploy(MatToken);
    const deployedMatToken = await MatToken.deployed();

    await deployer.deploy(
        TokenSale,
        price,
        bonus,
        duration,
        wallet,
        MatToken.address
    )
    const deployedTokenSale = await TokenSale.deployed();

    //console.log("Deployed MatToken: ", deployedMatToken);
    //console.log("Deployed TokenSale: ", deployedTokenSale);
}
