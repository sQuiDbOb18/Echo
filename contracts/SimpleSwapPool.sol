// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleSwapPool is Ownable {
  using SafeERC20 for IERC20;

  address public immutable baseToken;
  mapping(address => uint256) public baseReserves;
  mapping(address => uint256) public stockReserves;

  event LiquidityAdded(address indexed stockToken, uint256 baseAmount, uint256 stockAmount);
  event Swapped(address indexed sender, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

  constructor(address baseToken_, address initialOwner) Ownable(initialOwner) {
    require(baseToken_ != address(0), "pool: zero base token");
    baseToken = baseToken_;
  }

  function addLiquidity(address stockToken, uint256 baseAmount, uint256 stockAmount) external onlyOwner {
    require(stockToken != address(0) && stockToken != baseToken, "pool: invalid stock");
    require(baseAmount > 0 && stockAmount > 0, "pool: zero liquidity");
    IERC20(baseToken).safeTransferFrom(msg.sender, address(this), baseAmount);
    IERC20(stockToken).safeTransferFrom(msg.sender, address(this), stockAmount);
    baseReserves[stockToken] += baseAmount;
    stockReserves[stockToken] += stockAmount;
    emit LiquidityAdded(stockToken, baseAmount, stockAmount);
  }

  function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn) public view returns (uint256) {
    require(amountIn > 0, "pool: zero input");
    (uint256 reserveIn, uint256 reserveOut) = _reserves(tokenIn, tokenOut);
    require(reserveIn > 0 && reserveOut > 0, "pool: no liquidity");
    return (amountIn * reserveOut) / (reserveIn + amountIn);
  }

  function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient)
    external
    returns (uint256 amountOut)
  {
    amountOut = getAmountOut(tokenIn, tokenOut, amountIn);
    require(amountOut >= minAmountOut, "pool: slippage");
    address stockToken = tokenIn == baseToken ? tokenOut : tokenIn;
    IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
    IERC20(tokenOut).safeTransfer(recipient, amountOut);
    if (tokenIn == baseToken) {
      baseReserves[stockToken] += amountIn;
      stockReserves[stockToken] -= amountOut;
    } else {
      stockReserves[stockToken] += amountIn;
      baseReserves[stockToken] -= amountOut;
    }
    emit Swapped(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
  }

  function getReserves(address stockToken) external view returns (uint256 baseReserve, uint256 stockReserve) {
    return (baseReserves[stockToken], stockReserves[stockToken]);
  }

  function getPrice(address stockToken) external view returns (uint256 basePerStock) {
    require(baseReserves[stockToken] > 0 && stockReserves[stockToken] > 0, "pool: no liquidity");
    return (baseReserves[stockToken] * 1e18) / stockReserves[stockToken];
  }

  function _reserves(address tokenIn, address tokenOut) internal view returns (uint256, uint256) {
    require(tokenIn == baseToken || tokenOut == baseToken, "pool: pair unsupported");
    address stockToken = tokenIn == baseToken ? tokenOut : tokenIn;
    require(stockToken != address(0), "pool: invalid token");
    if (tokenIn == baseToken) return (baseReserves[stockToken], stockReserves[stockToken]);
    return (stockReserves[stockToken], baseReserves[stockToken]);
  }
}