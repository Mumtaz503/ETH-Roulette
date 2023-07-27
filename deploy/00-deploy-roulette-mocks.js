const { ethers, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");


const BASE_FEE = ethers.utils.parseEther("0.25");
const GAS_PRICE_LINK = 1e9;

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    const args = [BASE_FEE, GAS_PRICE_LINK];

    if (developmentChains.includes(network.name)) {
        log("deploying VRF Coordinator Mocks for the local-host...");

        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: args,
        });
        log("Mocks successfully deployed!!");
        log("--------------------------------------------------------------------------");
    }

}

module.exports.tags = ["mocks"];