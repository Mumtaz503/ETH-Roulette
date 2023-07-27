const { ethers } = require("hardhat");

const networkConfig = {
    11155111: {
        name: "sepolia",
        subscriptionId: "3126",
        vrfCoordinatorV2: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        callbackGasLimit: "1000000",
    },

    31337: {
        name: "hardhat",
        gasLane: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
        callbackGasLimit: "1000000",
    }
}

const developmentChains = ["hardhat", "localhost"];
const keepersUpdateInterval = "180";
const entranceFee = ethers.utils.parseEther("0.0026");
const minOutsideBet = ethers.utils.parseEther("0.013");
const minInsideBet = ethers.utils.parseEther("0.026");

module.exports = {
    networkConfig,
    developmentChains,
    keepersUpdateInterval,
    entranceFee,
    minOutsideBet,
    minInsideBet
}

//0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc