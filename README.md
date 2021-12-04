# Solidity coding challenge - A simple staking reward manager

## Description

Create a smart contract which accepts USDC deposits and pays out interest in the form of a new ERC-20 that you create called FarmCoin. The interest rate should be determined by how long a user agrees to lock up their USDC deposit. If the user wishes to unlock their tokens early, they should be able to withdraw them for a 10% fee.

Functionality:
- A contract that accepts USDC deposits and rewards the user with FarmCoins
- If there is no lock up period, the user should earn 10% APY in FarmCoin
- For a six month lock up, the user should earn 20% APY in FarmCoin
- For a 1 year lock up, the user should earn 30% APY in FarmCoin
- For example, if a user deposits 100 USDC with no lockup, their deposit should begin accruing interest immediately, at a rate of 10 FarmCoins per year.
- If the user locks up their USDC for higher returns, they should be able to withdraw them early for a 10% fee on the original USDC deposit.

Your methods should be unit tested to confirm the contract's logic is operating as expected.

## Technical Note

1. Use block.number
  In the beginning, the reward manager contract was designed to calculate the reward amount based on the block number, in order to avoid a potential risk caused by block timestamp.
  But we realized that in the case of using block number, it would very difficult to test rewards for example 1 year, because JSON RPC doesn't have a method to advance multiple blocks.
  So, for now, we decided to use block timestamp to calculate the reward amount, and assume that the contract is vulnerable to the dishonest node attack.
  However, it's enough to show the basic reward manager and its typical logic for a testing purpose.
  
2. APY
  Based on the definition of [Annual percentage yield](https://en.wikipedia.org/wiki/Annual_percentage_yield), given _APY_, _term_ and _principal_, in order to calculate _interest_, we need a complex math equation.
  And it is not possible to extend the equation into multiple integer formulas without a special math library.
  In the current implementation, we don't use any math library to avoid complexity, which means that the reward calculation is not quite correct in terms of math.

## Configuration

### Install Dependencies

```
yarn install
```

## Test💥

### Run Tests

```
yarn test
```

You should see the result like following:

```
  StakingReward
    No lockup at 10% APY rewards
      √ should revert on deposit 0 USDC
      √ should revert on deposit at invalid rate tier
      √ should deposit successfully (130ms)
      √ should revert on withdraw an invalid id
      √ should revert on withdraw an unowned asset (89ms)
      √ should withdraw early
      √ should withdraw after lockup period (50ms)
      √ should revert on withdraw an asset already withdrawn
    6 months lockup at 20% APY rewards
      √ should revert on deposit 0 USDC
      √ should revert on deposit at invalid rate tier
      √ should deposit successfully (80ms)
      √ should revert on withdraw an invalid id
      √ should revert on withdraw an unowned asset (56ms)
      √ should withdraw early (45ms)
      √ should withdraw after lockup period (44ms)
      √ should revert on withdraw an asset already withdrawn
    1 year lockup at 30% APY rewards
      √ should revert on deposit 0 USDC
      √ should revert on deposit at invalid rate tier
      √ should deposit successfully (78ms)
      √ should revert on withdraw an invalid id
      √ should revert on withdraw an unowned asset (87ms)
      √ should withdraw early (47ms)
      √ should withdraw after lockup period (45ms)
      √ should revert on withdraw an asset already withdrawn


  24 passing (2s)

```
