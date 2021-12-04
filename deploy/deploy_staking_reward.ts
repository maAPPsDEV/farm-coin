import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";

import { FarmCoin } from "../typechain";

const deployStakingReward: DeployFunction = async (hre) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const farmCoin: FarmCoin = await ethers.getContract("FarmCoin");

  await deploy("ERC20Mock", {
    from: deployer,
    args: ["Mock ERC20", "MCK", ethers.utils.parseEther("10000000000")],
    log: true,
  });
  const mockERC20 = await ethers.getContract("ERC20Mock");

  await deploy("StakingReward", {
    from: deployer,
    args: [mockERC20.address, farmCoin.address],
    log: true,
  });

  const stakingReward = await ethers.getContract("StakingReward");
  await farmCoin.transfer(
    stakingReward.address,
    await farmCoin.balanceOf(deployer)
  );
};

export default deployStakingReward;
deployStakingReward.tags = ["StakingReward"];
deployStakingReward.dependencies = ["FarmCoin"];
