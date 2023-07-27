const { ethers, network } = require("hardhat");
const { developmentChains,
    networkConfig,
    keepersUpdateInterval,
    entranceFee,
    minOutsideBet,
    minInsideBet } = require("../helper-hardhat-config");
const { verify } = require("../utils/verification");

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("10");

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;

    let vrfCoordinatorV2Address, subscriptionId, gasLane, mockVrfCoordinatorV2, callbackGasLimit;

    if (chainId == 31337) {
        mockVrfCoordinatorV2 = await ethers.getContract("VRFCoordinatorV2Mock");
        vrfCoordinatorV2Address = mockVrfCoordinatorV2.address;
        const transactionResponse = await mockVrfCoordinatorV2.createSubscription();
        const transactionReciept = await transactionResponse.wait(1);
        subscriptionId = transactionReciept.events[0].args.subId;
        await mockVrfCoordinatorV2.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
        gasLane = networkConfig[chainId]["gasLane"];
        //callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[chainId]["subscriptionId"];
        gasLane = networkConfig[chainId]["gasLane"];
        //callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    }

    const arguments = [subscriptionId,
        vrfCoordinatorV2Address,
        gasLane,
        networkConfig[chainId]["callbackGasLimit"],
        keepersUpdateInterval,
        entranceFee,
        minOutsideBet,
        minInsideBet];

    const roulette = await deploy("Roulette", {
        from: deployer,
        args: arguments,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    });

    if (developmentChains.includes(network.name)) {
        const mockVrfCoordinatorV2 = await ethers.getContract("VRFCoordinatorV2Mock");
        await mockVrfCoordinatorV2.addConsumer(subscriptionId, roulette.address);
        log("Consumer Successfully Added");
    }

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying Contract on etherscan please wait....");
        await verify(roulette.address, arguments);
    }

    log(`Contract Successfully Deployed at: ${roulette.address}`);
    log("--------------------------------------------------------------------------");
}

module.exports.tags = ["roulette"];