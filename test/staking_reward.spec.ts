import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber, constants } from "ethers";
import { deployments, ethers, getNamedAccounts } from "hardhat";

import { ERC20Mock, FarmCoin, StakingReward } from "../typechain";

chai.use(solidity);

enum RateTier {
  Low,
  Medium,
  High,
}

enum Status {
  NONE,
  DEPOSITED,
  WITHDRAWN,
}

const testRateTier = (
  signerIndex: number,
  depositAmount: BigNumber,
  rateTier: RateTier
) => {
  let deployer: SignerWithAddress;
  let signers: SignerWithAddress[];
  let stakingReward: StakingReward;
  let farmCoin: FarmCoin;
  let mockERC20: ERC20Mock;
  let depositId: BigNumber;
  let signer: SignerWithAddress;

  beforeEach(async () => {
    deployer = await ethers.getSigner((await getNamedAccounts()).deployer);
    signers = await ethers.getSigners(); // @NOTE: The signers[0] is deployer
    signer = signers[signerIndex];

    mockERC20 = await ethers.getContract("ERC20Mock");
    farmCoin = await ethers.getContract("FarmCoin");
    stakingReward = await ethers.getContract("StakingReward");
  });

  it("should revert on deposit 0 USDC", async () => {
    await expect(
      stakingReward.connect(signer).deposit(0, rateTier)
    ).to.be.revertedWith("Invalid Amount");
  });

  it("should revert on deposit at invalid rate tier", async () => {
    await expect(
      stakingReward.connect(signer).deposit(100, 6)
    ).to.be.revertedWith("Invalid Rate Tier");
  });

  it("should deposit successfully", async () => {
    const nonce = await stakingReward.nonce();
    depositId = nonce.add(1);
    await mockERC20.connect(deployer).setBalance(signer.address, depositAmount);
    await mockERC20
      .connect(signer)
      .approve(stakingReward.address, depositAmount);
    await expect(stakingReward.connect(signer).deposit(depositAmount, rateTier))
      .to.emit(stakingReward, "Deposit")
      .withArgs(depositId, signer.address, depositAmount, rateTier);
    const asset = await stakingReward.assets(depositId);
    expect(asset.user).to.be.equal(signer.address);
    expect(asset.amount).to.be.equal(depositAmount);
    expect(asset.interestRateTier).to.be.equal(rateTier);
    expect(asset.status).to.be.equal(Status.DEPOSITED);
  });

  it("should revert on withdraw an invalid id", async () => {
    await expect(
      stakingReward.connect(signer).withdraw(depositId.add(1), signer.address)
    ).to.be.revertedWith("Invalid Asset");
  });

  it("should revert on withdraw an unowned asset", async () => {
    const nonce = await stakingReward.nonce();
    const otherSigner = signers[signerIndex + 1];
    await mockERC20
      .connect(deployer)
      .setBalance(otherSigner.address, depositAmount);
    await mockERC20
      .connect(otherSigner)
      .approve(stakingReward.address, depositAmount);
    await stakingReward.connect(otherSigner).deposit(depositAmount, rateTier);

    await expect(
      stakingReward.connect(signer).withdraw(nonce.add(1), signer.address)
    ).to.be.revertedWith("Unowned Asset");
  });

  it("should withdraw early", async () => {
    if (rateTier === RateTier.Low) return;

    // take snapshot
    const snapshotId = await ethers.provider.send("evm_snapshot", []);

    // estimate withdrawable
    const withdrawable = depositAmount.mul(90).div(100);

    // withdraw
    expect(await mockERC20.balanceOf(signer.address)).to.be.equal(0);
    expect(await farmCoin.balanceOf(signer.address)).to.be.equal(0);
    await expect(
      stakingReward.connect(signer).withdraw(depositId, signer.address)
    )
      .to.emit(stakingReward, "Withdraw")
      .withArgs(depositId, signer.address, withdrawable, 0, signer.address);
    expect(await mockERC20.balanceOf(signer.address)).to.be.equal(withdrawable);
    expect(await farmCoin.balanceOf(signer.address)).to.be.equal(0);

    // revert snapshot
    await ethers.provider.send("evm_revert", [snapshotId]);
  });

  it("should withdraw after lockup period", async () => {
    // calculate the lock end time
    const lastestBlock = await ethers.provider.getBlock("latest");
    const blockNow = lastestBlock.timestamp;
    const asset = await stakingReward.assets(depositId);
    const secondsToAdvance = asset.depositedAt
      .add(31536000)
      .sub(blockNow)
      .add(31536000); // 1 year more

    // estimate rewards
    let rate = 20;
    if (rateTier === RateTier.Medium) rate = 40;
    else if (rateTier === RateTier.High) rate = 60;
    const rewards = depositAmount.mul(rate).div(100);

    // time travel
    await ethers.provider.send("evm_increaseTime", [
      secondsToAdvance.toNumber(),
    ]);

    // withdraw
    expect(await mockERC20.balanceOf(signer.address)).to.be.equal(0);
    expect(await farmCoin.balanceOf(signer.address)).to.be.equal(0);
    await expect(
      stakingReward.connect(signer).withdraw(depositId, signer.address)
    ).to.emit(stakingReward, "Withdraw");
    expect(await mockERC20.balanceOf(signer.address)).to.be.equal(
      depositAmount
    );
    expect(await farmCoin.balanceOf(signer.address)).to.be.gte(rewards);
  });

  it("should revert on withdraw an asset already withdrawn", async () => {
    await expect(
      stakingReward.connect(signer).withdraw(depositId, signer.address)
    ).to.be.revertedWith("Already Withdrawn");
  });
};

describe("StakingReward", () => {
  before(async () => {
    await deployments.fixture(["StakingReward"]);
  });

  context("No lockup at 10% APY rewards", () => {
    testRateTier(1, ethers.utils.parseEther("1000"), RateTier.Low);
  });
  context("6 months lockup at 20% APY rewards", () => {
    testRateTier(2, ethers.utils.parseEther("1000"), RateTier.Medium);
  });
  context("1 year lockup at 30% APY rewards", () => {
    testRateTier(3, ethers.utils.parseEther("1000"), RateTier.High);
  });
});
