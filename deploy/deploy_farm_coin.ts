import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";

const deployFarmCoin: DeployFunction = async (hre) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("FarmCoin", {
    from: deployer,
    args: [],
    log: true,
  });

  const farmCoin = await ethers.getContract("FarmCoin");
};

export default deployFarmCoin;
deployFarmCoin.tags = ["FarmCoin"];
deployFarmCoin.dependencies = [];
