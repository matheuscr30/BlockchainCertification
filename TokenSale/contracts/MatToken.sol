pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";

contract MatToken is MintableToken {

    event Burn(address indexed burner, uint value);

    string public name = "MAT Token";
    string public symbol = "MAT";
    uint public decimals = 18;

    function burn(address _who, uint256 _value) public {
        require(_value <= balances[_who]);

        balances[_who] = balances[_who].sub(_value);
        totalSupply_ = totalSupply_.sub(_value);
        emit Burn(_who, _value);
        emit Transfer(_who, address(0), _value);
    }
}
