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

  before(async () => {
    await deployments.fixture(["StakingReward"]);
    deployer = await ethers.getSigner((await getNamedAccounts()).deployer);
    signers = await ethers.getSigners(); // @NOTE: The signers[0] is deployer
    signer = signers[signerIndex];

    mockERC20 = await ethers.getContract("ERC20Mock");
    farmCoin = await ethers.getContract("FarmCoin");
    stakingReward = await ethers.getContract("StakingReward");
  });

  it("should revert on deposit 0 USDC", async () => {
    await expect(
      stakingReward.connect(signers[1]).deposit(0, rateTier)
    ).to.be.revertedWith("Invalid Amount");
  });

  it("should revert on deposit at invalid rate tier", async () => {
    await expect(
      stakingReward.connect(signers[1]).deposit(100, 6)
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
      stakingReward
        .connect(signers[1])
        .withdraw(depositId.add(1), signer.address)
    ).to.be.revertedWith("Invalid Asset");
  });
};

describe("StakingReward", () => {
  testRateTier(1, ethers.utils.parseEther("1000"), RateTier.Low);
});
