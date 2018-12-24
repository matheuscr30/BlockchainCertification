const {advanceBlock} = require('./helpers/advanceToBlock');
const {increaseTime, increaseTimeTo, duration} = require('./helpers/increaseTime');
const {latestTime} = require('./helpers/latestTime');
const {EVMRevert} = require('./helpers/EVMRevert');
const {sign} = require('./helpers/signMessage');

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
        buyerWhitelisted,
        anotherBuyerWhitelisted,
        buyerNotWhitelisted,
        anotherBuyerNotWhiteListed
    ]) {

    const PRICE = 10;
    const BONUS = 50;
    const DURATION = 600000;

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

        let hash, obj;

        hash = web3.utils.soliditySha3(this.tokenSale.address, buyerWhitelisted);
        obj = await sign(owner, hash);
        this.buyerWhitelistedSig = obj.sig;

        await this.tokenSale.validWhitelistSignedMessage( this.buyerWhitelistedSig, {
            from: buyerWhitelisted
        })

        hash = web3.utils.soliditySha3(this.tokenSale.address, anotherBuyerWhitelisted);
        obj = await sign(owner, hash);
        this.anotherBuyerWhitelistedSig = obj.sig;
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

    it('should validate a valid whitelist note', async function () {
        let hash = web3.utils.soliditySha3(this.tokenSale.address, buyerNotWhitelisted);
        let {r, s, v, sig} = await sign(owner, hash);

        await this.tokenSale.validWhitelistSignedMessage(sig, {
            from: buyerNotWhitelisted
        }).should.be.fulfilled;

        let res = await this.tokenSale.isWhitelisted.call(buyerNotWhitelisted);
        res.should.be.equal(true);
    });

    it('should not validate a whitelist note already validated', async function () {
        await this.tokenSale.validWhitelistSignedMessage(this.buyerWhitelistedSig, {
            from: buyerWhitelisted
        }).should.be.rejectedWith(EVMRevert);
    });

    it('should not validate a invalid whitelist note', async function () {
        await this.tokenSale.validWhitelistSignedMessage(this.buyerWhitelistedSig, {
            from: anotherBuyerNotWhiteListed
        }).should.be.rejectedWith(EVMRevert);

        let res = await this.tokenSale.isWhitelisted.call(anotherBuyerNotWhiteListed);
        res.should.be.equal(false);
    });

    it('should sell tokens to a buyer with a valid whitelist note', async function () {
        let weiAmount = 500;
        let expectedBalance = weiAmount / PRICE;

        await this.tokenSale.buyTokensWithSignature(this.anotherBuyerWhitelistedSig, {
            from: anotherBuyerWhitelisted,
            value: weiAmount
        }).should.be.fulfilled;

        let balance = await this.tokenSale.balances(anotherBuyerWhitelisted)
        balance.should.eq.BN(expectedBalance)
    });

    it('should not sell tokens to a buyer with a whitelist note of other person', async function () {
        let weiAmount = 500;

        await this.tokenSale.buyTokensWithSignature(this.buyerWhitelistedSig, {
            from: anotherBuyerWhitelisted,
            value: weiAmount
        }).should.be.rejectedWith(EVMRevert);
    });

    it('should not sell tokens to a buyer without a valid whitelist note', async function () {
        let hash = web3.utils.soliditySha3('invalid', buyerNotWhitelisted);
        let obj = await sign(owner, hash);
        let weiAmount = 500;

        await this.tokenSale.buyTokensWithSignature(obj.sig, {
            from: buyerNotWhitelisted,
            value: weiAmount
        }).should.be.rejectedWith(EVMRevert);
    });

    it('should sell tokens to a buyer using fallback if the whitelist note was provided manually', async function () {
        let weiAmount = 500;
        let expectedBalance = weiAmount / PRICE;

        await this.tokenSale.sendTransaction({
            from: buyerWhitelisted,
            value: weiAmount
        }).should.be.fulfilled;

        let balance = await this.tokenSale.balances(buyerWhitelisted)
        balance.should.eq.BN(expectedBalance)
    });

    it('should not sell tokens to a buyer using fallback when the whitelist note was not provided', async function () {
        let weiAmount = 500;

        await this.tokenSale.sendTransaction({
            from: anotherBuyerWhitelisted,
            value: weiAmount
        }).should.be.rejectedWith(EVMRevert);

        let balance = await this.tokenSale.balances(anotherBuyerWhitelisted)
        balance.should.eq.BN(0)
    })

    it('should sell tokens to a buyer with a valid bonus note', async function () {
        let bonusAmount = 500;
        let hash = web3.utils.soliditySha3(buyerNotWhitelisted, bonusAmount);
        let obj = await sign(owner, hash);

        let weiAmount = 200;
        let expectedBalance = weiAmount * (BONUS+100) / 100 / PRICE;

        await this.tokenSale.buyTokensWithBonus(obj.sig, bonusAmount, {
            from: buyerNotWhitelisted,
            value: weiAmount
        }).should.be.fulfilled;

        let balance = await this.tokenSale.balances(buyerNotWhitelisted)
        balance.should.eq.BN(expectedBalance)
    });

    it('should let the buyer use a valid bonus note multiple times respecting the maximal amount', async function () {
        let bonusAmount = 500;
        let hash = web3.utils.soliditySha3(buyerNotWhitelisted, bonusAmount);
        let obj = await sign(owner, hash);

        let weiAmount = 200;
        let expectedBalance = weiAmount * (BONUS+100) / 100 / PRICE;

        await this.tokenSale.buyTokensWithBonus(obj.sig, bonusAmount, {
            from: buyerNotWhitelisted,
            value: weiAmount
        }).should.be.fulfilled;

        let balance = await this.tokenSale.balances(buyerNotWhitelisted)
        balance.should.eq.BN(expectedBalance)

        weiAmount = 300;
        expectedBalance += weiAmount * (BONUS+100) / 100 / PRICE;

        await this.tokenSale.buyTokensWithBonus(obj.sig, bonusAmount, {
            from: buyerNotWhitelisted,
            value: weiAmount
        }).should.be.fulfilled;

        balance = await this.tokenSale.balances(buyerNotWhitelisted)
        balance.should.eq.BN(expectedBalance)

        weiAmount = 1

        await this.tokenSale.buyTokensWithBonus(obj.sig, bonusAmount, {
            from: buyerNotWhitelisted,
            value: weiAmount
        }).should.be.rejectedWith(EVMRevert);
    });

    it('should not let the buyer use the bonus note for more than the maximal amount of wei', async function () {
        let bonusAmount = 500;
        let hash = web3.utils.soliditySha3(buyerNotWhitelisted, bonusAmount);
        let obj = await sign(owner, hash);

        let weiAmount = 600;

        await this.tokenSale.buyTokensWithBonus(obj.sig, bonusAmount, {
            from: buyerNotWhitelisted,
            value: weiAmount
        }).should.be.rejectedWith(EVMRevert);

        let balance = await this.tokenSale.balances(buyerNotWhitelisted)
        balance.should.eq.BN(0)
    });

    it('should sell tokens to a buyer with multiple valid bonus notes', async function () {
        let firstBonusAmount = 500;
        let firstHash = web3.utils.soliditySha3(buyerNotWhitelisted, firstBonusAmount);
        let firstBonus = await sign(owner, firstHash);

        let secondBonusAmount = 300;
        let secondHash = web3.utils.soliditySha3(buyerNotWhitelisted, secondBonusAmount);
        let secondBonus = await sign(owner, secondHash);

        let weiAmount = 200;
        let expectedBalance = weiAmount * (BONUS+100) / 100 / PRICE;

        await this.tokenSale.buyTokensWithBonus(firstBonus.sig, firstBonusAmount, {
            from: buyerNotWhitelisted,
            value: weiAmount
        }).should.be.fulfilled;

        let balance = await this.tokenSale.balances(buyerNotWhitelisted)
        balance.should.eq.BN(expectedBalance)

        weiAmount = 300;
        expectedBalance += (weiAmount * (BONUS+100) / 100 / PRICE);

        await this.tokenSale.buyTokensWithBonus(secondBonus.sig, secondBonusAmount, {
            from: buyerNotWhitelisted,
            value: weiAmount
        }).should.be.fulfilled;

        balance = await this.tokenSale.balances(buyerNotWhitelisted)
        balance.should.eq.BN(expectedBalance)
    });

    it('should not sell tokens to a buyer with a bonus note of other person', async function () {
        let bonusAmount = 500;
        let hash = web3.utils.soliditySha3(buyerNotWhitelisted, bonusAmount);
        let obj = await sign(owner, hash);

        let weiAmount = 200;

        await this.tokenSale.buyTokensWithBonus(obj.sig, bonusAmount, {
            from: anotherBuyerNotWhiteListed,
            value: weiAmount
        }).should.be.rejectedWith(EVMRevert);

        let balance = await this.tokenSale.balances(anotherBuyerNotWhiteListed)
        balance.should.eq.BN(0)
    });

    it('should not sell tokens to a buyer without a valid bonus note', async function () {
        let bonusAmount = 500;
        let hash = web3.utils.soliditySha3('invalid', bonusAmount);
        let obj = await sign(owner, hash);

        let weiAmount = 300;

        await this.tokenSale.buyTokensWithBonus(obj.sig, bonusAmount, {
            from: anotherBuyerNotWhiteListed,
            value: weiAmount
        }).should.be.rejectedWith(EVMRevert);

        let balance = await this.tokenSale.balances(anotherBuyerNotWhiteListed)
        balance.should.eq.BN(0)
    });

    it('should allow owner/seller abort the sale', async function () {
        let weiAmount = 200;
        let bonusAmount = 500;
        let hash = web3.utils.soliditySha3(buyerWhitelisted, bonusAmount);
        let obj = await sign(owner, hash);

        await this.tokenSale.abortSale({
            from: owner
        }).should.be.fulfilled;

        let isAborted = await this.tokenSale.isAborted.call();
        isAborted.should.be.equal(true);

        await this.tokenSale.sendTransaction({
            from: buyerWhitelisted,
            value: weiAmount
        }).should.be.rejectedWith(EVMRevert);

        await this.tokenSale.buyTokensWithSignature(this.buyerWhitelistedSig, {
            from: buyerWhitelisted,
            value: weiAmount
        }).should.be.rejectedWith(EVMRevert);

        await this.tokenSale.buyTokensWithBonus(obj.sig, bonusAmount, {
            from: buyerWhitelisted,
            value: weiAmount
        }).should.be.rejectedWith(EVMRevert);

        let balance = await this.tokenSale.balances(buyerWhitelisted)
        balance.should.eq.BN(0)
    });

    it('should not allow buyer abort the sale', async function () {
        await this.tokenSale.abortSale({
            from: anotherBuyerNotWhiteListed
        }).should.be.rejectedWith(EVMRevert);
    });

    it('should not allow abort the sale after it closes', async function () {
        await increaseTime(DURATION+1);

        await this.tokenSale.abortSale({
            from: owner
        }).should.be.rejectedWith(EVMRevert);
    });

    it('should let buyer retrieve his payment after the abort of the sale', async function () {
        let weiAmount = 200;
        let bonusAmount = 500;
        let hash = web3.utils.soliditySha3(buyerWhitelisted, bonusAmount);
        let obj = await sign(owner, hash);

        await this.tokenSale.sendTransaction({
            from: buyerWhitelisted,
            value: weiAmount
        }).should.be.fulfilled;

        let totalInvest = weiAmount;
        weiAmount = 300;

        await this.tokenSale.buyTokensWithBonus(obj.sig, bonusAmount, {
            from: buyerWhitelisted,
            value: weiAmount
        }).should.be.fulfilled;

        totalInvest += weiAmount;

        await this.tokenSale.abortSale({
            from: owner
        }).should.be.fulfilled;

        let isAborted = await this.tokenSale.isAborted.call();
        isAborted.should.be.equal(true);

        let oldBalanceBuyer = new web3.utils.BN(await web3.eth.getBalance(buyerWhitelisted));
        let gasPrice = new web3.utils.BN(await web3.eth.getGasPrice());
        let gasUsed = 0;

        let trc = await this.tokenSale.withdrawEther({
            from: buyerWhitelisted
        }).should.be.fulfilled;
        gasUsed += trc.receipt.gasUsed;

        let gasEther = gasPrice.mul(new web3.utils.BN(gasUsed));
        let expectedBalanceBuyer = (oldBalanceBuyer.sub(gasEther)).add(new web3.utils.BN(totalInvest));
        let newBalanceBuyer = new web3.utils.BN(await web3.eth.getBalance(buyerWhitelisted));

        expectedBalanceBuyer.should.be.eq.BN(newBalanceBuyer)
    });

    it('should not let buyer retrieve his payment without the sale been aborted', async function () {
        let weiAmount = 200;

        await this.tokenSale.sendTransaction({
            from: buyerWhitelisted,
            value: weiAmount
        }).should.be.fulfilled;

        await this.tokenSale.withdrawEther({
            from: buyerWhitelisted
        }).should.be.rejectedWith(EVMRevert);
    });

    it('should let buyer generate his tokens after the sale closes', async function () {
        let weiAmount = 200;

        await this.tokenSale.sendTransaction({
            from: buyerWhitelisted,
            value: weiAmount
        }).should.be.fulfilled;

        let oldTokenSaleBalance = new web3.utils.BN(await this.tokenSale.balances(buyerWhitelisted));

        await increaseTime(DURATION+1);

        await this.tokenSale.generateTokens({
            from: buyerWhitelisted
        }).should.be.fulfilled;

        let newTokenSaleBalance = new web3.utils.BN(await this.tokenSale.balances(buyerWhitelisted));
        let newTokenBalance = new web3.utils.BN(await this.token.balanceOf(buyerWhitelisted));

        newTokenSaleBalance.should.be.eq.BN(0);
        newTokenBalance.should.be.eq.BN(oldTokenSaleBalance);
    });

    it('should not let buyer generate his tokens until the sale is closed', async function () {
        let weiAmount = 200;

        await this.tokenSale.sendTransaction({
            from: buyerWhitelisted,
            value: weiAmount
        }).should.be.fulfilled;

        let oldTokenSaleBalance = new web3.utils.BN(await this.tokenSale.balances(buyerWhitelisted));
        let oldTokenBalance = new web3.utils.BN(await this.token.balanceOf(buyerWhitelisted));

        await increaseTime(DURATION-1);

        await this.tokenSale.generateTokens({
            from: buyerWhitelisted
        }).should.be.rejectedWith(EVMRevert);

        let newTokenSaleBalance = new web3.utils.BN(await this.tokenSale.balances(buyerWhitelisted));
        let newTokenBalance = new web3.utils.BN(await this.token.balanceOf(buyerWhitelisted));

        newTokenSaleBalance.should.be.eq.BN(oldTokenSaleBalance);
        newTokenBalance.should.be.eq.BN(oldTokenBalance);
    });

    it('should not let buyer generate his tokens more than once after the sale closes', async function () {
        let weiAmount = 200;

        await this.tokenSale.sendTransaction({
            from: buyerWhitelisted,
            value: weiAmount
        }).should.be.fulfilled;

        let oldTokenSaleBalance = new web3.utils.BN(await this.tokenSale.balances(buyerWhitelisted));

        await increaseTime(DURATION+1);

        await this.tokenSale.generateTokens({
            from: buyerWhitelisted
        }).should.be.fulfilled;

        let newTokenSaleBalance = new web3.utils.BN(await this.tokenSale.balances(buyerWhitelisted));
        let newTokenBalance = new web3.utils.BN(await this.token.balanceOf(buyerWhitelisted));

        newTokenSaleBalance.should.be.eq.BN(0);
        newTokenBalance.should.be.eq.BN(oldTokenSaleBalance);

        await this.tokenSale.generateTokens({
            from: buyerWhitelisted
        }).should.be.rejectedWith(EVMRevert);
    });

    it('should not let buyer generate his tokens if sale is aborted', async function () {
        let weiAmount = 200;

        await this.tokenSale.sendTransaction({
            from: buyerWhitelisted,
            value: weiAmount
        }).should.be.fulfilled;

        await this.tokenSale.abortSale({
            from: owner
        }).should.be.fulfilled;

        await increaseTime(DURATION+1);

        await this.tokenSale.generateTokens({
            from: buyerWhitelisted
        }).should.be.rejectedWith(EVMRevert);
    });

    it('should let the seller retrieve up to 90% of the ether after the sale closes', async function () {
        let weiAmount = 500;
        let retrieveWeiAmount = weiAmount*90/100;

        await this.tokenSale.sendTransaction({
            from: buyerWhitelisted,
            value: weiAmount
        }).should.be.fulfilled;

        await increaseTime(DURATION+1);

        let oldBalanceOwner = new web3.utils.BN(await web3.eth.getBalance(owner));
        let gasPrice = new web3.utils.BN(await web3.eth.getGasPrice());
        let gasUsed = 0;

        let trc = await this.tokenSale.retrieveEther(retrieveWeiAmount, {
            from: owner
        }).should.be.fulfilled;
        gasUsed += trc.receipt.gasUsed;

        let gasEther = gasPrice.mul(new web3.utils.BN(gasUsed));
        let expectedBalanceOwner = (oldBalanceOwner.sub(gasEther)).add(new web3.utils.BN(retrieveWeiAmount));
        let newBalanceOwner = new web3.utils.BN(await web3.eth.getBalance(owner));

        newBalanceOwner.should.be.eq.BN(expectedBalanceOwner);
    });

    it('should let the seller retrieve multiple times respecting the 90% of the ether after the sale closes', async function () {
        let weiAmount = 500;
        let retrieveWeiAmount = weiAmount*40/100;

        await this.tokenSale.sendTransaction({
            from: buyerWhitelisted,
            value: weiAmount
        }).should.be.fulfilled;

        await increaseTime(DURATION+1);

        let oldBalanceOwner = new web3.utils.BN(await web3.eth.getBalance(owner));
        let gasPrice = new web3.utils.BN(await web3.eth.getGasPrice());
        let gasUsed = 0;

        let trc = await this.tokenSale.retrieveEther(retrieveWeiAmount, {
            from: owner
        }).should.be.fulfilled;
        gasUsed += trc.receipt.gasUsed;

        retrieveWeiAmount = weiAmount*50/100;

        trc = await this.tokenSale.retrieveEther(retrieveWeiAmount, {
            from: owner
        }).should.be.fulfilled;
        gasUsed += trc.receipt.gasUsed;

        retrieveWeiAmount = weiAmount*90/100;

        let gasEther = gasPrice.mul(new web3.utils.BN(gasUsed));
        let expectedBalanceOwner = (oldBalanceOwner.sub(gasEther)).add(new web3.utils.BN(retrieveWeiAmount));
        let newBalanceOwner = new web3.utils.BN(await web3.eth.getBalance(owner));

        newBalanceOwner.should.be.eq.BN(expectedBalanceOwner);
    });

    it('should not let the seller retrieve multiples exceding the 90% of the ether after the sale closes', async function () {
        let weiAmount = 500;
        let retrieveWeiAmount = weiAmount*40/100;

        await this.tokenSale.sendTransaction({
            from: buyerWhitelisted,
            value: weiAmount
        }).should.be.fulfilled;

        await increaseTime(DURATION+1);

        await this.tokenSale.retrieveEther(retrieveWeiAmount, {
            from: owner
        }).should.be.fulfilled;

        retrieveWeiAmount = weiAmount*55/100;

        await this.tokenSale.retrieveEther(retrieveWeiAmount, {
            from: owner
        }).should.be.rejectedWith(EVMRevert);
    });

    it('should not let the seller retrieve more than 90% of the ether after the sale closes', async function () {
        let weiAmount = 500;
        let excessWeiAmount = weiAmount*95/100;

        await this.tokenSale.sendTransaction({
            from: buyerWhitelisted,
            value: weiAmount
        }).should.be.fulfilled;

        await increaseTime(DURATION+1);

        await this.tokenSale.retrieveEther(excessWeiAmount, {
            from: owner
        }).should.be.rejectedWith(EVMRevert);
    });

    it('should not let the seller retrieve ether until the sale is closed', async function () {
        let weiAmount = 500;
        let excessWeiAmount = weiAmount*95/100;

        await this.tokenSale.sendTransaction({
            from: buyerWhitelisted,
            value: weiAmount
        }).should.be.fulfilled;

        await this.tokenSale.retrieveEther(excessWeiAmount, {
            from: owner
        }).should.be.rejectedWith(EVMRevert);
    });
})
