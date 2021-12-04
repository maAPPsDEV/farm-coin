// SPDX-License-Identifier: MIT
pragma solidity >=0.8.5 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @dev USDC Staking Reward Manager
 * Functionality:
 * - A contract that accepts USDC deposits and rewards the user with FarmCoins
 * - If there is no lock up period, the user should earn 10% APY in FarmCoin
 * - For a six month lock up, the user should earn 20% APY in FarmCoin
 * - For a 1 year lock up, the user should earn 30% APY in FarmCoin
 * - For example, if a user deposits 100 USDC with no lockup, their deposit should
 *   begin accruing interest immediately, at a rate of 10 FarmCoins per year.
 * - If the user locks up their USDC for higher returns, they should be able to withdraw
 *   them early for a 10% fee on the original USDC deposit.
 */
contract StakingReward {
  /// @dev Average number of second per day
  uint256 public constant SECONDS_PER_DAY = 86400;
  /// @dev The percentage applied to withdraw earlier than lockup
  uint256 public constant EARLY_WITHDRAW_PERCENT = 90;

  /// @dev The deposited asset status
  enum Status {
    NONE,
    DEPOSITED,
    WITHDRAWN
  }
  /**
   * @dev The interest rate tier
   * High: 30% for over 1 year lockup
   * Medium: 20% for over 6 months lockup
   * Low: 10% for no lockup
   */
  enum RateTier {
    Low,
    Medium,
    High
  }

  /// @dev The deposited asset structure
  struct Asset {
    address user; // The owner who deposited this asset
    uint256 amount; // The amount deposited
    uint128 depositedAt; // The timestamp when the deposit happened, it was originally designed in block number based
    RateTier interestRateTier; // The interest rate tier
    Status status; // The asset status
  }

  /**
   * @dev Deposit event
   * @param id        - The unique deposited asset id, the client should keep it,
                        since the contract doesn't track which user deposited which asset
   * @param user      - The asset owner
   * @param amount    - The amount deposited
   * @param rateTier  - The interest rate tier
   */
  event Deposit(
    uint256 indexed id,
    address indexed user,
    uint256 amount,
    uint8 rateTier
  );
  /**
   * @dev Deposit event
   * @param id        - The unique deposited asset id
   * @param user      - The asset owner
   * @param amount    - The amount withdrawn, it can be less than original deposited amount when withdrawing early
   * @param rewards   - The amount of rewards, depends on locking period, can be zero when withdrawing early
   * @param to        - The address withdraw to
   */
  event Withdraw(
    uint256 indexed id,
    address indexed user,
    uint256 amount,
    uint256 rewards,
    address to
  );

  /// @dev The staking token
  IERC20 public immutable stakingToken;
  /// @dev The reward token
  IERC20 public immutable rewardToken;

  /**
   * @dev The unique id generator for the deposited assets
   * It's big enough, thus, can serve for a long.
   * It should be public, so that the client gets some sense.
   */
  uint256 public nonce;

  /// @dev The assets keyed by the deposit id
  mapping(uint256 => Asset) public assets;

  /**
   * @dev Constructor
   * Reverts for invalid token addresses provided.
   *
   * @param _stakingToken - The staking token
   * @param _rewardToken - The reward token
   */
  constructor(address _stakingToken, address _rewardToken) {
    require(_stakingToken != address(0), "Invalid Staking Token");
    require(_rewardToken != address(0), "Invalid Reward Token");
    require(
      _rewardToken != _stakingToken,
      "Invalid Reward and Staking Token Pair"
    );
    stakingToken = IERC20(_stakingToken);
    rewardToken = IERC20(_rewardToken);
  }

  /**
   * @dev Deposits an asset
   * The client should keep the depoisted asset id, and should use to lookup and withdraw assets
   *
   * @param _amount           - The amount to deposit
   * @param _interestRateTier - The interest rate tier
   *
   * @return
   *  id - The generated unique asset id
   */
  function deposit(uint256 _amount, uint8 _interestRateTier)
    external
    returns (uint256 id)
  {
    require(_amount > 0, "Invalid Amount");
    require(_interestRateTier <= uint8(RateTier.High), "Invalid Rate Tier");

    stakingToken.transferFrom(msg.sender, address(this), _amount);

    id = nonce = nonce + 1; /// @note overflow safe

    Asset storage asset = assets[id];
    asset.user = msg.sender;
    asset.amount = _amount;
    // solhint-disable-next-line not-rely-on-time
    asset.depositedAt = uint128(block.timestamp);
    asset.interestRateTier = RateTier(_interestRateTier);
    asset.status = Status.DEPOSITED;

    emit Deposit(id, msg.sender, _amount, _interestRateTier);
  }

  /**
   * @dev Looks up the reward amount for an asset
   *
   * @param _id - The deposited asset id
   *
   * @return
   *  withdrawable  - The amount can be withdrawn, it can be less than original deposited amount when withdrawing early
   *  rewards       - The amount of rewards, depends on locking period, can be zero when withdrawing early
   */
  function lookupRewards(uint256 _id)
    public
    view
    returns (uint256 withdrawable, uint256 rewards)
  {
    Asset memory asset = assets[_id];
    if (asset.status != Status.DEPOSITED) return (0, 0);

    uint256 lockup = asset.depositedAt;
    uint256 interestRate = 10;
    if (asset.interestRateTier == RateTier.High) {
      lockup += SECONDS_PER_DAY * 365; // 1 year
      interestRate = 30;
    } else if (asset.interestRateTier == RateTier.Medium) {
      lockup += SECONDS_PER_DAY * 182; // 6 months
      interestRate = 20;
    }

    // solhint-disable-next-line not-rely-on-time
    if (asset.interestRateTier != RateTier.Low && lockup > block.timestamp) {
      // early withdrawn
      withdrawable = (asset.amount * EARLY_WITHDRAW_PERCENT) / 100; // can withdraw 90%
      return (withdrawable, 0);
    }

    withdrawable = asset.amount; // can withdraw all

    /// @dev calculate rewards
    /// @note It doesn't work in real APY formula, because it needs a big math library in order to
    /// calculate the interest based on APY, time unit and principal.
    /// For now it works in APR formula.
    rewards =
      // solhint-disable-next-line not-rely-on-time
      (withdrawable * (block.timestamp - asset.depositedAt) * interestRate) /
      SECONDS_PER_DAY /
      36500;
  }

  /**
   * @dev Withdraw an asset
   *
   * @param _id - The deposited asset id
   * @param _to - The address withdraw to
   *
   * @return
   *  withdrawable  - The amount can be withdrawn, it can be less than original deposited amount when withdrawing early
   *  rewards       - The amount of rewards, depends on locking period, can be zero when withdrawing early
   */
  function withdraw(uint256 _id, address _to)
    external
    returns (uint256 withdrawable, uint256 rewards)
  {
    Asset storage asset = assets[_id];
    require(asset.status != Status.NONE, "Invalid Asset");
    require(asset.user == msg.sender, "Unowned Asset");
    require(asset.status != Status.WITHDRAWN, "Already Withdrawn");

    // calculate rewards and fee
    (withdrawable, rewards) = lookupRewards(_id);

    // update the status, re-entrancy safe
    asset.status = Status.WITHDRAWN;

    // transfer tokens
    if (withdrawable > 0) {
      stakingToken.transfer(_to, withdrawable);
    }
    if (rewards > 0) {
      rewardToken.transfer(_to, rewards);
    }

    emit Withdraw(_id, msg.sender, withdrawable, rewards, _to);
  }
}
