pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/crowdsale/distribution/PostDeliveryCrowdsale.sol";
import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/ECRecovery.sol";

contract TokenSale is Ownable, PostDeliveryCrowdsale{
    using SafeMath for uint;
    using ECRecovery for bytes32;

    event WhitelistAdded(address indexed buyer);
    event SaleAborted(uint abortedTime);
    event TokenGeneration(address indexed buyer, uint tokens);
    event Refund(address indexed buyer, uint weiAmount);

    mapping(address => bool) public whitelistedAddresses;
    mapping(bytes32 => uint) public weiPerBonus;
    mapping(address => uint) etherSpentPerAddress;

    bool public isAborted;

    uint public price;
    uint public bonus;
    uint public duration;
    uint etherRetrievedByOwner;

    constructor(
        uint _price,
        uint _bonus,
        uint _duration,
        address _wallet,
        ERC20 _token
    ) public
    Crowdsale(_price, _wallet, _token)
    TimedCrowdsale(now, now + _duration) {
        price = _price;
        closingTime = now + _duration;
        bonus = _bonus;
        duration = _duration;
        isAborted = false;
        etherRetrievedByOwner = 0;
    }

    modifier onlyWhitelisted() {
        require(whitelistedAddresses[msg.sender], "Only Whitelisted People can call this function");
        _;
    }

    modifier onlyWhitelistedSig(bytes _sig) {
        require(isValidSignedMessage(msg.sender, _sig), "Only Whitelisted People can call this function");
        _;
    }

    modifier onlyIfClosed() {
        require(hasClosed(), "Sale is not closed");
        _;
    }

    modifier onlyIfAborted() {
        require(isAborted, "Sale is not aborted");
        _;
    }

    modifier onlyIfNotAborted() {
        require(!isAborted, "Sale was aborted");
        _;
    }

    function isWhitelisted(address _buyer) public view returns (bool) {
        return whitelistedAddresses[_buyer];
    }

    function isValidSignedMessage(address _buyer, bytes _sig) view public returns (bool) {
        bytes32 hash = keccak256(abi.encodePacked(this, _buyer));
        bytes32 hashWithPrefix = hash.toEthSignedMessageHash();

        return owner == hashWithPrefix.recover(_sig);
    }

    function validWhitelistSignedMessage(bytes _sig) public {
        require(!whitelistedAddresses[msg.sender], "Message Already Validated");

        if (isValidSignedMessage(msg.sender, _sig)) {
            whitelistedAddresses[msg.sender] = true;
            emit WhitelistAdded(msg.sender);
        }
        else
            revert("Signed Message not Valid");
    }

    function buyTokensWithBonus(bytes _sig, uint maxAmountWei) onlyIfNotAborted public payable {
        bytes32 hash = keccak256(abi.encodePacked(msg.sender, maxAmountWei));
        bytes32 hashWithPrefix = hash.toEthSignedMessageHash();

        if (owner == hashWithPrefix.recover(_sig)) {
            require(weiPerBonus[hash].add(msg.value) <= maxAmountWei, "Cannot use the bonus");

            weiPerBonus[hash] = weiPerBonus[hash].add(msg.value);
            makePurchase(msg.sender, msg.value, true);
        } else {
            revert("Signed Message not Valid");
        }
    }

    function buyTokensWithSignature(bytes _sig) onlyIfNotAborted onlyWhitelistedSig(_sig) public payable {
        makePurchase(msg.sender, msg.value, false);
    }

    function buyTokens(address _buyer) onlyIfNotAborted onlyWhitelisted public payable {
        makePurchase(_buyer, msg.value, false);
    }

    function _getTokenAmount(uint256 _weiAmount, bool hasBonus) public view returns (uint256) {
        if (hasBonus) {
            return _weiAmount.mul(bonus.add(100)).div(100).div(price);
        } else {
            return _weiAmount.div(price);
        }
    }

    function _forwardFunds() internal {

    }

    function makePurchase(address _buyer, uint256 _weiAmount, bool hasBonus) internal {
        uint256 weiAmount = _weiAmount;
        _preValidatePurchase(_buyer, weiAmount);

        etherSpentPerAddress[_buyer] = etherSpentPerAddress[_buyer].add(weiAmount);

        // calculate token amount to be created
        uint256 tokens = _getTokenAmount(weiAmount, hasBonus);

        // update state
        weiRaised = weiRaised.add(weiAmount);

        _processPurchase(_buyer, tokens);
        emit TokenPurchase(
            msg.sender,
                _buyer,
            weiAmount,
            tokens
        );

        _updatePurchasingState(_buyer, weiAmount);
        _forwardFunds();
        _postValidatePurchase(_buyer, weiAmount);
    }

    function generateTokens() onlyIfNotAborted onlyIfClosed external {
        uint amount = balances[msg.sender];
        require(amount > 0, "No Tokens to Generate");
        balances[msg.sender] = 0;
        MintableToken(token).mint(msg.sender, amount);
        emit TokenGeneration(msg.sender, amount);
    }

    function withdrawEther() onlyIfAborted external {
        uint amount = etherSpentPerAddress[msg.sender];
        require(amount > 0, "No Ether to Refund");
        balances[msg.sender] = 0;
        etherSpentPerAddress[msg.sender] = 0;
        msg.sender.transfer(amount);
        emit Refund(msg.sender, amount);
    }

    function retrieveEther(uint _weiAmount) onlyOwner onlyIfNotAborted onlyIfClosed external {
        uint totalWeiAmount = _weiAmount.add(etherRetrievedByOwner);
        uint percentageWeiAmount = totalWeiAmount.mul(100).div(weiRaised);

        if (percentageWeiAmount <= 90) {
            etherRetrievedByOwner = etherRetrievedByOwner.add(_weiAmount);
            owner.transfer(_weiAmount);
        } else {
            revert("Cannot Retrieve more than 90% of the total balance");
        }
    }

    function sellTokens(uint _tokenAmount) onlyIfNotAborted onlyIfClosed external {

    }

    function abortSale() onlyOwner onlyWhileOpen external {
        isAborted = true;
        emit SaleAborted(now);
    }
}
