pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/crowdsale/validation/TimedCrowdsale.sol";
import "openzeppelin-solidity/contracts/ECRecovery.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract TokenSale is Ownable, TimedCrowdsale {
    using SafeMath for uint;
    using ECRecovery for bytes32;

    event WhitelistAdded(address _buyer);

    mapping(address => bool) whitelistedAddresses;

    uint public price;
    uint public bonus;
    uint public duration;

    constructor(
        uint _price,
        uint _bonus,
        uint _duration,
        address _wallet,
        ERC20 _token
    ) public
    /*
       number of token units a buyer gets per wei
       address funds are getting forwarded
       address of token being sold/
    */
    Crowdsale(_price, _wallet, _token)
    TimedCrowdsale(block.timestamp, block.timestamp+_duration) {
        price = _price;
        bonus = _bonus;
        duration = _duration;
    }

    modifier onlyWhitelisted() {
        require(whitelistedAddresses[msg.sender], "Only Whitelisted People can call this function");
        _;
    }

    modifier onlyWhitelistedSig(bytes _sig) {
        require(isValidSignedMessage(msg.sender, _sig), "Only Whitelisted People can call this function");
        _;
    }

    function isValidSignedMessage(address _buyer, bytes _sig) view public returns (bool) {
        bytes32 hash = keccak256(abi.encodePacked(this, _buyer));
        bytes32 hashWithPrefix = hash.toEthSignedMessageHash();

        return owner == hashWithPrefix.recover(_sig);
    }

    function validWhitelistSignedMessage(bytes _sig) public {
        require(!whitelistedAddresses[msg.sender], "Message Already Validated");

        if (isValidSignedMessage(msg.sender, _sig))
            whitelistedAddresses[msg.sender] = true;
        else
            revert("Signed Message not Valid");
    }

    function buyTokens(bytes _sig) onlyWhitelistedSig(_sig) public payable {

    }

    function buyTokens() onlyWhitelisted public payable {

    }
}
