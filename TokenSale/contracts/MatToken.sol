pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";

contract MatToken is MintableToken {
    string public name = "MAT Token";
    string public symbol = "MAT";
    uint public decimals = 18;
}
