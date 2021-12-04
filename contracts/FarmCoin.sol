// SPDX-License-Identifier: MIT
pragma solidity >=0.8.5 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @dev A Typical ERC20 Token
 */
contract FarmCoin is ERC20 {
  constructor() ERC20("FarmCoin", "FARM") {
    _mint(msg.sender, 10_000_000_000e18);
  }
}
