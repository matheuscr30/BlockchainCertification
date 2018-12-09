const {advanceBlock} = require('./helpers/advanceToBlock');
const {increaseTime, increaseTimeTo, duration} = require('./helpers/increaseTime');
const {latestTime} = require('./helpers/latestTime');
const {EVMRevert} = require('./helpers/EVMRevert');

require('chai')
    .use(require('chai-as-promised'))
    .use(require('bn-chai')(web3.utils.BN))
    .should();

const MatToken = artifacts.require("MatToken");
const TokenSale = artifacts.require("TokenSale");

contract('TokenSale', function (
    [
        owner,
        wallet,
        investorWhitelisted,
        anotherInvestorWhitelisted,
        investorNotWhitelisted,
        anotherInvestorNotWhiteListed
    ]) {

    const PRICE = 1000;
    const BONUS = 30;
    const DURATION = 600000;

    before(async function () {
        await advanceBlock();
    });

    beforeEach(async function () {
        this.token = await MatToken.new({from: owner});
        this.tokenSale = await TokenSale.new(
            PRICE,
            BONUS,
            DURATION,
            wallet,
            this.token.address
        );

        await this.token.transferOwnership(this.tokenSale.address);

        /*var events = this.crowdsale.allEvents();
        // watch for changes
        events.watch(function (error, event) {
            if (!error)
                console.log(event.args);
        });*/
    });

    it('should create TokenSale with correct parameters', async function () {
        this.tokenSale.should.exist;
        this.token.should.exist;

        let price = await this.tokenSale.price();
        let bonus = await this.tokenSale.bonus();
        let duration = await this.tokenSale.duration();
        let walletAddress = await this.tokenSale.wallet();

        PRICE.should.eq.BN(price);
        bonus.should.eq.BN(BONUS);
        duration.should.eq.BN(DURATION);
        walletAddress.should.be.equal(wallet);
    });
})
