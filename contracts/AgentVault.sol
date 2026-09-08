// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SimpleSwapPool} from "./SimpleSwapPool.sol";

contract AgentVault is Ownable {
  using SafeERC20 for IERC20;

  IERC20 public immutable baseToken;
  SimpleSwapPool public immutable pool;
  address public agentExecutor;
  uint256 public totalShares;
  mapping(address => uint256) public shares;
  address[] public poolStockTokens;

  event Deposit(address indexed user, uint256 assets, uint256 sharesMinted);
  event Withdraw(address indexed user, uint256 sharesBurned, uint256 baseAmount, uint256[] stockAmounts);
  event TradeExecuted(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, string reasoning, uint256 timestamp);

  constructor(address baseToken_, address pool_, address executor_, address initialOwner) Ownable(initialOwner) {
    baseToken = IERC20(baseToken_);
    pool = SimpleSwapPool(pool_);
    agentExecutor = executor_;
  }

  modifier onlyExecutor() {
    require(msg.sender == agentExecutor, "vault: only executor");
    _;
  }

  function setAgentExecutor(address executor) external onlyOwner {
    require(executor != address(0), "vault: zero executor");
    agentExecutor = executor;
  }

  function addStockToken(address stockToken) external onlyOwner {
    poolStockTokens.push(stockToken);
  }

  function deposit(uint256 amount) external returns (uint256 mintedShares) {
    require(amount > 0, "vault: zero deposit");
    uint256 navBefore = getNAV();
    mintedShares = totalShares == 0 ? amount : (amount * totalShares) / navBefore;
    require(mintedShares > 0, "vault: deposit too small");
    baseToken.safeTransferFrom(msg.sender, address(this), amount);
    shares[msg.sender] += mintedShares;
    totalShares += mintedShares;
    emit Deposit(msg.sender, amount, mintedShares);
  }

  function withdraw(uint256 sharesToBurn) external returns (uint256 baseAmount, uint256[] memory stockAmounts) {
    require(sharesToBurn > 0 && shares[msg.sender] >= sharesToBurn, "vault: insufficient shares");
    uint256 shareSupply = totalShares;
    baseAmount = (baseToken.balanceOf(address(this)) * sharesToBurn) / shareSupply;
    stockAmounts = new uint256[](poolStockTokens.length);
    for (uint256 i = 0; i < poolStockTokens.length; i++) {
      stockAmounts[i] = (IERC20(poolStockTokens[i]).balanceOf(address(this)) * sharesToBurn) / shareSupply;
      IERC20(poolStockTokens[i]).safeTransfer(msg.sender, stockAmounts[i]);
    }
    shares[msg.sender] -= sharesToBurn;
    totalShares -= sharesToBurn;
    baseToken.safeTransfer(msg.sender, baseAmount);
    emit Withdraw(msg.sender, sharesToBurn, baseAmount, stockAmounts);
  }

  function executeTrade(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, string calldata reasoning)
    external
    onlyExecutor
    returns (uint256 amountOut)
  {
    IERC20(tokenIn).forceApprove(address(pool), amountIn);
    amountOut = pool.swap(tokenIn, tokenOut, amountIn, minAmountOut, address(this));
    emit TradeExecuted(tokenIn, tokenOut, amountIn, amountOut, reasoning, block.timestamp);
  }

  function getNAV() public view returns (uint256 nav) {
    nav = baseToken.balanceOf(address(this));
    for (uint256 i = 0; i < poolStockTokens.length; i++) {
      uint256 balance = IERC20(poolStockTokens[i]).balanceOf(address(this));
      if (balance > 0) nav += pool.getAmountOut(poolStockTokens[i], address(baseToken), balance);
    }
  }
}